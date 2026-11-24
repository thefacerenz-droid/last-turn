import { CanvasTexture, Color, DirectionalLight, EquirectangularReflectionMapping, Group, HemisphereLight, Mesh, MeshBasicMaterial, PerspectiveCamera, PlaneGeometry, Scene, ShadowMaterial, SRGBColorSpace, Texture, TextureLoader, Vector3, type WebGLRenderer } from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { PMREMGenerator } from 'three';
import { clamp,damp } from '../core/math';

export class Showroom {
  private scene=new Scene();private camera=new PerspectiveCamera(31,1,.1,80);
  private pivot=new Group();private car?:Group;private plate:Texture;private env:Texture;
  private contact:Mesh;private shadow:Mesh;private sun=new DirectionalLight('#ffe3bd',2.05);
  private length=4.55;private time=0;private angle=-.91;private turn=-.91;private height=1.0;
  private held=0;private lastAspect=0;private aim=new Vector3();
  constructor(private renderer:WebGLRenderer){
    this.plate=new TextureLoader().load('/assets/showroom/overlook.webp',()=>this.lastAspect=0);
    this.plate.colorSpace=SRGBColorSpace;this.scene.background=this.plate;
    this.scene.add(this.pivot);
    const room=new RoomEnvironment(),bake=new PMREMGenerator(renderer),fallback=bake.fromScene(room,.04);
    room.dispose();bake.dispose();this.env=fallback.texture;this.scene.environment=this.env;
    new HDRLoader().load('/assets/lighting/coastal-dawn.hdr',texture=>{
      texture.mapping=EquirectangularReflectionMapping;this.scene.environment=texture;this.env=texture;fallback.dispose();
    });
    this.scene.environmentIntensity=1.15;this.scene.environmentRotation.y=-1.09;
    this.scene.add(new HemisphereLight('#fff5dd','#6b6257',1.15));
    this.sun.position.set(-5,5,-6);this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);
    this.sun.shadow.camera.left=this.sun.shadow.camera.bottom=-5;this.sun.shadow.camera.right=this.sun.shadow.camera.top=5;
    this.sun.shadow.camera.near=.1;this.sun.shadow.camera.far=22;this.sun.shadow.normalBias=.015;this.sun.shadow.bias=-.0002;
    this.scene.add(this.sun,this.sun.target);
    this.shadow=new Mesh(new PlaneGeometry(40,40),new ShadowMaterial({color:0x161811,opacity:.31,depthWrite:false}));
    this.shadow.rotation.x=-Math.PI/2;this.shadow.receiveShadow=true;this.shadow.position.y=-.007;this.scene.add(this.shadow);
    const tile=document.createElement('canvas');tile.width=128;tile.height=192;const c=tile.getContext('2d')!;
    c.scale(128,192);const grad=c.createRadialGradient(.5,.5,.09,.5,.5,.5);grad.addColorStop(0,'rgba(8,11,10,.95)');grad.addColorStop(.58,'rgba(8,11,10,.77)');grad.addColorStop(.86,'rgba(8,11,10,.26)');grad.addColorStop(1,'rgba(8,11,10,0)');c.fillStyle=grad;c.fillRect(0,0,1,1);
    this.contact=new Mesh(new PlaneGeometry(1,1),new MeshBasicMaterial({map:new CanvasTexture(tile),color:new Color('#393428'),transparent:true,opacity:.86,depthWrite:false}));
    this.contact.rotation.x=-Math.PI/2;this.contact.position.y=.003;this.scene.add(this.contact);
  }
  setCar(root:Group,length:number){
    this.car?.removeFromParent();this.car=root;this.length=length;root.position.set(0,0,0);root.rotation.set(0,0,0);this.pivot.add(root);
    this.contact.scale.set(length*.66,length*1.27,1);this.turn=this.angle=-.91;this.held=0;
  }
  orbit(dx:number,dy:number){this.turn-=dx*.007;this.height=clamp(this.height+dy*.012,.46,3.1);this.held=4;}
  render(dt:number,garage:boolean){
    const canvas=this.renderer.domElement,w=canvas.clientWidth,h=canvas.clientHeight,aspect=w/Math.max(1,h);
    if(!w||!h)return;
    if(this.lastAspect!==aspect){
      this.camera.aspect=aspect;
      const source=this.plate.image as HTMLImageElement|undefined;
      if(source?.width){const ratio=source.width/source.height;this.plate.repeat.set(Math.min(1,aspect/ratio),Math.min(1,ratio/aspect));this.plate.offset.set((1-this.plate.repeat.x)/2,(1-this.plate.repeat.y)/2);}
      this.lastAspect=aspect;
    }
    this.time+=dt;this.held=Math.max(0,this.held-dt);
    const motion=matchMedia('(prefers-reduced-motion: reduce)').matches?0:1;
    const az=this.turn+(garage?0:Math.sin(this.time*.115)*.033*motion);
    this.angle=damp(this.angle,az,8,dt);
    const mobile=aspect<.95;
    const targetX=mobile?.59:garage?.68:.69,targetY=mobile?(garage?.35:.61):.55;
    this.camera.setViewOffset(w,h,(.5-targetX)*w,(.5-targetY)*h,w,h);
    const fraction=mobile?.87:garage?.57:.53;
    const distance=this.length*.91/(2*Math.tan(31*Math.PI/360)*aspect*fraction);
    this.camera.position.set(Math.sin(this.angle)*distance,(garage?this.height:1.16)*Math.max(.88,distance/8),-Math.cos(this.angle)*distance);
    this.aim.set(0,.57,0);this.camera.lookAt(this.aim);this.camera.updateProjectionMatrix();
    this.renderer.setRenderTarget(null);this.renderer.toneMappingExposure=1.0;this.renderer.render(this.scene,this.camera);
  }
  dispose(){
    this.plate.dispose();this.env.dispose();this.contact.geometry.dispose();(this.contact.material as MeshBasicMaterial).map?.dispose();
    (this.contact.material as MeshBasicMaterial).dispose();this.shadow.geometry.dispose();(this.shadow.material as ShadowMaterial).dispose();this.sun.shadow.dispose();
  }
}
