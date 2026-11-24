import { Batch, bead, box, cylinder, oval, type Point } from './geometry';
import type { Shell } from './bodywork';
import type { VehicleSpec } from './specs';

type Outline = [number,number][];
type End = -1|1;
export type BodySide = (side:number,t:number,height:number)=>Point;
export type BodyDeck = (side:number,t:number,width:number)=>Point;
const charcoal=0x20262a, mesh=0x11171b, rib=0x525c60, alloy=0xa5aaab;

// Bumper apertures and light clusters are drawn on the same metre-scale end surface
// as the shell. The final compound curvature wraps all their edges onto the shoulders.
function face(s:VehicleSpec,end:End,x:number,y:number,standing=0):Point {
  return [x*s.width*.5,y*s.height,end*(s.length*.5+standing)];
}
function panel(batch:Batch,s:VehicleSpec,end:End,outline:Outline,standing:number,tint:number) {
  const p=outline.map(([x,y])=>face(s,end,x,y,standing));
  const mid:Point=[p.reduce((sum,q)=>sum+q[0],0)/p.length,p.reduce((sum,q)=>sum+q[1],0)/p.length,p[0][2]];
  const winding=outline.reduce((a,q,i)=>{const next=outline[(i+1)%outline.length];return a+q[0]*next[1]-q[1]*next[0];},0);
  for(let i=0;i<p.length;i++){
    const next=(i+1)%p.length;
    batch.triangle(mid,p[winding*end>0?i:next],p[winding*end>0?next:i],tint);
  }
}
function stroke(batch:Batch,s:VehicleSpec,end:End,path:Outline,standing:number,radius:number,tint:number) {
  bead(batch,path.map(([x,y])=>face(s,end,x,y,standing)),radius,tint);
}
function frontLamps(out:Shell,s:VehicleSpec,low:boolean) {
  const muscle=s.design==='muscle',vintage=s.design==='fastback',angular=s.design==='exotic'||s.design==='midengine';
  const base=vintage?.368:angular?.276:muscle?.397:s.body==='coupe'?.343:.389;
  const delta=s.design==='grand'?.023:angular?.078:.036;
  for(const side of [-1,1]){
    const indicator=side<0?out.left:out.right;
    if(muscle||vintage){
      const lamps=muscle?[.56,.75]:[.69];
      for(const pos of lamps){
        const x=pos*s.width*.5*side,z=-s.length*.5;
        const r=vintage?.097:.066;
        oval(out.trim,[x,base*s.height,z-.010],[r*1.11,r,.018],mesh);
        if(!low){
          cylinder(out.trim,[x,base*s.height,z-.026],r*.82,.012,alloy,[Math.PI/2,0,0],22);
          cylinder(out.trim,[x,base*s.height,z-.034],r*.74,.011,0x373e40,[Math.PI/2,0,0],22);
        }
        const arc=Array.from({length:12},(_,i):Point=>{
          const a=-2.54+i*.45;
          return [x+Math.sin(a)*r*.72,base*s.height+Math.cos(a)*r*.65,z-.043];
        });
        bead(out.head,arc,low?.010:.006,0xe9f0f0);
        oval(out.head,[x,base*s.height,z-.043],[r*.34,r*.32,.009],0xbfcdd0);
      }
    }else{
      const coords:Outline=[[.40,base+.019],[.61,base+.031],[.80,base+delta],[.83,base+delta-.017],[.765,base-.032],[.59,base-.040],[.447,base-.015]];
      panel(out.trim,s,-1,coords.map(([x,y])=>[side*x,y]),.007,mesh);
      const brow:Outline=[[.432,base+.011],[.58,base+.019],[.71,base+.025+(angular?.015:0)],[.793,base+delta-.007]];
      stroke(out.head,s,-1,brow.map(([x,y])=>[side*x,y]),.016,low?.009:.007,0xe4eced);
      if(!low){
        for(const x of [.563,.675]){
          const [cx,cy,cz]=face(s,-1,side*x,base-.006,.017);
          cylinder(out.trim,[cx,cy,cz],.026,.013,alloy,[Math.PI/2,0,0],16);
          cylinder(out.trim,[cx,cy,cz-.008],.021,.009,0x29363b,[Math.PI/2,0,0],16);
          oval(out.head,[cx,cy,cz-.014],[.013,.012,.005],0xd2dfe4);
        }
      }
    }
    stroke(indicator,s,-1,[[side*.748,base-.024],[side*.804,base-.003]],.019,.0068,0xffffff);
  }
  return base;
}
function intakes(out:Shell,s:VehicleSpec,low:boolean,base:number) {
  const grand=s.design==='grand',muscle=s.design==='muscle',angular=s.design==='exotic'||s.design==='midengine';
  const center=grand?.55:muscle?.52:s.design==='kaido'?.55:angular?.46:.43;
  const top=grand?base+.010:muscle?base+.045:base-.017, bottom=grand?.203:muscle?.25:.172;
  const mouth:Outline=[[-center*.89,top],[-center,top-.031],[-center*.89,bottom+.024],[-center*.72,bottom],[center*.72,bottom],[center*.89,bottom+.024],[center,top-.031],[center*.89,top]];
  panel(out.trim,s,-1,mouth,.009,mesh);
  if(!low){
    stroke(out.trim,s,-1,[...mouth,mouth[0]],.014,grand||muscle?.007:.005,grand?alloy:charcoal);
    for(let i=1;i<=4;i++){
      const y=bottom+(top-bottom)*i/5,w=center*(.73+.15*i/5);
      stroke(out.trim,s,-1,[[-w,y+.003],[-w*.4,y],[w*.4,y],[w,y+.003]],.015,.0038,grand?alloy:rib);
    }
    if(s.design==='touring'||s.design==='sedan'){
      for(const x of [-.014,.014])stroke(out.trim,s,-1,[[x,top-.005],[x,bottom+.004]],.019,.005,alloy);
    }
  }
  for(const side of [-1,1]){
    const duct:Outline=[[.505,.257],[.71,.282+(angular?.018:0)],[.80,.260],[.733,.171],[.526,.170],[.49,.189]];
    panel(out.trim,s,-1,duct.map(([x,y])=>[x*side,y]),.008,charcoal);
    if(!low){
      for(let i=0;i<3;i++)stroke(out.trim,s,-1,[[side*.536,.189+i*.021],[side*.70,.193+i*.024],[side*.746,.204+i*.020]],.013,.0035,rib);
    }
  }
  stroke(out.trim,s,-1,[[-.82,.153],[-.54,.133],[0,.130],[.54,.133],[.82,.153]],.021,.010,charcoal);
}

function registration(out:Shell,s:VehicleSpec,y:number) {
  const z=s.length*.5+.015;
  box(out.trim,[0,y,z],[.326,.115,.012],charcoal,[0,0,0],.005);
  box(out.trim,[0,y,z+.007],[.312,.101,.008],0xc7c9be,[0,0,0],.004);
  box(out.trim,[0,y+.035,z+.012],[.302,.012,.002],0x788b8e);
  const code=String(1000+Array.from(s.id).reduce((id,ch)=>(id*17+ch.charCodeAt(0))%8999,0)).padStart(4,'0');
  const forms=['abcdef','bc','abdeg','abcdg','bcfg','acdfg','acdefg','abc','abcdefg','abcdfg'];
  const segments=[[-.003,.017,.020,.002], [.009,.008,.003,.015],[.009,-.010,.003,.015],[-.003,-.02,.020,.002],
    [-.015,-.009,.003,.016],[-.015,.008,.003,.016],[-.003,-.002,.020,.003]];
  for(let i=0;i<4;i++)for(const mark of forms[Number(code[i])]){
    const [dx,dy,w,h]=segments[mark.charCodeAt(0)-97];
    box(out.trim,[dx+(i-1.5)*.043,y-.005+dy,z+.012],[w,h,.002],0x24343c);
  }
}

function rear(out:Shell,s:VehicleSpec,low:boolean) {
  const sport=s.design==='exotic'||s.design==='midengine', round=s.design==='kaido'||s.design==='muscle';
  const span=s.design==='fastback'||s.design==='estate'||s.design==='midengine',y=(sport?.420:.435);
  if(span){
    const band:Outline=[[-.80,y+.024],[-.55,y+.009],[0,y+.003],[.55,y+.009],[.80,y+.024]];
    stroke(out.trim,s,1,band,.009,.027,mesh);
    stroke(out.tail,s,1,band,.023,.010,0xec8b83);
  }
  for(const side of [-1,1]){
    const indicator=side<0?out.left:out.right;
    if(round){
      for(const u of [.54,.756]){
        const [x,cy,z]=face(s,1,u*side,y,.010);
        const r=s.design==='kaido'?(u>.6?.054:.073):.056;
        cylinder(out.trim,[x,cy,z],r+.009,.010,mesh,[Math.PI/2,0,0],22);
        cylinder(out.tail,[x,cy,z+.009],r,.010,0xe9a09d,[Math.PI/2,0,0],22);
        if(!low)cylinder(out.trim,[x,cy,z+.015],r*.58,.008,0x571d22,[Math.PI/2,0,0],20);
      }
    }else{
      const housing:Outline=[[.385,y+.022],[.635,y+.036],[.828,y+.053],[.832,y+.006],[.715,y-.025],[.486,y-.029],[.407,y-.017]];
      panel(out.trim,s,1,housing.map(([x,h])=>[x*side,h]),.014,mesh);
      const led:Outline=[[.415,y+.012],[.592,y+.019],[.733,y+.029],[.808,y+.039]];
      stroke(out.tail,s,1,led.map(([x,h])=>[x*side,h]),.021,.009,0xf0a298);
      if(!low)stroke(out.tail,s,1,[[side*.49,y-.012],[side*.645,y-.006],[side*.723,y+.001]],.023,.004,0xe18580);
    }
    stroke(indicator,s,1,[[side*.728,y-.014],[side*.803,y+.001]],.026,.005,0xffffff);
    if(!low){
      const ports=s.design==='kaido'||s.design==='muscle'?2:1;
      for(let i=0;i<ports;i++){
        const [x,cy,z]=face(s,1,side*(.649-i*.095),.171,.019);
        cylinder(out.trim,[x,cy,z],.039,.054,alloy,[Math.PI/2,0,0],18);
        cylinder(out.trim,[x,cy,z+.029],.031,.003,mesh,[Math.PI/2,0,0],16);
      }
    }
  }
  panel(out.trim,s,1,[[-.80,.225],[-.54,.242],[-.32,.203],[.32,.203],[.54,.242],[.80,.225],[.767,.135],[-.767,.135]],.007,charcoal);
  if(!low){
    for(const u of [-.42,-.21,0,.21,.42])box(out.trim,[u*s.width/2,s.height*.153,s.length*.486],[.014,.052,.134],0x262a2d);
    registration(out,s,s.height*.32);
  }
}

export function sportsExterior(out:Shell,s:VehicleSpec,low:boolean,sidePoint:BodySide,deckPoint:BodyDeck) {
  intakes(out,s,low,frontLamps(out,s,low));rear(out,s,low);
  const aero=s.design==='kaido'||s.design==='fastback'||s.design==='exotic';
  if(aero){
    for(const side of [-1,1])box(out.trim,[side*s.width*.278,s.height*.60,s.length*.385],[.052,.139,.107],0x303538,[-.12,0,0],.013);
    box(out.paint,[0,s.height*.656,s.length*.395],[s.width*.839,.040,.164],0xffffff,[-.09,0,0],.018);
  }
  if(low)return;
  const four=s.body==='sedan'||s.body==='estate';
  for(const side of [-1,1]){
    const cabinShift=s.design==='grand'?.078:s.design==='exotic'||s.design==='midengine'?-.046:0;
    const front=four?.29:.333+cabinShift,back=four?.531:.681+cabinShift;
    const door=(start:number,finish:number)=>{
      const path:Outline=[[start,.568],[start-.010,.514],[start-.014,.364],[start-.009,.239],[start+.016,.215],
        [finish-.035,.218],[finish-.010,.248],[finish+.005,.396],[finish,.532],[finish-.004,.574]];
      bead(out.trim,path.map(([t,y])=>sidePoint(side,t,y)),.0028,0x333a3c);
      const [x,y,z]=sidePoint(side,finish-.049,.498);
      box(out.trim,[x+side*.003,y,z],[.014,.021,.109],0x535859,[-.018,0,0],.006);
    };
    door(front,back);if(four)door(back+.004,.751);
    bead(out.trim,[.315,.367,.475,.606,.674].map((t,i)=>sidePoint(side,t,.189+Math.abs(i-2)*.007)),.006,charcoal);
    if(s.design==='exotic'||s.design==='midengine'){
      const shape:Outline=[[.591,.263],[.649,.382],[.717,.476],[.700,.393],[.684,.302],[.664,.259]];
      const start=sidePoint(side,.654,.343);
      for(let n=0;n<shape.length;n++){
        const p=sidePoint(side,...shape[n]),q=sidePoint(side,...shape[(n+1)%shape.length]);
        if(side<0)out.trim.triangle(start,p,q,mesh);else out.trim.triangle(start,q,p,mesh);
      }
      bead(out.trim,shape.slice(0,3).map(([t,y])=>sidePoint(side,t,y)),.006,0x555b5c);
      for(let n=0;n<3;n++)bead(out.trim,[[.633+n*.019,.285+n*.026],[.672+n*.009,.325+n*.034]].map(([t,y])=>sidePoint(side,t,y)),.0035,rib);
    }
    const hood=s.design==='grand'?.414:s.design==='exotic'||s.design==='midengine'?.251:.326;
    const seam:Outline=[[.033,.55],[.076,.55],[.13,.57],[.205,.62],[hood-.035,.67],[hood,.688]];
    bead(out.trim,seam.sort((a,b)=>a[0]-b[0]).map(([t,x])=>deckPoint(side,t,x)),.0027,0x4c5152);
    const tail:Outline=[[.848,.69],[.894,.73],[.950,.70],[.978,.61]];
    bead(out.trim,tail.map(([t,x])=>deckPoint(side,t,x)),.0028,0x4a4f50);
    if(s.design==='midengine'||s.design==='exotic'||s.design==='fastback'){
      for(let i=0;i<6;i++){
        const t=.774+i*.020;
        bead(out.trim,[.05,.26,.49,.59].map(u=>deckPoint(side,t,u)),.006,0x383d3e);
      }
    }
  }
  for(const end of [-1,1] as const){
    const arc:Outline=end>0?[[-.77,.369],[-.51,.354],[0,.345],[.51,.354],[.77,.369]]
      :[[-.78,.302],[-.635,.291],[-.52,.285]];
    stroke(out.trim,s,end,arc,.0035,.0028,0x41494b);
  }
}

export function wrapBumpers(out:Shell,s:VehicleSpec) {
  const half=s.width*.5, length=s.length, start=length*.345, distance=length*.155;
  for(const batch of Object.values(out) as Batch[]){
    const v=batch.positions,n=batch.normals;
    for(let i=0;i<v.length;i+=3){
      const x=v[i],y=v[i+1],z=v[i+2],abs=Math.abs(z);
      if(abs<=start)continue;
      const t=Math.min(1,(abs-start)/distance),w=t*t*(3-2*t),dw=6*t*(1-t)/distance;
      const end=Math.sign(z),amplitude=end<0?(s.design==='muscle'?.164:.261):.163;
      const u=x/half, lower=Math.max(0,1-y/(s.height*.42));
      const bend=amplitude*u*u+.063*lower*lower;
      const dzdx=-end*w*amplitude*2*u/half,dzdy=end*w*.126*lower/(s.height*.42),dzdz=1-dw*bend;
      v[i+2]=z-end*w*bend;
      const nz=n[i+2]/dzdz,nx=n[i]-dzdx*nz,ny=n[i+1]-dzdy*nz,inv=1/(Math.hypot(nx,ny,nz)||1);
      n[i]=nx*inv;n[i+1]=ny*inv;n[i+2]=nz*inv;
    }
  }
}
