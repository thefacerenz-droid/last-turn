import RAPIER from '@dimforge/rapier3d-compat/rapier.es.js';
import { Quaternion, Vector3 } from 'three';
import { STEP } from '../core/math';
import { roadAt, roadHeight, roadWalls, type RouteId } from '../world/roads';

export const layers = { ground:1, wall:2, vehicle:4 };
export const groups = (member:number, filter:number) => (member<<16)|filter;
const chunkLength=96;
const ready=RAPIER.init();
export class PhysicsWorld {
  readonly world=new RAPIER.World({x:0,y:-9.81,z:0});
  readonly queue=new RAPIER.EventQueue(true);
  private chunks=new Map<number,RAPIER.RigidBody>();
  private current=Infinity;
  static async create(route:RouteId){await ready;return new PhysicsWorld(route);}
  private constructor(readonly route:RouteId) {
    this.world.timestep=STEP;
    this.world.integrationParameters.maxCcdSubsteps=3;
    this.terrain(0);
  }
  terrain(s:number) {
    const center=Math.floor(s/chunkLength);
    if(this.current===center)return;
    this.current=center;
    for(const [id,body] of this.chunks) if(id<center-2||id>center+3){this.world.removeRigidBody(body);this.chunks.delete(id);}
    for(let i=center-2;i<=center+3;i++)if(!this.chunks.has(i))this.chunks.set(i,this.buildChunk(i));
  }
  private buildChunk(index:number) {
    const body=this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    const positions:number[]=[], indices:number[]=[];
    const widths=[-50,-28,-14,-7,0,7,14,18,22,26,30,34,38,44,52,80], rows=16;
    for(let row=0;row<=rows;row++){
      const s=chunkLength*(index+row/rows), road=roadAt(this.route,s);
      for(const offset of widths){const x=road.x+offset;positions.push(x,roadHeight(this.route,s,x),-s);}
      if(row<rows) for(let col=0;col<widths.length-1;col++){
        const a=row*widths.length+col,b=a+widths.length;
        indices.push(a,a+1,b,b,a+1,b+1);
      }
      if(row===rows)continue;
      const nextS=s+chunkLength/rows, nextRoad=roadAt(this.route,nextS);
      const nextWalls=roadWalls(this.route,nextS);
      for(const wall of roadWalls(this.route,s)){
        const other=nextWalls.find(w=>w.id===wall.id);if(!other)continue;
        const x1=road.x+wall.offset,x2=nextRoad.x+other.offset;
        const p=new Vector3(x1,roadHeight(this.route,s,x1)+.43,-s);
        const q=new Vector3(x2,roadHeight(this.route,nextS,x2)+.43,-nextS);
        const dir=q.clone().sub(p);
        const rot=new Quaternion().setFromUnitVectors(new Vector3(0,0,-1),dir.clone().normalize());
        const center=p.lerp(q,.5);
        this.world.createCollider(RAPIER.ColliderDesc.cuboid(.14,.48,dir.length()*.5+.018)
          .setTranslation(center.x,center.y,center.z).setRotation(rot).setFriction(.3)
          .setRestitution(.15).setCollisionGroups(groups(layers.wall,layers.vehicle)),body);
      }
    }
    this.world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(positions),new Uint32Array(indices))
      .setCollisionGroups(groups(layers.ground,layers.vehicle)).setFriction(.7),body);
    return body;
  }
  step(impact:(a:number,b:number,impulse:number)=>void) {
    this.world.step(this.queue);
    this.queue.drainContactForceEvents(event=>{
      const a=this.world.getCollider(event.collider1()),b=this.world.getCollider(event.collider2());
      if(!a||!b||((a.collisionGroups()>>>16)|(b.collisionGroups()>>>16))&layers.ground)return;
      const impulse=event.totalForceMagnitude()*STEP;
      if(impulse>170)impact(a.handle,b.handle,impulse);
    });
  }
  dispose(){this.queue.free();this.world.free();this.chunks.clear();}
}
