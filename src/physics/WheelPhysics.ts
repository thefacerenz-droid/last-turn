import RAPIER from '@dimforge/rapier3d-compat/rapier.es.js';
import { Quaternion, Vector3 } from 'three';
import { clamp } from '../core/math';
import type { VehicleSpec } from '../vehicles';
import { PhysicsWorld, groups, layers } from './PhysicsWorld';

export class WheelPhysics {
  readonly anchor=new Vector3();
  readonly contact=new Vector3();
  readonly normal=new Vector3(0,1,0);
  readonly velocity=new Vector3();
  private forward=new Vector3(); private side=new Vector3(); private impulse=new Vector3();
  private ray=new RAPIER.Ray({x:0,y:0,z:0},{x:0,y:-1,z:0});
  radius:number; spring:number; sag:number; length:number; rest:number; load=0; compression=0;
  planted=false; omega=0; angle=0; slip=0; lateralSlip=0; steer=0;
  constructor(private spec:VehicleSpec,readonly front:boolean,readonly left:boolean,private body:RAPIER.RigidBody, private physics:PhysicsWorld){
    this.radius=spec.wheelRadius;this.spring=spec.spring;this.rest=spec.travel+.065;this.length=this.rest;
    this.sag=spec.mass*9.81*(front?spec.frontWeight:1-spec.frontWeight)/2/this.spring;
  }
  sample(pos:Vector3,orientation:Quaternion,down:Vector3,cgZ:number,ride:number,stiffness:number) {
    const s=this.spec;
    this.spring=s.spring*stiffness;
    this.sag=s.mass*9.81*(this.front?s.frontWeight:1-s.frontWeight)/2/this.spring;
    this.anchor.set((this.left?-1:1)*s.track/2,this.radius-s.cgHeight+this.rest-this.sag+ride,(this.front?-1:1)*s.wheelbase/2-cgZ).applyQuaternion(orientation).add(pos);
    this.ray.origin=this.anchor;this.ray.dir=down;
    const hit=this.physics.world.castRayAndGetNormal(this.ray,this.rest+this.radius,false,undefined,groups(layers.vehicle,layers.ground));
    this.planted=!!hit;
    if(!hit){this.length=this.rest;this.compression=this.load=0;return;}
    this.normal.copy(hit.normal);
    if(this.normal.dot(down)>0)this.normal.negate();
    this.contact.copy(this.anchor).addScaledVector(down,hit.timeOfImpact);
    this.length=clamp(hit.timeOfImpact-this.radius,.025,this.rest);
    this.compression=this.rest-this.length;
    this.velocity.copy(this.body.velocityAtPoint(this.contact));
    const vertical=this.velocity.dot(this.normal);
    const bump=Math.max(0,this.compression-this.spec.travel*.88);
    this.load=clamp(this.spring*this.compression+bump*this.spring*2.4-vertical*s.damping*(vertical>0?1.13:.91),0,s.mass*9.81*1.65);
  }
  apply(dt:number,orientation:Quaternion,steer:number,torque:number,brake:number,handbrake:boolean,grip:number) {
    this.steer=steer;
    const inertia=this.spec.wheelMass*this.radius*this.radius*.64;
    const freeOmega=this.omega+torque*dt/inertia;
    const brakeTorque=brake*this.spec.mass*(this.front?1.38:.91)+(handbrake&&!this.front?this.spec.mass*2:0);
    this.omega=Math.sign(freeOmega)*Math.max(0,Math.abs(freeOmega)-brakeTorque*dt/inertia);
    if(this.planted && this.load>0) {
      this.forward.set(Math.sin(steer),0,-Math.cos(steer)).applyQuaternion(orientation);
      this.forward.addScaledVector(this.normal,-this.forward.dot(this.normal)).normalize();
      this.side.crossVectors(this.forward,this.normal).normalize();
      const along=this.forward.dot(this.velocity),across=this.side.dot(this.velocity);
      const reference=Math.max(2.5,Math.abs(along));
      const diff=this.omega*this.radius-along;
      const stiffness=this.load*10;
      // Implicit longitudinal slip resists oscillation at low wheel speeds.
      let fx=stiffness*diff/(reference+stiffness*dt*(this.radius*this.radius/inertia+4/this.spec.mass));
      if(brakeTorque>0&&Math.abs(freeOmega)<brakeTorque*dt/inertia+.02){
        const locked=clamp(-along*this.spec.mass/(4*dt),-brakeTorque/this.radius,brakeTorque/this.radius);
        if(Math.abs(locked)>Math.abs(fx))fx=locked;
      }
      this.lateralSlip=Math.atan2(across,Math.max(2,Math.abs(along)));
      const fy=clamp(-this.lateralSlip*this.load*8,-Math.abs(across)*this.spec.mass/(4*dt),Math.abs(across)*this.spec.mass/(4*dt));
      const capacity=this.load*grip*(handbrake&&!this.front?.56:1)*clamp(1.1-.1*this.load/(this.spec.mass*9.81/4),.78,1.1);
      const scale=Math.min(1,capacity/(Math.hypot(fx,fy)||1));fx*=scale;
      this.impulse.copy(this.normal).multiplyScalar(this.load*dt).addScaledVector(this.forward,fx*dt).addScaledVector(this.side,fy*scale*dt);
      this.body.applyImpulseAtPoint(this.impulse,this.contact,true);
      const spin=this.omega-fx*this.radius*dt/inertia;
      this.omega=brakeTorque>Math.abs(fx)*this.radius && brakeTorque>Math.abs(torque)?0:spin;
      this.slip=(this.omega*this.radius-along)/reference;
    }else {this.slip=0;this.lateralSlip=0;}
    this.omega=clamp(this.omega,-650,650);
    this.angle+=this.omega*dt;
  }
}
