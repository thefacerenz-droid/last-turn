import RAPIER from '@dimforge/rapier3d-compat/rapier.es.js';
import { Quaternion, Vector3 } from 'three';
import { clamp, damp } from '../core/math';
import type { Controls } from '../input/InputManager';
import type { Settings, Tune } from '../settings/SettingsManager';
import type { VehicleSpec, VehicleModel } from '../vehicles';
import { roadAt, roadHeight, laneOffset, isPaved } from '../world/roads';
import { EngineSimulation } from './Drivetrain';
import { PhysicsWorld, groups, layers } from './PhysicsWorld';
import { WheelPhysics } from './WheelPhysics';
import { handlingTunes } from '../vehicles/handlingTunes';

const identity={x:0,y:0,z:0,w:1},zero={x:0,y:0,z:0};
export class VehicleController {
  readonly body:RAPIER.RigidBody; readonly collider:RAPIER.Collider; readonly wheels:WheelPhysics[];
  engine:EngineSimulation;
  readonly position=new Vector3(); readonly previous=new Vector3();
  readonly rotation=new Quaternion(); readonly lastRotation=new Quaternion();
  readonly velocity=new Vector3(); readonly forward=new Vector3(0,0,-1);
  speed=0; steer=0; acceleration=0; braking=false; impactTime=0;signal=0;private signalPhase=0;
  private pedalGas=0;private pedalBrake=0;private lever=0;
  private cgZ:number;
  private down=new Vector3();private temp=new Vector3();
  constructor(readonly physics:PhysicsWorld,readonly spec:VehicleSpec,public tune:Tune){
    const s=spec;
    this.cgZ=(.5-s.frontWeight)*s.wheelbase;
    const inertia={x:s.mass*(s.length*s.length+s.height*s.height)*.065,y:s.mass*(s.length*s.length+s.width*s.width)*.068,z:s.mass*(s.width*s.width+s.height*s.height)*.075};
    this.body=physics.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setCcdEnabled(true).setCanSleep(false)
      .setAngularDamping(.09).setAdditionalMassProperties(s.mass,zero,inertia,identity));
    this.collider=physics.world.createCollider(RAPIER.ColliderDesc.roundCuboid(s.width*.45,s.height*.29,s.length*.458,.065)
      .setDensity(0).setTranslation(0,s.height*.42-s.cgHeight,-this.cgZ).setFriction(.38).setRestitution(.11)
      .setCollisionGroups(groups(layers.vehicle,7)).setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS)
      .setContactForceEventThreshold(6000),this.body);
    this.wheels=[0,1,2,3].map(i=>new WheelPhysics(s,i<2,i%2===0,this.body,physics));
    this.engine=new EngineSimulation(s);this.reset(0,1);
  }
  get s(){return -this.position.z;}
  reset(s:number,lane:number) {
    const road=roadAt(this.physics.route,s);
    const x=road.x+laneOffset(this.physics.route,s,clamp(lane,0,road.lanes-1));
    this.physics.terrain(s);
    this.position.set(x,roadHeight(this.physics.route,s,x)+this.spec.cgHeight+this.tune.ride+.045,-s);
    this.previous.copy(this.position);
    this.rotation.setFromAxisAngle(this.temp.set(0,1,0),-Math.atan(road.slope));this.lastRotation.copy(this.rotation);
    this.body.setTranslation(this.position,true);this.body.setRotation(this.rotation,true);
    this.body.setLinvel(zero,true);this.body.setAngvel(zero,true);
    this.pedalGas=this.pedalBrake=this.lever=0;this.speed=this.steer=this.acceleration=0;this.impactTime=.15;
    for(const w of this.wheels){w.omega=w.angle=w.slip=0;}
    this.engine=new EngineSimulation(this.spec);
  }
  shift(direction:number,input:Controls,settings:Settings){
    if(settings.mode==='Manual')this.engine.transmission.select(this.engine.transmission.gear+direction,this.speed,settings.autoClutch||input.clutch>.65);
  }
  step(dt:number,input:Controls,settings:Settings) {
    this.impactTime=Math.max(0,this.impactTime-dt);
    this.pedalGas=damp(this.pedalGas,input.throttle,13,dt);this.pedalBrake=damp(this.pedalBrake,input.brake,14,dt);this.lever=damp(this.lever,Number(input.handbrake),12,dt);
    this.signalPhase=(this.signalPhase+dt*1.6)%1;
    this.previous.copy(this.position);this.lastRotation.copy(this.rotation);
    const s=this.spec;
    this.velocity.copy(this.body.linvel());
    this.forward.set(0,0,-1).applyQuaternion(this.rotation);
    const oldSpeed=this.speed;this.speed=this.velocity.dot(this.forward);
    this.acceleration=damp(this.acceleration,(this.speed-oldSpeed)/dt,7,dt);
    this.down.set(0,-1,0).applyQuaternion(this.rotation);
    const speed=Math.abs(this.speed);
    const tune=handlingTunes[this.tune.handling];
    const steerMax=.52*tune.steering/(1+speed*(settings.steeringAssist?.074:.048));
    const steerInput=Math.sign(input.steer)*Math.pow(Math.abs(input.steer),1.32);
    this.steer=damp(this.steer,steerInput*steerMax*settings.sensitivity,input.steer===0?7.5:4.5,dt);
    for(const wheel of this.wheels)wheel.sample(this.position,this.rotation,this.down,this.cgZ,this.tune.ride,this.tune.spring);
    for(const start of [0,2]){
      const a=this.wheels[start],b=this.wheels[start+1],anti=(a.compression-b.compression)*s.antiRoll;
      if(a.planted)a.load=Math.max(0,a.load+anti);
      if(b.planted)b.load=Math.max(0,b.load-anti);
    }
    const fractions=s.drivetrain==='AWD'?[.21,.21,.29,.29]:s.drivetrain==='FWD'?[.5,.5,0,0]:[0,0,.5,.5];
    let shaftSpeed=0,slip=0;
    for(let i=0;i<4;i++){shaftSpeed+=this.wheels[i].omega*fractions[i];if(fractions[i])slip=Math.max(slip,Math.abs(this.wheels[i].slip));}
    const tcs=settings.traction?clamp(1-(slip-.11)*1.2,.2,1):1;
    const request=this.engine.update(dt,input,shaftSpeed,this.speed,settings.mode==='Automatic',settings.autoClutch,tcs,tune.power);
    this.braking=request.brake>.07||input.handbrake;
    const grip=s.grip*(isPaved(this.physics.route,this.s,this.position.x)?1:.62)*(this.impactTime>0?.84:1);
    for(let i=0;i<4;i++){
      const wheel=this.wheels[i],mate=this.wheels[i^1];
      const differential=fractions[i]?clamp((mate.omega-wheel.omega)*2.3*tune.lock,-Math.abs(request.torque)*.12,Math.abs(request.torque)*.12):0;
      wheel.apply(dt,this.rotation,wheel.front?this.steer:0,request.torque*fractions[i]+differential,request.brake,input.handbrake,grip*(wheel.front?tune.front:tune.rear));
    }
    const v=this.velocity.length();
    if(v>.01){
      const drag=.5*1.225*(s.width*s.height*.8)*.29*tune.drag*v*v;
      const rolling=s.mass*9.81*.012*clamp(v/.8,0,1);
      this.temp.copy(this.velocity).multiplyScalar(-(drag+rolling)*dt/v);
      this.body.applyImpulse(this.temp,true);
    }
    if(settings.steeringAssist && speed>8 && this.down.y<-.65 && this.wheels.filter(w=>w.planted).length>=3) {
      const yawTarget=-Math.tan(this.steer)*this.speed/s.wheelbase;
      const error=clamp(yawTarget-this.body.angvel().y,-2,2);
      this.body.applyTorqueImpulse(this.temp.set(0,error*s.mass*.37*dt,0),true);
    }
  }
  capture(){this.position.copy(this.body.translation());this.rotation.copy(this.body.rotation());}
  draw(model:VehicleModel,alpha:number,headlights:boolean,cockpit=false) {
    model.root.quaternion.copy(this.lastRotation).slerp(this.rotation,alpha);
    model.root.position.lerpVectors(this.previous,this.position,alpha);
    model.root.position.add(this.temp.set(0,-this.spec.cgHeight,-this.cgZ).applyQuaternion(model.root.quaternion));
    this.wheels.forEach((w,i)=>{
      model.wheels[i].position.y=w.radius+w.rest-w.sag+this.tune.ride-w.length;
      model.wheels[i].rotation.y=-w.steer;model.wheelRollers[i].rotation.x=-w.angle;
    });
    model.steeringWheel.rotation.z=-this.steer*5;
    model.driver?.update(model.steeringWheel.rotation.z,this.pedalGas,this.pedalBrake,this.lever,cockpit);
    model.setLights(this.braking,this.signal<0&&this.signalPhase<.52,this.signal>0&&this.signalPhase<.52,headlights);
  }
  dispose(){this.physics.world.removeRigidBody(this.body);}
}
