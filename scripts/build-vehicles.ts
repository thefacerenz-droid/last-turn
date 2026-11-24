import { mkdir,writeFile } from 'node:fs/promises';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { vehicles,trafficVehicles } from '../src/vehicles/catalogue';
import { originalModel } from '../src/vehicles/originalModels';
// GLTFExporter uses FileReader for Blob data. Node already supplies the Blob API.
class BinaryReader {
  onloadend?:()=>void;result:unknown;
  readAsArrayBuffer(b:Blob){void b.arrayBuffer().then(data=>{this.result=data;this.onloadend?.();});}
}
Object.assign(globalThis,{FileReader:BinaryReader});
const dir=new URL('../public/assets/vehicles/',import.meta.url);await mkdir(dir,{recursive:true});
const all=new Map([...vehicles,...trafficVehicles].map(s=>[s.id,s]));
const authored=[...all.values()].filter(s=>!s.assetFile);
for(const s of authored){
  for(const low of [false,true]){
    const g=originalModel(s,low);const bytes=await new GLTFExporter().parseAsync(g,{binary:true,onlyVisible:false});
    await writeFile(new URL(s.id+(low?'-lod':'')+'.glb',dir),new Uint8Array(bytes as ArrayBuffer));
  }
}
console.log('Wrote high and distance GLBs for '+authored.length+' original vehicle models.');
