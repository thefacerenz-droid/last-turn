import { readLocal, saveLocal } from '../settings/SettingsManager';
import type { VehicleController } from '../physics/VehicleController';
import type { TrafficCar } from '../traffic/TrafficManager';
import type { RouteId } from '../world/roads';
export interface RecordRun {id:string;score:number;seconds:number;distance:number;maxSpeed:number;passes:number;car:string;route:RouteId;date:string}
export const recordKey='coastline.records.1';
export function records():RecordRun[]{const data=readLocal<RecordRun[]>(recordKey,[]);return Array.isArray(data)?data.filter(r=>r&&typeof r.score==='number'&&typeof r.car==='string').sort((a,b)=>b.score-a.score).slice(0,15):[];}
export class ScoringManager {
  score=0;combo=1;time=0;distance=0;maxSpeed=0;passes=0;message='';messageUntil=0;
  private previous=new Map<number,{s:number;gap:number}>();
  private clean=0;private lastPass=-20;private lastImpact=-5;
  private id=Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  step(dt:number,car:VehicleController,traffic:readonly TrafficCar[]){
    this.time+=dt;this.clean+=dt;
    const speed=Math.abs(car.speed);this.distance+=speed*dt;this.maxSpeed=Math.max(this.maxSpeed,speed);
    if(this.time-this.lastPass>9)this.combo=1;
    if(car.speed>31 && this.clean>6 && car.wheels.every(w=>w.planted&&Math.abs(w.lateralSlip)<.17))this.score+=dt*(car.speed-30)*.32*this.combo;
    for(const c of traffic){
      const delta=c.s-car.s;const side=Math.abs(c.x-car.position.x)-(c.spec.width+car.spec.width)*.5;
      let track=this.previous.get(c.id);
      if(!track){if(delta>0&&delta<45)this.previous.set(c.id,{s:delta,gap:Infinity});continue;}
      if(Math.abs(delta)<(c.length+car.spec.length)*.5)track.gap=Math.min(track.gap,side);
      if(track.s>-(c.length+car.spec.length)*.5 && delta<=-(c.length+car.spec.length)*.5){
        if(this.clean>1.6&&car.speed>c.speed+2.2&&car.speed>12&&track.gap>-.05&&track.gap<6.2){
          const close=track.gap<1.35;
          this.combo=this.time-this.lastPass<9?Math.min(5,this.combo+.5):1;
          const points=Math.round((close?220:95)*this.combo*(1+Math.min(.8,(car.speed-12)/85)));
          this.score+=points;this.passes++;this.lastPass=this.time;
          this.message=(close?'Close pass':'Clean overtake')+'  +'+points;this.messageUntil=this.time+2.25;
        }
        this.previous.delete(c.id);
      }else track.s=delta;
    }
    if(this.previous.size>traffic.length*2+12){const active=new Set(traffic.map(c=>c.id));for(const key of this.previous.keys())if(!active.has(key))this.previous.delete(key);}
  }
  impact(){if(this.time-this.lastImpact<.7)return;this.lastImpact=this.time;this.combo=1;this.clean=0;this.lastPass=-20;this.message='Contact · streak ended';this.messageUntil=this.time+2.1;}
  resetCar(){this.previous.clear();this.impact();}
  save(car:string,route:RouteId){
    if(this.time<1||this.distance<8)return;
    const run:RecordRun={id:this.id,score:Math.floor(this.score),seconds:this.time,distance:this.distance,maxSpeed:this.maxSpeed,passes:this.passes,car,route,date:new Date().toISOString()};
    const all=records().filter(r=>r.id!==this.id);all.push(run);all.sort((a,b)=>b.score-a.score);saveLocal(recordKey,all.slice(0,15));
  }
}
