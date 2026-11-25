import { BufferGeometry,DataTexture,Group,LinearFilter,Mesh,MeshBasicMaterial,MeshPhysicalMaterial,MeshStandardMaterial,Object3D,PlaneGeometry,type Material } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { Driver } from './Driver';
import { buildWheel } from './bodywork';
import { getVehicle,type VehicleSpec } from './catalogue';
export { getVehicle,vehicles,trafficVehicles,type VehicleSpec } from './catalogue';
export interface ModelOptions {paint?:string;metallic?:number;wheelStyle?:number;wheelColor?:string;traffic?:boolean;ride?:number;roadShadow?:boolean;driver?:boolean}
export interface VehicleModel {
  driver?:Driver;root:Group;wheels:Object3D[];wheelRollers:Object3D[];steeringWheel:Object3D;
  setLights(braking:boolean,left:boolean,right:boolean,headlights:boolean):void;
  customize(options:ModelOptions):void;setDetail(far:boolean):void;dispose():void;
}
const loader=new GLTFLoader(),templates=new Map<string,Group>(),loading=new Map<string,Promise<void>>();
const rims=new Map<string,BufferGeometry>();
const sharedWheel=new MeshStandardMaterial({vertexColors:true,metalness:.4,roughness:.39});
const empty=new BufferGeometry();
const shadowPlane=new PlaneGeometry(1,1).rotateX(-Math.PI/2);
let shadowMaterial:MeshBasicMaterial|undefined;
function footprint(){
  if(shadowMaterial)return shadowMaterial;
  const n=64,bytes=new Uint8Array(n*n*4);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const dx=Math.abs((x+.5)/n*2-1),dz=Math.abs((y+.5)/n*2-1);
    const radius=(dx**4+dz**4)**.25,idx=(y*n+x)*4;
    bytes[idx]=bytes[idx+1]=bytes[idx+2]=255;bytes[idx+3]=Math.round(184*Math.max(0,Math.min(1,(1-radius)*3))**1.4);
  }
  const tex=new DataTexture(bytes,n,n);tex.magFilter=tex.minFilter=LinearFilter;tex.needsUpdate=true;
  return shadowMaterial=new MeshBasicMaterial({map:tex,color:'#13191a',transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
}
const animated=new Set(['paint','rim','rimDark','head','brake','signal','turnL','turnR']);
async function loadOne(spec:VehicleSpec,low:boolean){
  if(low&&spec.assetFile)return;
  const key=spec.id+(low?'-lod':'');if(templates.has(key))return;
  const waiting=loading.get(key);if(waiting)return waiting;
  const path=spec.assetFile??'/assets/vehicles/'+key+'.glb';
  const promise=loader.loadAsync(path).then(result=>{
    const group=result.scene;
    group.traverse(obj=>{if(obj instanceof Mesh){
      obj.castShadow=true;obj.receiveShadow=true;
      if(obj.material.name==='glass'){obj.castShadow=false;obj.material.depthWrite=false;}
      if(obj.material.name==='paint'&&!(obj.material instanceof MeshPhysicalMaterial)){
        obj.material=new MeshPhysicalMaterial({name:'paint',color:obj.material.color,roughness:.225,metalness:.83,clearcoat:1,clearcoatRoughness:.12});
      }
    }});
    templates.set(key,group);
  }).finally(()=>loading.delete(key));
  loading.set(key,promise);return promise;
}
export async function preloadVehicles(ids:string[]){
  await Promise.all([...new Set(ids)].flatMap(id=>{const s=getVehicle(id);return [loadOne(s,false),loadOne(s,true)];}));
}
function rim(spec:VehicleSpec,style:number,color:string){
  const key=[spec.id,style,color].join('.');
  let geom=rims.get(key);
  if(!geom){const original=buildWheel(spec,color,true,style);geom=mergeVertices(original);original.dispose();rims.set(key,geom);}
  return geom;
}
export function createVehicleModel(spec:VehicleSpec,options:ModelOptions={}):VehicleModel {
  const high=templates.get(spec.id);if(!high)throw new Error('Unloaded vehicle asset: '+spec.id);
  const root=new Group();root.name=spec.name;
  if(options.traffic||options.roadShadow){const shadow=new Mesh(shadowPlane,footprint());shadow.name='Contact shadow';shadow.scale.set(spec.width*1.27,1,spec.length*1.08);shadow.position.y=.026;root.add(shadow);}
  const detailed=high.clone(true);root.add(detailed);
  const fineControls=detailed.getObjectByName('CockpitControls');
  if(options.traffic&&fineControls)fineControls.visible=false;
  const farTemplate=options.traffic?templates.get(spec.id+'-lod'):undefined;
  const far=farTemplate?.clone(true);if(far){far.visible=false;root.add(far);}
  const locals=new Map<Material,MeshStandardMaterial>(),byName=new Map<string,MeshStandardMaterial[]>();
  root.traverse(obj=>{
    if(!(obj instanceof Mesh)||!animated.has(obj.material.name))return;
    const original=obj.material as MeshStandardMaterial;let m=locals.get(original);
    if(!m){m=original.clone();locals.set(original,m);const arr=byName.get(m.name)??[];arr.push(m);byName.set(m.name,arr);}
    obj.material=m;
  });
  const wheels:Object3D[]=[],rollers:Object3D[]=[],custom:Object3D[]=[],factories:Object3D[][]=[];
  for(const [i,n] of ['FL','FR','RL','RR'].entries()){
    const hub=detailed.getObjectByName(n);if(!hub)throw new Error(spec.id+' missing '+n);
    const group=new Group();group.name='Spin'+n;
    const originals=hub.children.filter(part=>!part.name.startsWith('BrakeCaliper'));
    // GLTFLoader uses a Mesh node itself for a wheel with a single primitive.
    if(hub instanceof Mesh){
      const surface=new Mesh(hub.geometry,hub.material);surface.castShadow=surface.receiveShadow=true;
      group.add(surface);hub.geometry=empty;originals.push(surface);
    }
    for(const o of originals)group.add(o);
    const option=new Mesh(empty,sharedWheel);option.visible=false;option.castShadow=true;option.rotation.y=i%2===0?Math.PI:0;group.add(option);
    factories.push(originals);custom.push(option);hub.add(group);wheels.push(hub);rollers.push(group);
  }
  const steering=detailed.getObjectByName('Steering')??new Group();
  const driver=options.driver ? new Driver(steering.position,spec.height,spec.cockpitZ??steering.position.z+.424) : undefined;
  if(driver)detailed.add(driver.root);
  let style=0,finish='#686b6a',flags=-1;
  function apply(o:ModelOptions){
    if(o.paint||o.metallic!==undefined)for(const m of byName.get('paint')??[]){if(o.paint)m.color.set(o.paint);if(o.metallic!==undefined){m.metalness=o.metallic;m.roughness=.31-.105*o.metallic;}}
    if(o.wheelColor||o.wheelStyle!==undefined){
      style=o.wheelStyle??style;finish=o.wheelColor??finish;
      const replace=style!==0||(!spec.assetFile&&finish!=='#686b6a');
      for(const m of byName.get('rim')??[])m.color.set(finish);
      for(let i=0;i<4;i++){
        for(const node of factories[i])node.visible=!replace;
        (custom[i] as Mesh).visible=replace;if(replace)(custom[i] as Mesh).geometry=rim(spec,style,finish);
      }
    }
    if(o.ride!==undefined){detailed.position.y=o.ride;for(const wheel of wheels)wheel.position.y=spec.wheelRadius-o.ride;}
  }
  const lamp=(name:string,color:string,level:number)=>{for(const m of byName.get(name)??[]){m.emissive.set(color);m.emissiveIntensity=level;}};
  function lights(brake:boolean,left:boolean,right:boolean,head:boolean){
    const code=+brake+2*(+left)+4*(+right)+8*(+head);if(code===flags)return;flags=code;
    lamp('brake','#ff2419',brake?2.6:head?.65:.19);lamp('head','#fff1ce',head?3.8:.19);
    lamp('turnL','#ff9d16',left?3:.01);lamp('turnR','#ff9d16',right?3:.01);lamp('signal','#ff9d16',left||right?3:.01);
  }
  apply({...options,paint:options.paint??spec.defaultPaint});lights(false,false,false,false);
  return {driver,root,wheels,wheelRollers:rollers,steeringWheel:steering,setLights:lights,customize:apply,
    setDetail(low){if(far){far.visible=low;detailed.visible=!low;}},
    dispose(){root.removeFromParent();for(const mat of locals.values())mat.dispose();root.clear();}};
}
