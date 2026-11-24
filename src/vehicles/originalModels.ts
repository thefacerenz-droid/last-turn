import { Group, Mesh, MeshStandardMaterial, MeshPhysicalMaterial, type BufferGeometry } from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildShell,buildWheel,buildCaliper } from './bodywork';
import { box,oval } from './geometry';
import { buildCabin } from './cabin';
import type { VehicleSpec } from './catalogue';

function material(name:string,color:string,metalness:number,roughness:number){
  const m=new MeshStandardMaterial({color,metalness,roughness,vertexColors:true});m.name=name;return m;
}
export function originalModel(s:VehicleSpec,lod=false){
  const root=new Group();root.name=s.id;
  const shell=buildShell(s,lod),p=new MeshPhysicalMaterial({color:'#c0c2c1',metalness:.8,roughness:.25,clearcoat:1,clearcoatRoughness:.13,vertexColors:true});p.name='paint';
  const glass=new MeshPhysicalMaterial({color:'#344c55',metalness:.24,roughness:.095,transparent:!lod,opacity:lod?1:.63,depthWrite:false,clearcoat:1,vertexColors:true});glass.name='glass';
  function add(g:BufferGeometry,m:MeshStandardMaterial,parent:Group=root){
    const merged=mergeVertices(g,.00008);g.dispose();
    const mesh=new Mesh(merged,m);mesh.name=m.name;parent.add(mesh);return mesh;
  }
  if(s.design==='pickup'||s.design==='freight'){
    const l=s.length,w=s.width,h=s.height;
    if(s.design==='freight'){
      box(shell.trim,[0,h*.58,l*.188],[w*.975,h*.79,l*.58],0xbabbaf,[0,0,0],.075);
      for(const side of [-1,1])for(let i=0;i<16;i++)box(shell.trim,[side*w*.487,h*.59,l*(-.086+i*.036)],[.016,h*.63,.022],0x8b9089);
    }else{
      box(shell.trim,[0,h*.45,l*.27],[w*.93,.07,l*.42],0x383b36);
      for(const side of [-1,1])box(shell.paint,[side*w*.455,h*.55,l*.27],[.105,h*.22,l*.44],0xffffff,[0,0,0],.03);
      box(shell.paint,[0,h*.55,l*.476],[w*.94,h*.2,.091],0xffffff,[0,0,0],.028);
    }
  }
  const driverCar=s.cockpitZ!==undefined;
  if(!lod&&!driverCar){
    for(const side of [-1,1]){
      const x=side*s.width*.223;const z=s.design==='grand'?.33:s.design==='exotic'?-.14:.03;
      box(shell.trim,[x,s.height*.289,z],[s.width*.251,.17,.51],0x3a3631,[-.10,0,0],.068);
      box(shell.trim,[x,s.height*.53,z+.22],[s.width*.241,s.height*.43,.114],0x373832,[.14,0,0],.069);
      oval(shell.trim,[x,s.height*.72,z+.26],[.123,.105,.056],0x353733);
      for(const edge of [-1,1])box(shell.trim,[x+edge*.148,s.height*.471,z+.15],[.06,.29,.14],0x45433b,[.16,0,0],.028);
    }
    const dashZ=s.length*(s.design==='grand'?.018:s.design==='midengine'||s.design==='exotic'?-.16:-.079);
    box(shell.trim,[0,s.height*.568,dashZ],[s.width*.737,s.height*.114,s.length*.091],0x303432,[.06,0,0],.042);
    box(shell.trim,[0,s.height*.23,.03],[s.width*.79,.045,s.length*.43],0x262725);
    box(shell.trim,[0,s.height*.327,0],[.19,.24,.68],0x393b38,[0,0,0],.044);
    for(let i=0;i<4;i++)box(shell.trim,[i*.05-.30,s.height*.615,dashZ+.072],[.035,.025,.022],0x91aba0);
  }
  add(shell.paint.finish(),p);add(shell.glass.finish(),glass);
  add(shell.trim.finish(),material('trim','#ffffff',.31,.43));
  for(const [b,name,c] of [[shell.head,'head','#d3e0db'],[shell.tail,'brake','#a92c27'],[shell.left,'turnL','#b66b23'],[shell.right,'turnR','#b66b23']] as const)add(b.finish(),material(name,c,.23,.22));
  if(!lod&&driverCar){
    const cabin=buildCabin(s);root.add(cabin.shell,cabin.steering);
  }else{
    const steer=new Group();steer.name='Steering';root.add(steer);
  }
  const wheel=buildWheel(s,'#777c7c',!lod),wheelMat=material('factoryWheel','#ffffff',.37,.43);
  const wheelGeo=mergeVertices(wheel,.00008);wheel.dispose();
  const caliper=!lod&&driverCar?buildCaliper(s):null;
  for(const [i,name] of ['FL','FR','RL','RR'].entries()){
    const pivot=new Group();pivot.name=name;pivot.position.set((i%2?-1:1)*-s.track/2,s.wheelRadius,(i<2?-1:1)*s.wheelbase/2);
    const tire=new Mesh(wheelGeo,wheelMat);tire.name='wheelSurface';if(i%2===0)tire.rotation.y=Math.PI;pivot.add(tire);
    if(caliper){const brake=new Mesh(caliper,wheelMat);brake.name='BrakeCaliper'+name;brake.rotation.y=tire.rotation.y;pivot.add(brake);}
    root.add(pivot);
  }
  return root;
}
