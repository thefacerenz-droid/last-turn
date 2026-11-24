import { ACESFilmicToneMapping, Color, DirectionalLight, Fog, HemisphereLight, PCFSoftShadowMap, PerspectiveCamera, PMREMGenerator, Scene, SpotLight, Vector3, WebGLRenderer, type WebGLRenderTarget } from 'three';
import type { Graphics, Lighting } from '../settings/SettingsManager';
import { damp } from '../core/math';
import { Sky, conditions } from './Sky';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { PostEffects } from './PostEffects';
import type { VehicleController } from '../physics/VehicleController';
export class RenderManager {
  readonly renderer:WebGLRenderer; readonly scene=new Scene(); readonly camera=new PerspectiveCamera(62,1,.09,1600);
  private sky:Sky;private sun=new DirectionalLight();private hemi=new HemisphereLight();
  private lamps=[new SpotLight('#fff1d6',0,105,.39,.55,1.6),new SpotLight('#fff1d6',0,105,.39,.55,1.6)];
  private pmrem:PMREMGenerator;private probe?:WebGLRenderTarget;private daylight?:WebGLRenderTarget;private post:PostEffects;
  private skyKey='';private dir=new Vector3();private look=new Vector3();private scratch=new Vector3();
  private w=0;private h=0;private pixel=0;private time:Lighting='golden';private graphics!:Graphics;
  constructor(canvas:HTMLCanvasElement,g:Graphics){
    this.renderer=new WebGLRenderer({canvas,antialias:false,alpha:false,powerPreference:'high-performance',stencil:false});
    this.renderer.toneMapping=ACESFilmicToneMapping;this.renderer.shadowMap.type=PCFSoftShadowMap;
    this.scene.background=new Color('#d4b99e');this.sky=new Sky(this.scene);
    this.sun.castShadow=true;this.sun.shadow.bias=-.0003;this.sun.shadow.normalBias=.045;
    this.scene.add(this.sun,this.sun.target,this.hemi);
    for(const l of this.lamps){this.scene.add(l,l.target);}
    this.pmrem=new PMREMGenerator(this.renderer);this.post=new PostEffects(this.renderer);this.setGraphics(g);
    new HDRLoader().load('/assets/lighting/coastal-dawn.hdr',texture=>{
      this.daylight=this.pmrem.fromEquirectangular(texture);this.sky.setPanorama(texture);this.skyKey='';this.setLighting(this.time);
    });
  }
  resize(){
    const canvas=this.renderer.domElement,w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight);
    const ratio=Math.min(window.devicePixelRatio||1,1.5)*this.graphics.scale;
    if(w===this.w&&h===this.h&&ratio===this.pixel)return;
    this.w=w;this.h=h;this.pixel=ratio;
    this.renderer.setPixelRatio(ratio);this.renderer.setSize(w,h,false);
    this.camera.aspect=w/h;this.camera.updateProjectionMatrix();
  }
  setGraphics(g:Graphics){
    this.graphics=g;const r=this.renderer;
    r.shadowMap.enabled=g.shadows>0;this.sun.visible=true;this.sun.castShadow=g.shadows>0;
    if(this.sun.shadow.mapSize.x!==g.shadows){
      this.sun.shadow.map?.dispose();this.sun.shadow.map=null;
      this.sun.shadow.mapSize.setScalar(Math.max(256,Math.min(g.shadows,r.capabilities.maxTextureSize)));
    }
    this.camera.far=g.worldDistance+120;this.camera.updateProjectionMatrix();
    this.resize();this.setLighting(this.time);
  }
  setLighting(time:Lighting){
    this.time=time;const c=conditions[time],g=this.graphics;
    this.sky.set(time,g.atmosphere);this.dir.fromArray(c.vector).normalize();
    this.sun.color.set(c.sun);this.sun.intensity=c.power;
    this.hemi.color.set(time==='night'?'#a0b9df':'#e1e9fa');this.hemi.groundColor.set(time==='night'?'#77726c':'#9c8d7a');this.hemi.intensity=c.ambient;
    this.scene.fog=new Fog(c.fog,g.worldDistance*(time==='night'?.14:.26),g.worldDistance*.98);
    (this.scene.background as Color).set(c.fog);
    const skyKey=[time,g.reflections,g.atmosphere].join('.');
    if(this.skyKey!==skyKey){
      this.skyKey=skyKey;this.probe?.dispose();
      this.probe=this.pmrem.fromScene(this.sky.probeScene,g.reflections===0?.12:g.reflections===1?.05:.012,.05,20);
      this.scene.environment=(this.daylight&&g.reflections>=1&&(time==='golden'||time==='afternoon')?this.daylight:this.probe).texture;
      this.scene.environmentRotation.y=time==='golden'?1.82:2.45;
      this.scene.environmentIntensity=time==='night'?.45:g.reflections===0?.62:.95;
    }
    this.renderer.toneMappingExposure=c.exposure;
  }
  draw(dt:number,car:VehicleController,headlights:boolean){
    this.resize();const g=this.graphics,c=conditions[this.time],cam=this.camera,ren=this.renderer;
    cam.getWorldDirection(this.look);this.sky.mesh.position.copy(cam.position);
    const distance=Math.min(g.shadowDistance,Math.max(38,48+Math.abs(car.speed)*1.35));
    const shadow=this.sun.shadow.camera;
    if(Math.abs(shadow.right-distance)>.6){shadow.left=shadow.bottom=-distance;shadow.top=shadow.right=distance;shadow.near=1;shadow.far=360;shadow.updateProjectionMatrix();}
    this.sun.target.position.copy(car.position).addScaledVector(this.look,distance*.37);this.sun.target.position.y=car.position.y;
    const texel=2*distance/Math.max(256,g.shadows);
    this.sun.target.position.x=Math.round(this.sun.target.position.x/texel)*texel;
    this.sun.target.position.z=Math.round(this.sun.target.position.z/texel)*texel;
    this.sun.position.copy(this.sun.target.position).addScaledVector(this.dir,170);
    const exposure=c.exposure*(1-.1*Math.max(0,this.look.dot(this.dir))+.055*clampDown(this.look.y));
    ren.toneMappingExposure=damp(ren.toneMappingExposure,exposure,1.8,dt);
    this.lamps.forEach((light,i)=>{
      light.intensity=headlights?(this.time==='night'?155:68):0;
      light.position.copy(this.scratch.set((i-.5)*car.spec.width*.73,.13,-car.spec.length*.46).applyQuaternion(car.rotation)).add(car.position);
      light.target.position.copy(this.scratch.set((i-.5)*1.7,-.85,-27).applyQuaternion(car.rotation)).add(light.position);
    });
    this.post.render(this.scene,cam,g,car);
  }
}
const clampDown=(y:number)=>Math.min(1,Math.max(0,-y));
