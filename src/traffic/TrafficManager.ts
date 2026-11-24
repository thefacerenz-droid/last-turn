import RAPIER from '@dimforge/rapier3d-compat/rapier.es.js';
import { Euler, Quaternion, Scene, Vector3 } from 'three';
import { clamp, damp, seeded, wrapAngle } from '../core/math';
import type { VehicleController } from '../physics/VehicleController';
import { PhysicsWorld, groups, layers } from '../physics/PhysicsWorld';
import { createVehicleModel, trafficVehicles, type VehicleSpec, type VehicleModel } from '../vehicles';
import { laneOffset, roadAt, roadHeight, LANE_WIDTH } from '../world/roads';
import { drivers, follow, LaneIndex, type Occupant } from './TrafficAI';

const paint=['#c1c0bb','#3d4850','#315368','#a14338','#686d60','#e5dfcc','#23292e','#9b8a72'];
export interface TrafficCar extends Occupant {
  spec:VehicleSpec;model?:VehicleModel; lane:number;target:number;blend:number;laneFloat:number;
  acceleration:number;think:number;cooldown:number;reckoning:number;hit:number;
  body?:RAPIER.RigidBody; collider?:number; x:number;y:number;yaw:number;spin:number; signal:number;
  previous:Vector3;position:Vector3;lastRotation:Quaternion;rotation:Quaternion;
}
export class TrafficManager {
  readonly cars:TrafficCar[]=[];
  private index:LaneIndex; private nextId=1; private random=seeded(718246);
  private clock=0;private tick=0;
  private wanted=26;private playerToken:Occupant={id:-1,s:0,speed:0,length:4.6,driver:drivers.normal,cruise:40};
  private colliderMap=new Map<number,TrafficCar>();
  private vec=new Vector3();private quat=new Quaternion();private angles=new Euler(0,0,0,'YXZ');
  constructor(readonly physics:PhysicsWorld,private scene:Scene|null,private player:VehicleController,count:number,public viewDistance=600){
    this.index=new LaneIndex(roadAt(physics.route,0).lanes);this.setCount(count);
  }
  setCount(count:number){
    this.wanted=clamp(Math.round(count),0,72);
    while(this.cars.length>this.wanted)this.remove(this.cars.pop()!);
    while(this.cars.length<this.wanted){
      const i=this.cars.length,spec=trafficVehicles[(i*7+Math.floor(i/3))%trafficVehicles.length];
      const heavy=spec.mass>2250||spec.length>5.65;
      const style=heavy?drivers.heavy:[drivers.normal,drivers.cautious,drivers.normal,drivers.assertive][Math.floor(this.random()*4)];
      const model=this.scene?createVehicleModel(spec,{traffic:true,paint:paint[Math.floor(this.random()*paint.length)]}):undefined;
      if(model)this.scene!.add(model.root);
      const vehicle:TrafficCar={id:this.nextId++,spec,model,lane:0,target:0,blend:1,laneFloat:0,s:0,speed:0,length:spec.length,driver:style,cruise:style.cruise,
        acceleration:0,think:0,cooldown:0,reckoning:0,hit:0,x:0,y:0,yaw:0,spin:0,signal:0,previous:new Vector3(),position:new Vector3(),lastRotation:new Quaternion(),rotation:new Quaternion()};
      this.spawn(vehicle,true);this.cars.push(vehicle);
    }
  }
  private spawn(car:TrafficCar,initial:boolean,upstream=false){
    this.demote(car);
    const at=this.player.s,lanes=this.index.lanes.length;
    let bestS=at+140,bestLane=0,bestGap=-1;
    for(let attempt=0;attempt<48;attempt++){
      const distance=initial?(this.cars.length<4?32+this.cars.length*24:-155+this.random()*(this.viewDistance+175)):this.viewDistance+14+this.random()*44;
      const s=at+(upstream?-distance:distance);
      const lane=Math.floor(this.random()*lanes);
      let gap=Math.abs(s-at)<28?0:Infinity;
      for(const other of this.cars)if(other!==car&&(other.lane===lane||other.target===lane))gap=Math.min(gap,Math.abs(s-other.s)-(car.length+other.length)*.5);
      if(gap>bestGap){bestS=s;bestGap=gap;bestLane=lane;}
      if(gap>24)break;
    }
    car.id=this.nextId++;car.s=bestS;car.lane=car.target=car.laneFloat=bestLane;car.blend=1;
    car.cruise=car.driver.cruise*(.86+this.random()*.25)+(lanes-1-bestLane)*1.3;
    car.speed=car.cruise*(.72+this.random()*.23);car.acceleration=0;car.hit=0;car.signal=0;
    car.think=this.random()*.3;car.cooldown=2+this.random()*5;
    this.place(car);car.previous.copy(car.position);car.lastRotation.copy(car.rotation);
  }
  private place(car:TrafficCar){
    const r=roadAt(this.physics.route,car.s);
    car.x=r.x+laneOffset(this.physics.route,car.s,car.laneFloat);
    car.y=roadHeight(this.physics.route,car.s,car.x);
    const lateralRate=car.blend<1?(car.target-car.lane)*LANE_WIDTH*6*car.blend*(1-car.blend)/3.5:0;
    car.yaw=-Math.atan(r.slope+lateralRate/Math.max(car.speed,5));
    car.position.set(car.x,car.y,-car.s);
    car.rotation.setFromEuler(this.angles.set(Math.atan(r.grade),car.yaw,Math.atan(r.bank),'YXZ'));
  }
  private promote(car:TrafficCar){
    if(car.body)return;
    const spec=car.spec;
    const body=this.physics.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(car.x,car.y+spec.cgHeight,-car.s).setRotation(car.rotation).setCanSleep(false)
      .setAngularDamping(.47).setCcdEnabled(true));
    const collider=this.physics.world.createCollider(RAPIER.ColliderDesc.roundCuboid(spec.width*.45,spec.height*.31,spec.length*.461,.055)
      .setTranslation(0,spec.height*.41-spec.cgHeight,0).setMass(spec.mass).setFriction(.4).setRestitution(.1)
      .setCollisionGroups(groups(layers.vehicle,7)).setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(8500),body);
    this.vec.set(0,0,-car.speed).applyQuaternion(car.rotation);body.setLinvel(this.vec,true);
    car.body=body;car.collider=collider.handle;this.colliderMap.set(collider.handle,car);
  }
  private demote(car:TrafficCar){if(car.body){this.colliderMap.delete(car.collider!);this.physics.world.removeRigidBody(car.body);car.body=undefined;car.collider=undefined;}}
  private remove(car:TrafficCar){this.demote(car);if(car.model){car.model.root.removeFromParent();car.model.dispose();}}
  incident(handle:number,impulse:number){const c=this.colliderMap.get(handle);if(c&&impulse>c.spec.mass*.34){c.hit=Math.max(c.hit,clamp(impulse/c.spec.mass*.55,.35,3.1));c.cooldown=4;}}
  clearSpawn(s:number,lane:number){
    for(const car of this.cars)if(Math.abs(car.s-s)<28 && Math.abs(car.laneFloat-lane)<1.25)this.spawn(car,false);
  }
  private refreshIndex(){
    this.index.clear();
    const road=roadAt(this.physics.route,this.player.s);
    const l=(this.player.position.x-road.x)/(LANE_WIDTH*Math.hypot(1,road.slope))+(road.lanes-1)*.5;
    const p=this.playerToken;p.s=this.player.s;p.speed=Math.max(0,-this.player.velocity.z);p.length=this.player.spec.length;
    for(let i=0;i<road.lanes;i++)if(Math.abs(l-i)<.82)this.index.add(i,p);
    for(const c of this.cars){
      const r=roadAt(this.physics.route,c.s);
      const realLane=(c.x-r.x)/(LANE_WIDTH*Math.hypot(1,r.slope))+(r.lanes-1)*.5;
      for(let i=0;i<r.lanes;i++)if(i===c.target||i===c.lane||Math.abs(i-realLane)<.76)this.index.add(i,c);
    }
    this.index.sort();
  }
  step(dt:number){
    this.clock+=dt;this.tick++;
    if(this.tick%4===1)this.refreshIndex();
    for(const c of this.cars){
      c.previous.copy(c.position);c.lastRotation.copy(c.rotation);
      const distance=c.s-this.player.s;
      if(Math.abs(distance)>this.viewDistance+80){this.spawn(c,false,distance>0);continue;}
      if(Math.abs(distance)<90)this.promote(c);else if(Math.abs(distance)>127)this.demote(c);
      c.cooldown-=dt;c.think-=dt;c.hit=Math.max(0,c.hit-dt);
      if(c.think<=0){
        const front=this.index.neighbors(c.lane,c).front;
        c.acceleration=follow(c,front);
        if(c.target!==c.lane)c.acceleration=Math.min(c.acceleration,follow(c,this.index.neighbors(c.target,c).front));
        else if(c.cooldown<=0 && c.hit<=0 && c.speed>4){
          const next=this.index.choose(c.lane,c,c.acceleration);
          if(next!==c.lane){c.target=next;c.blend=0;c.signal=next>c.lane?1:-1;this.index.add(next,c);this.index.sort();}
          c.cooldown=2+this.random()*3;
        }
        c.think=(c.body?.11:.32)+this.random()*.08;
      }
      if(c.blend<1 && !c.hit){
        c.blend=Math.min(1,c.blend+dt/(c.driver===drivers.heavy?4.8:3.5));
        c.laneFloat=c.lane+(c.target-c.lane)*c.blend*c.blend*(3-2*c.blend);
        if(c.blend===1){c.lane=c.target;c.signal=0;c.cooldown=3+this.random()*4;}
      }
      if(c.body){this.driveBody(c,dt);}else{
        c.speed=Math.max(0,c.speed+c.acceleration*dt);
        c.s+=c.speed*dt/Math.hypot(1,roadAt(this.physics.route,c.s).slope);
        this.place(c);
      }
      c.spin-=c.speed*dt/c.spec.wheelRadius;
    }
  }
  private driveBody(c:TrafficCar,dt:number){
    const body=c.body!,p=body.translation(),v=body.linvel(),spin=body.angvel(),q=body.rotation();
    c.s=-p.z;const r=roadAt(this.physics.route,c.s),targetX=r.x+laneOffset(this.physics.route,c.s,c.laneFloat);
    const slope=Math.atan(r.slope),ground=roadHeight(this.physics.route,c.s,p.x),mass=c.spec.mass;
    const vertical=clamp(9.81+78*(ground+c.spec.cgHeight-p.y)-12*(v.y+v.z*r.grade),0,30);
    this.vec.set(0,mass*vertical*dt,0);body.applyImpulse(this.vec,true);
    this.quat.copy(q);this.vec.set(0,0,-1).applyQuaternion(this.quat);
    const yaw=Math.atan2(-this.vec.x,-this.vec.z);
    const lateral=(p.x-targetX)*Math.cos(slope);
    const along=v.x*Math.sin(slope)-v.z*Math.cos(slope);c.speed=Math.max(0,along);
    if(c.hit<=0){
      const cross=v.x*Math.cos(slope)+v.z*Math.sin(slope);
      const latAccel=clamp(-1.9*lateral-2.7*cross,-5.4,5.4);
      const accel=c.acceleration;
      this.vec.set(accel*Math.sin(slope)+latAccel*Math.cos(slope),0,-accel*Math.cos(slope)+latAccel*Math.sin(slope)).multiplyScalar(mass*dt);
      body.applyImpulse(this.vec,true);
      const targetYaw=-slope+Math.atan2(clamp(lateral*.8,-3,3),Math.max(7,c.speed));
      this.vec.set(0,clamp(wrapAngle(targetYaw-yaw)*7-spin.y*3.8,-5,5)*mass*dt,0);body.applyTorqueImpulse(this.vec,true);
    }
    this.vec.set(0,1,0).applyQuaternion(this.quat);
    const strength=c.hit>0?.38:1;
    body.applyTorqueImpulse(this.vec.set((-this.vec.z-r.grade)*9-spin.x*3,0,(this.vec.x+r.bank)*12-spin.z*3).multiplyScalar(mass*dt*strength),true);
  }
  capture(){
    for(const c of this.cars)if(c.body){
      const p=c.body.translation();
      c.rotation.copy(c.body.rotation());c.position.copy(p).add(this.vec.set(0,-c.spec.cgHeight,0).applyQuaternion(c.rotation));
      c.x=p.x;c.y=c.position.y;c.s=-p.z;
    }
  }
  draw(alpha:number,drawDistance:number,night:boolean) {
    for(const c of this.cars){const m=c.model;if(!m)continue;
      const distance=Math.abs(c.s-this.player.s);m.root.visible=distance<drawDistance;
      if(!m.root.visible)continue;
      m.root.position.lerpVectors(c.previous,c.position,alpha);m.root.quaternion.copy(c.lastRotation).slerp(c.rotation,alpha);
      m.setDetail(distance>95);
      const blink=(this.clock*1.7)%1<.48;
      m.setLights(c.acceleration<-.8||c.hit>.1,blink&&c.signal<0,blink&&c.signal>0,night);
      if(distance<96){for(const w of m.wheelRollers)w.rotation.x=c.spin;}
    }
  }
  nearestDistance(){let near=Infinity;for(const c of this.cars)near=Math.min(near,Math.hypot(c.x-this.player.position.x,c.s-this.player.s));return near;}
  dispose(){for(const c of this.cars)this.remove(c);this.cars.length=0;}
}
