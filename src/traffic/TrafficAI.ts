import { clamp } from '../core/math';

export interface Driver { cruise:number; gap:number; accel:number; braking:number; incentive:number; length:number }
export const drivers:Record<'cautious'|'normal'|'assertive'|'heavy',Driver>={
  cautious:{cruise:23,gap:1.9,accel:1.4,braking:2.1,incentive:1.4,length:2.5},
  normal:{cruise:28,gap:1.5,accel:1.9,braking:2.6,incentive:.7,length:2.2},
  assertive:{cruise:34,gap:1.15,accel:2.7,braking:3.1,incentive:.38,length:1.9},
  heavy:{cruise:21,gap:2.25,accel:1.05,braking:1.8,incentive:1.75,length:3.8},
};
export interface Occupant { id:number; s:number; speed:number; length:number; driver:Driver; cruise:number }
export function follow(me:Occupant,lead?:Occupant) {
  const d=me.driver,v=Math.max(0,me.speed);
  const desired=d.length+Math.max(0,v*d.gap+(lead?v*(v-lead.speed)/(2*Math.sqrt(d.accel*d.braking)):0));
  const available=lead?Math.max(.25,lead.s-me.s-(me.length+lead.length)*.5):Infinity;
  return clamp(d.accel*(1-(v/Math.max(4,me.cruise))**4-(desired/available)**2),-9,d.accel);
}
export class LaneIndex {
  lanes:Occupant[][];
  constructor(count:number){this.lanes=Array.from({length:count},()=>[]);}
  clear(){for(const lane of this.lanes)lane.length=0;}
  add(lane:number,car:Occupant){this.lanes[lane]?.push(car);}
  sort(){for(const lane of this.lanes)lane.sort((a,b)=>a.s-b.s);}
  neighbors(lane:number,me:Occupant) {
    let back:Occupant|undefined,front:Occupant|undefined;
    for(const c of this.lanes[lane]??[]){if(c.id===me.id)continue;if(c.s<me.s)back=c;else{front=c;break;}}
    return {front,back};
  }
  choose(lane:number,me:Occupant,current:number) {
    let best=lane,bestGain=me.driver.incentive;
    for(const next of [lane-1,lane+1]){
      if(next<0||next>=this.lanes.length)continue;
      const {front,back}=this.neighbors(next,me);
      if(front&&front.s-me.s-(me.length+front.length)/2<Math.max(7,me.speed*.83))continue;
      if(back&&me.s-back.s-(me.length+back.length)/2<Math.max(8,back.speed*.95+(back.speed-me.speed)*2.3))continue;
      const after=back?follow(back,me):0;
      if(after < -3.1)continue;
      const courtesy=back?Math.min(0,after-follow(back,front))*.28:0;
      const gain=follow(me,front)-current+courtesy+(next>lane?.15:0);
      if(gain>bestGain){best=next;bestGain=gain;}
    }
    return best;
  }
}
