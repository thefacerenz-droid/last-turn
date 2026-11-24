import { Group, Mesh, MeshStandardMaterial } from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { Batch, bead, box, cylinder, oval, skin, type Point } from './geometry';
import { cabinDesign, instrumentMount } from './cabinLayout';
import type { VehicleSpec } from './catalogue';

const graphite = 0x252b2e;
const recess = 0x141a1c;
const tau = Math.PI * 2;

function finish(batch:Batch,name:string,metalness:number,roughness:number) {
  const raw=batch.finish(), geometry=mergeVertices(raw,.00008);
  raw.dispose();
  const material=new MeshStandardMaterial({name,vertexColors:true,metalness,roughness});
  const mesh=new Mesh(geometry,material);
  mesh.name=name;
  return mesh;
}

function seat(upholstery:Batch, fittings:Batch, spec:VehicleSpec, x:number, z:number) {
  const theme=cabinDesign(spec.design), h=spec.height;
  const bottom=h*.246, back=z+.23, half=Math.min(.248,spec.width*.13);
  // Separate sewn panels follow the compound curve of the bolsters and shoulder wings.
  const cushion=(u:number,v:number):Point=>[
    x+u*half*(.92+.08*Math.sin(v*Math.PI)),
    bottom+.045+.058*Math.abs(u)**2+.014*(1-v)+.011*Math.sin(v*Math.PI),
    z-.28+v*.50,
  ];
  const backrest=(u:number,v:number):Point=>[
    x+u*half*(.84+.17*Math.sin(v*Math.PI)-.12*v),
    bottom+.07+v*h*.372,
    back+v*.11-.020*Math.sin(v*Math.PI)-(.059+(theme.sport?.080:.041)*Math.sin(v*Math.PI))*(Math.abs(u)**1.8),
  ];
  const xs=[-1,-.97,-.81,-.61,-.55,-.32,0,.32,.55,.61,.81,.97,1];
  const ys=[0,.05,.17,.32,.50,.70,.86,.96,1];
  for(const surface of [cushion,backrest]){
    skin(ys.length,xs.length,(row,col)=>surface(xs[col],ys[row]),()=>upholstery,false,false,theme.inserts);
    for(const u of [-.9,-.58,.58,.9])bead(upholstery,ys.map(v=>surface(u,v)),Math.abs(u)<.7?.0032:.005,Math.abs(u)<.7?theme.accent:theme.leather);
    for(const v of [.25,.40,.55,.70,.85]){
      bead(upholstery,[-.54,-.27,0,.27,.54].map(u=>surface(u,v)),.0027,theme.leather);
    }
  }
  box(upholstery,[x,bottom+.004,z-.031],[half*1.97,.112,.51],theme.leather,[-.05,0,0],.047);
  box(upholstery,[x,bottom+h*.232,back+.068],[half*1.83,h*.40,.103],theme.leather,[.19,0,0],.050);
  for(const side of [-1,1]){
    oval(upholstery,[x+side*half*.85,bottom+.083,z-.022],[.044,.053,.216],theme.leather,[-.04,0,0]);
    oval(upholstery,[x+side*half*.84,bottom+h*.243,back-.038],[.053,h*.177,.055],theme.leather,[.17,0,side*.09]);
    cylinder(fittings,[x+side*.059,bottom+h*.447,back+.105],.009,.095,theme.metal,[0,0,0],8);
  }
  box(upholstery,[x,bottom+h*.505,back+.125],[half*1.18,h*.14,.112],theme.inserts,[.12,0,0],.044);
}

function vent(fittings:Batch, x:number,y:number,z:number, width:number, round:boolean,metal:number) {
  if(round){
    cylinder(fittings,[x,y,z],.046,.022,metal,[Math.PI/2,0,0],20);
    cylinder(fittings,[x,y,z+.014],.038,.012,recess,[Math.PI/2,0,0],20);
  }else{
    box(fittings,[x,y,z],[width,.059,.023],metal,[0,0,0],.008);
    box(fittings,[x,y,z+.012],[width-.012,.046,.011],recess);
  }
  for(let i=-1;i<=1;i++)box(fittings,[x,y+i*.012,z+.022],[round?.055:width-.020,.004,.009],0x717777,[.22,0,0]);
}

function addDash(spec:VehicleSpec, trim:Batch, upholstery:Batch, fittings:Batch) {
  const theme=cabinDesign(spec.design), m=instrumentMount(spec);
  const half=spec.width*.4, top=spec.height*.623, front=m.z-.15;
  // Sculpted cross-car fascia. The top falls away toward the glass and wraps around both doors.
  const cuts=[-1,-.91,-.76,-.58,-.43,-.29,-.16,0,.22,.45,.68,.87,1];
  const cross=[[.000,-.048],[.052,-.004],[.19,.007],[.232,-.017],[.242,-.051],[.218,-.132],[.162,-.159],[.050,-.145]];
  skin(cuts.length,cross.length,(row,col)=>{
    const u=cuts[row], [z,y]=cross[col];
    return [u*half,top+y+.013*u*u,front+z+.095*Math.abs(u)**2];
  },()=>trim,true,true,graphite);
  const band=(u:number,y:number):Point=>[u*half,top+y+.013*u*u,front+.235+.095*u*u];
  bead(upholstery,cuts.map(u=>band(u,-.084)),.014,theme.inserts);
  bead(fittings,cuts.map(u=>band(u,-.073)),.0038,theme.metal);
  // The cluster lens is inset under a hood; the live panel uses this same measured mount.
  box(trim,[m.x,m.y,m.z-.025],[m.width+.045,m.height+.034,.071],recess,[m.tilt,0,0],.016);
  box(fittings,[m.x,m.y,m.z+.009],[m.width+.012,m.height+.012,.011],0x555c5e,[m.tilt,0,0],.004);
  box(trim,[m.x,m.y+.001,m.z+.018],[m.width+.003,m.height+.003,.007],0x182023,[m.tilt,0,0],.003);
  const canopy:Point[]=[[-.56,.13],[-.52,.46],[-.40,.65],[0,.74],[.40,.65],[.52,.46],[.56,.13]]
    .map(([u,v])=>[m.x+u*m.width,m.y+v*m.height,m.z+.035]);
  bead(trim,canopy,.016,graphite);
  const round=spec.design==='grand'||spec.design==='fastback'||spec.design==='muscle';
  for(const u of [-.86,.20,.83])vent(fittings,u*half,top-.044,front+.247+.095*u*u,u===.20?.165:.128,round,theme.metal);
  const screenY=top-.055, screenX=-.025;
  box(trim,[screenX,screenY,front+.226],[.176,.108,.036],recess,[-.17,0,0],.014);
  box(fittings,[screenX,screenY,front+.248],[.151,.083,.008],0x253038,[-.17,0,0],.003);
  for(let i=0;i<4;i++)box(fittings,[screenX-.051+i*.034,screenY-.057,front+.248],[.020,.007,.009],theme.metal);
  for(const side of [-1,1])cylinder(fittings,[screenX+side*.058,screenY-.078,front+.251],.011,.019,theme.metal,[Math.PI/2,0,0],12);
}

function cabinHardware(spec:VehicleSpec,trim:Batch,upholstery:Batch,fittings:Batch) {
  const theme=cabinDesign(spec.design), z=spec.cockpitZ??theme.eyeZ, w=spec.width,h=spec.height;
  const centerZ=z-.045;
  box(trim,[0,h*.215,z],[w*.80,.052,1.68],0x292c2e,[0,0,0],.021);
  box(trim,[0,h*.32,centerZ],[w*.151,.24,.91],graphite,[-.07,0,0],.059);
  box(upholstery,[0,h*.408,centerZ+.257],[w*.123,.092,.298],theme.inserts,[-.05,0,0],.040);
  box(fittings,[0,h*.421,centerZ-.16],[.163,.014,.276],0x5a6060,[-.07,0,0],.006);
  box(trim,[0,h*.436,centerZ-.202],[.087,.013,.114],recess,[-.07,0,0],.004);
  cylinder(fittings,[0,h*.464,centerZ-.19],.011,.087,theme.metal,[.18,0,0],12);
  oval(upholstery,[0,h*.497,centerZ-.185],[.036,.035,.040],theme.leather,[.18,0,0]);
  cylinder(fittings,[0,h*.435,centerZ-.055],.030,.014,theme.metal,[-.07,0,0],16);
  cylinder(trim,[0,h*.445,centerZ-.055],.022,.006,graphite,[-.07,0,0],16);
  for(const side of [-1,1]){
    const x=side*w*.393;
    box(upholstery,[x,h*.446,z+.005],[.064,h*.262,.94],theme.leather,[0,0,side*.038],.030);
    box(upholstery,[x-side*.021,h*.449,z+.033],[.062,.064,.506],theme.inserts,[.065,0,0],.024);
    bead(fittings,[[x-side*.037,h*.50,z+.09],[x-side*.040,h*.509,z-.063],[x-side*.038,h*.536,z-.126]],.010,theme.metal);
    bead(upholstery,[[x-side*.035,h*.536,z+.359],[x-side*.035,h*.532,z+.11],[x-side*.035,h*.538,z-.14],[x-side*.028,h*.552,z-.311]],.0038,theme.accent);
    box(fittings,[x-side*.047,h*.457,z-.076],[.022,.007,.033],0x545c5d);
  }
  const eyeX=-w*.225;
  for(const [dx,pedalWidth,pedalHeight] of [[-.064,.073,.051],[.054,.041,.082]]){
    box(fittings,[eyeX+dx,h*.277,z-.728],[pedalWidth,pedalHeight,.020],theme.metal,[-.32,0,0],.008);
    for(let i=-1;i<=1;i++)box(trim,[eyeX+dx,h*.277+i*.011,z-.715],[pedalWidth*.82,.003,.006],graphite,[-.32,0,0]);
  }
  // Separate stalks and paddles stay at the column while the rim and switches rotate.
  const wheelZ=z-.424, wheelY=h*.570;
  cylinder(trim,[eyeX,wheelY,wheelZ-.114],.043,.175,graphite,[Math.PI/2-.16,0,0]);
  for(const side of [-1,1]){
    bead(trim,[[eyeX+side*.025,wheelY,wheelZ-.064],[eyeX+side*.086,wheelY+.013,wheelZ-.068],[eyeX+side*.131,wheelY+.026,wheelZ-.058]],.009,graphite);
    if(theme.sport)box(fittings,[eyeX+side*.096,wheelY+.04,wheelZ-.045],[.029,.079,.009],theme.metal,[.15,0,side*-.09],.004);
  }
}

function steeringWheel(spec:VehicleSpec) {
  const theme=cabinDesign(spec.design),wheel=new Group(),trim=new Batch(),switches=new Batch();
  wheel.name='Steering';
  wheel.position.set(-spec.width*.225,spec.height*.570,(spec.cockpitZ??theme.eyeZ)-.424);
  const radius=theme.sport?.158:.166,flat=theme.sport?.83:.96;
  const rim=(angle:number,offset=0):Point=>[Math.sin(angle)*(radius+offset),Math.max(-radius*flat,Math.cos(angle)*(radius+offset)),Math.cos(angle)*-.020];
  const path=Array.from({length:40},(_,i)=>rim(i/40*tau));
  bead(trim,path,.0185,theme.leather,true,true);
  for(const side of [-1,1]){
    const grip=Array.from({length:9},(_,i)=>rim(side*(.85+i*.10)));
    bead(trim,grip,.022,theme.inserts);
    bead(switches,[[side*.101,-.0045,.004],[side*.070,-.016,.010],[side*.026,-.028,.014]],.009,theme.metal);
    box(trim,[side*.073,.001,.003],[.087,.055,.031],graphite,[0,0,side*.13],.014);
    for(let i=0;i<3;i++)box(switches,[side*(.061+i*.009),.008,.021],[.005,.004,.002],0xbecccb);
  }
  if(theme.sport){
    bead(trim,[rim(-.081),rim(0),rim(.081)],.0196,theme.accent);
    for(const side of [-1,1])bead(switches,[[side*.023,-.032,.004],[side*.028,-.087,-.001],[side*.043,-radius*flat,-.010]],.009,theme.metal);
  }else{
    box(trim,[0,-.080,-.004],[.04,.096,.027],theme.leather,[0,0,0],.012);
  }
  oval(trim,[0,-.003,.013],[.064,.054,.027],graphite);
  box(switches,[0,-.002,.039],[.023,.006,.002],theme.metal);
  wheel.add(finish(trim,'SteeringLeather',.035,.68),finish(switches,'SteeringControls',.42,.38));
  return wheel;
}

export function buildCabin(spec:VehicleSpec) {
  const shell=new Group(), controls=new Group(), trim=new Batch(),leather=new Batch(),hardware=new Batch(),mirror=new Batch();
  const seats=new Batch(), seatTrim=new Batch(),theme=cabinDesign(spec.design);
  shell.name='Cabin'; controls.name='CockpitControls';
  for(const side of [-1,1])seat(seats,seatTrim,spec,side*spec.width*.225,(spec.cockpitZ??theme.eyeZ)+.04);
  // The wagon and sports sedan have a visible rear bench and outboard head restraints.
  if(spec.body==='sedan'||spec.body==='estate'){
    const rear=(spec.cockpitZ??theme.eyeZ)+.83;
    box(seats,[0,spec.height*.35,rear],[spec.width*.72,.125,.408],theme.inserts,[-.082,0,0],.056);
    box(seats,[0,spec.height*.50,rear+.16],[spec.width*.685,spec.height*.37,.122],theme.leather,[.22,0,0],.052);
    for(const side of [-1,1])box(seats,[side*spec.width*.22,spec.height*.675,rear+.211],[.211,.122,.081],theme.inserts,[.22,0,0],.040);
  }
  addDash(spec,trim,leather,hardware);
  cabinHardware(spec,trim,leather,hardware);
  const mirrorZ=(spec.cockpitZ??theme.eyeZ)-.396,mirrorY=spec.height*.907;
  bead(trim,[[0,mirrorY+.069,mirrorZ-.035],[0,mirrorY+.044,mirrorZ-.021],[0,mirrorY+.008,mirrorZ]],.010,graphite);
  box(trim,[0,mirrorY,mirrorZ],[.192,.059,.032],graphite,[.055,-.09,0],.013);
  box(mirror,[0,mirrorY,mirrorZ+.018],[.175,.044,.004],0xa4afb2,[.055,-.09,0],.002);
  shell.add(finish(seats,'SeatUpholstery',.018,.72),finish(seatTrim,'SeatHardware',.68,.33),
    finish(trim,'CabinMouldings',.04,.63),finish(leather,'CabinLeather',.019,.73));
  controls.add(finish(hardware,'CockpitHardware',.48,.36),finish(mirror,'CabinMirror',.93,.080));
  shell.add(controls);
  return {shell,steering:steeringWheel(spec)};
}
