import { mkdir,writeFile } from 'node:fs/promises';
import { Color,DoubleSide,Group,Mesh,MeshStandardMaterial } from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { GeometryBatch,mound,spar,type Point } from '../src/world/sceneryGeometry';
import { seeded } from '../src/core/math';
class BinaryReader {onloadend?:()=>void;result:unknown;readAsArrayBuffer(b:Blob){void b.arrayBuffer().then(d=>{this.result=d;this.onloadend?.();});}}
Object.assign(globalThis,{FileReader:BinaryReader});
const dir=new URL('../public/assets/world/',import.meta.url);await mkdir(dir,{recursive:true});
for(const low of [false,true]){
 const parts=new GeometryBatch(),random=seeded(9813),base=new Color('#93826b'),ring=new Color('#6e6255'),h=9.4;
 const trunk=(t:number):Point=>[.78*t*t+.18*Math.sin(t*Math.PI),h*t,.34*t*t];
 const rings=low?9:34;
 for(let i=0;i<rings;i++){
   const t=i/rings,n=(i+1)/rings,rad=.24-.095*t+.062*Math.exp(-t*14);
   spar(parts,trunk(t),trunk(n),rad,rad-.005,base.clone().offsetHSL(0,0,random()*.05-.025),low?7:11);
   if(!low&&i>1)spar(parts,trunk(t),trunk(t+.006),rad+.018,rad+.008,ring,10);
 }
 const tip=trunk(1);
 for(let i=0;i<12;i++)mound(parts,[tip[0]+(random()-.5)*.34,h-.47+random()*.67,tip[2]+(random()-.5)*.35],[.125,.29,.12],new Color('#79663e'),random()*6,5);
 const fronds=low?12:22;
 for(let f=0;f<fronds;f++){
   const a=f*2.39996+random()*.3,len=2.7+random()*1.8,up=.45+random()*1.5,droop=.70+random()*2.15;
   const dx=Math.cos(a),dz=Math.sin(a),bend=(random()-.5)*.8;
   const point=(t:number):Point=>[tip[0]+dx*len*t-dz*bend*t*t,h+.12+up*Math.sin(t*Math.PI*.91)-droop*t*t,tip[2]+dz*len*t+dx*bend*t*t];
   const leaves=low?9:22,color=new Color().setHSL(.214+random()*.033,.30+random()*.15,.18+random()*.10);
   for(let i=0;i<leaves;i++){
     const t=i/leaves,end=(i+1)/leaves,p=point(t),q=point(end);
     spar(parts,p,q,.033*(1-t)+.005,.029*(1-end)+.003,new Color('#777b3e'),low?3:4);
     for(const side of [-1,1]){
       const u=(i+.32)/leaves,start=point(u);
       const reach=(.12+.74*Math.sin(Math.PI*u)**.62)*(1.0+random()*.2);
       const reachForward=.20+.26*u,blade=low?.143:.077;
       const endP:Point=[start[0]+dx*reachForward-dz*reach*side,start[1]-.10-reach*.45, start[2]+dz*reachForward+dx*reach*side];
       const mid:Point=[(start[0]+endP[0])/2,(start[1]+endP[1])/2+.065,(start[2]+endP[2])/2];
       const tint=color.clone().offsetHSL(0,0,random()*.035);
       const A=parts.vertex(start,tint),B=parts.vertex([mid[0]-dx*blade,mid[1],mid[2]-dz*blade],tint),
         C=parts.vertex(endP,tint),D=parts.vertex([mid[0]+dx*blade,mid[1]+.029,mid[2]+dz*blade],tint);
       parts.face(A,B,C,D);
     }
   }
 }
 const root=new Group();const m=new Mesh(parts.finish(),new MeshStandardMaterial({vertexColors:true,side:DoubleSide,roughness:.89}));m.name='CanaryPalm';root.add(m);
 const data=await new GLTFExporter().parseAsync(root,{binary:true});await writeFile(new URL(low?'palm-lod.glb':'palm.glb',dir),new Uint8Array(data as ArrayBuffer));
}
