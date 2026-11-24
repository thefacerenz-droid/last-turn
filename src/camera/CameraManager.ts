import RAPIER from '@dimforge/rapier3d-compat/rapier.es.js';
import { Quaternion, Vector3, type PerspectiveCamera } from 'three';
import { clamp, damp } from '../core/math';
import type { VehicleController } from '../physics/VehicleController';
import { groups, layers } from '../physics/PhysicsWorld';
import type { Controls } from '../input/InputManager';
import type { Settings } from '../settings/SettingsManager';
export const cameraNames=['Chase','Close chase','Hood','Cockpit','Free look','Cinematic'] as const;
export class CameraManager {
  mode=0;private yaw=0;private pitch=.19;private shake=0;private clock=0;private snap=true;
  private target=new Vector3();private wanted=new Vector3();private focus=new Vector3();private anchor=new Vector3();private ahead=new Vector3();
  private pos=new Vector3();private lastCar=new Vector3();private displacement=new Vector3();private aim=new Vector3();private rot=new Quaternion();private ray=new RAPIER.Ray({x:0,y:0,z:0},{x:0,y:0,z:-1});
  constructor(private camera:PerspectiveCamera){}
  cycle(){this.mode=(this.mode+1)%cameraNames.length;this.yaw=0;this.pitch=.19;}
  toggleLook(){this.mode=this.mode===4?0:4;this.yaw=0;}
  reset(){this.snap=true;this.yaw=0;}
  impact(intensity:number){this.shake=Math.min(.32,intensity*.06);}
  update(dt:number,car:VehicleController,input:Controls,settings:Settings,alpha:number){
    this.clock+=dt;this.shake=damp(this.shake,0,6,dt);
    this.rot.copy(car.lastRotation).slerp(car.rotation,alpha);this.pos.lerpVectors(car.previous,car.position,alpha);
    // Smooth the mount offset in the moving car's frame. A world-space low-pass
    // filter would put the driver's eye behind the headrest at highway speed.
    if(!this.snap){this.displacement.subVectors(this.pos,this.lastCar);this.camera.position.add(this.displacement);this.aim.add(this.displacement);}
    this.lastCar.copy(this.pos);
    const speed=Math.abs(car.speed),internal=this.mode===2||this.mode===3;
    if(this.mode===4 || Math.abs(input.lookX)+Math.abs(input.lookY)>.1){
      this.yaw=clamp(this.yaw-input.lookX*dt*2,-Math.PI,Math.PI);this.pitch=clamp(this.pitch-input.lookY*dt,-.12,.91);
    }else this.yaw=damp(this.yaw,0,4,dt);
    this.ahead.set(0,0,-1).applyQuaternion(this.rot);
    const heading=Math.atan2(-this.ahead.x,-this.ahead.z);
    const carHeight=car.spec.height,cg=car.spec.cgHeight;
    if(internal){
      this.wanted.set(this.mode===3?(car.spec.cockpitX??-car.spec.width*.225):0,(this.mode===3?carHeight*.80:carHeight*.72)-cg,this.mode===3?(car.spec.cockpitZ??-.08):-car.spec.length*.36);
      this.wanted.z-=(.5-car.spec.frontWeight)*car.spec.wheelbase;
      this.wanted.applyQuaternion(this.rot).add(this.pos);
      this.target.set(-Math.sin(heading+this.yaw)*25,this.ahead.y*19+.15,-Math.cos(heading+this.yaw)*25).add(this.wanted);
    }else{
      const close=this.mode===1,show=this.mode===5;
      const len=show?9.1:close?settings.chaseDistance*.65:settings.chaseDistance;
      const angle=heading+this.yaw+(show?1.04+Math.sin(this.clock*.13)*.46:0);
      const height=show?1.65:close?settings.chaseHeight*.63:settings.chaseHeight;
      this.wanted.set(Math.sin(angle)*len,height+Math.sin(this.pitch-.19)*len+clamp(car.acceleration*.018,-.18,.2),Math.cos(angle)*len)
        .add(this.pos);
      this.target.copy(this.pos).addScaledVector(this.ahead,show?1.1:3.5+speed*.055);this.target.y+=close?.5:.68;
      this.anchor.copy(this.pos);this.anchor.y+=.65;
      const dir=this.focus.copy(this.wanted).sub(this.anchor),dist=dir.length();
      this.ray.origin=this.anchor;this.ray.dir=dir.normalize();
      const block=car.physics.world.castRay(this.ray,dist,false,undefined,groups(layers.vehicle,layers.wall|layers.ground));
      if(block)this.wanted.copy(this.anchor).addScaledVector(dir,Math.max(.6,block.timeOfImpact-.24));
    }
    const amount=this.snap?1:1-Math.exp(-dt*(internal?24:7.7));
    this.camera.position.lerp(this.wanted,amount);
    if(this.shake>.004){this.camera.position.x+=Math.sin(this.clock*67)*this.shake*dt*16;this.camera.position.y+=Math.cos(this.clock*83)*this.shake*dt*12;}
    this.aim.lerp(this.target,this.snap?1:1-Math.exp(-dt*(internal?21:10)));this.camera.lookAt(this.aim);
    const fov=settings.fov+(internal?-3:0)+Math.min(10,speed*.115);
    if(Math.abs(this.camera.fov-fov)>.02){this.camera.fov=damp(this.camera.fov,fov,4,dt);this.camera.updateProjectionMatrix();}
    this.snap=false;
  }
}
