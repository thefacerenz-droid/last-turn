import { LatheGeometry,TorusGeometry,Vector2 } from 'three';
import { Batch, box, cylinder, shape, type Point } from './geometry';
import type { VehicleSpec } from './specs';

const axis:Point=[0,0,-Math.PI/2], tau=Math.PI*2;
function tireHalfWidth(s:VehicleSpec){return Math.min(s.width-s.track,s.body==='coupe'?.265:.23)*.48;}

export function buildCaliper(s:VehicleSpec){
  const batch=new Batch(),half=tireHalfWidth(s),r=s.wheelRadius;
  const color=s.design==='kaido'||s.design==='midengine'?0xa24634:s.design==='exotic'?0x9a7346:0x535b5e;
  box(batch,[half*.79,.016,r*.507],[.044,r*.43,.059],color,[.20,0,0],.018);
  box(batch,[half*.835,.022,r*.477],[.037,r*.245,.045],color,[.20,0,0],.012);
  box(batch,[half*.994,.019,r*.494],[.003,.037,.008],0xb5b9b7,[.20,0,0]);
  return batch.finish();
}

export function buildWheel(s:VehicleSpec,rimColor:string,detailed:boolean,style=0){
  const b=new Batch(),r=s.wheelRadius,half=tireHalfWidth(s),face=half*1.012,segments=detailed?40:16;
  const shell=(cross:number[][],tint:number)=>{
    shape(b,new LatheGeometry(cross.map(([radius,axle])=>new Vector2(radius*r,axle*half)),segments),
      [0,0,0],[1,1,1],axis,tint);
  };
  shell([[.70,-.91],[.81,-1],[.92,-.97],[.987,-.80],[1,-.54],[1,.54],[.987,.80],[.92,.97],[.812,1],[.70,.93]],0x24272a);
  // An open alloy barrel lets the brake rotor and fixed caliper show between spokes.
  shell([[.686,-.91],[.710,-.90],[.731,.91],[.72,1.017],[.696,1.030],[.678,.972],[.674,-.89]],0x787f83);
  cylinder(b,[half*.55,0,0],r*.591,half*.082,0x777d7e,axis,segments);
  cylinder(b,[half*.634,0,0],r*.289,half*.12,0x3c4548,axis,segments);
  const point=(a:number,rad:number,x:number):Point=>[x,Math.cos(a)*rad*r,Math.sin(a)*rad*r];
  const ring=(rad:number,thickness:number,x:number,c:number)=>{
    shape(b,new TorusGeometry(rad*r,thickness,5,segments),[x,0,0],[1,1,1],[0,Math.PI/2,0],c);
  };
  if(detailed){
    ring(.705,.0065,face,0xa8aeb0);ring(.784,.0025,half*.992,0x3a3e40);
    ring(.537,.0016,half*.604,0x8f9495);ring(.492,.0013,half*.604,0x83888a);
    for(let i=0;i<20;i++)for(const radius of [.44,.545]){
      const a=i*tau/20+(radius<.5?.063:0),center=point(a,radius,half*.606),d=.0037;
      for(let j=0;j<6;j++){
        const t=j*tau/6,n=(j+1)*tau/6;
        b.triangle(center,[center[0],center[1]+Math.cos(t)*d,center[2]+Math.sin(t)*d],[center[0],center[1]+Math.cos(n)*d,center[2]+Math.sin(n)*d],0x2e3335);
      }
    }
  }
  const turbine=style===2||!style&&(s.design==='estate'||s.design==='sedan');
  const broad=style===1||!style&&(s.design==='muscle'||s.design==='grand');
  const count=turbine?10:broad?(style===1?7:5):s.design==='kaido'?6:5;
  // Bevel and dish each spoke in three dimensions rather than a flat triangle fan.
  function spoke(stations:number[][]){
    const ranks=stations.map(([a,rad,spread,x])=>[
      point(a-spread,rad,x-.010),point(a-spread*.83,rad,x+.001),
      point(a+spread*.75,rad,x+.004),point(a+spread,rad,x-.010),
    ]);
    for(let i=0;i<ranks.length-1;i++)for(let j=0;j<3;j++){
      const p=ranks[i][j],q=ranks[i+1][j],v=ranks[i+1][j+1],u=ranks[i][j+1];
      b.triangle(p,q,v,rimColor);b.triangle(p,v,u,rimColor);
    }
  }
  for(let i=0;i<count;i++){
    const a=i*tau/count;
    if(turbine||broad||!detailed){
      const curve=turbine?.194:broad?.079:.036;
      spoke([[a,.151,.23,face+.013],[a+curve*.21,.334,turbine?.125:.225,face],
        [a+curve*.72,.543,turbine?.076:.134,face-.010],[a+curve,.691,turbine?.045:.094,face-.003]]);
    }else{
      spoke([[a,.151,.242,face+.013],[a-.004,.302,.190,face+.001],[a+.012,.429,.132,face-.011]]);
      for(const sign of [-1,1])spoke([[a+sign*.027,.345,.119,face-.003],[a+sign*.103,.508,.075,face-.012],[a+sign*.183,.693,.050,face-.003]]);
    }
  }
  cylinder(b,[face+.013,0,0],r*.164,.023,rimColor,axis,20);
  cylinder(b,[face+.028,0,0],r*.067,.006,0x363d3f,axis,16);
  if(detailed){
    for(let i=0;i<5;i++)cylinder(b,point(i*tau/5,.112,face+.028),.0073,.009,0xb0b4b5,axis,6);
    box(b,point(.97,.690,face+.009),[.011,.014,.011],0x353a3b);
  }
  return b.finish();
}
