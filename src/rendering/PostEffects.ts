import { DepthTexture, HalfFloatType, LinearFilter, Matrix4, Mesh, NoColorSpace, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, UnsignedIntType, Vector2, Vector3, WebGLRenderer, WebGLRenderTarget, type PerspectiveCamera } from 'three';
import type { VehicleController } from '../physics/VehicleController';
import type { Graphics } from '../settings/SettingsManager';
const fragment=`
uniform sampler2D image,depthMap;
uniform vec2 texel;
uniform float ao,glow,blur,fxaa,reflectLevel,exposure,nearClip,farClip;
uniform mat4 inverseProjection,projection;
uniform mat4 cameraWorld,worldToCar;
uniform vec3 vehicleHalf;
varying vec2 uvScreen;
float depthAt(vec2 uv){float d=texture2D(depthMap,uv).x;return nearClip*farClip/(farClip-d*(farClip-nearClip));}
vec3 viewPos(vec2 uv){float d=texture2D(depthMap,uv).r;vec4 p=inverseProjection*vec4(uv*2.-1.,d*2.-1.,1.);return p.xyz/p.w;}
float luma(vec3 c){return dot(c,vec3(.2126,.7152,.0722));}
void main(){
 vec2 uv=uvScreen;vec3 c=texture2D(image,uv).rgb;
 float z=depthAt(uv);
 if(fxaa>.5){
   vec3 n=texture2D(image,uv+vec2(0.,texel.y)).rgb,s=texture2D(image,uv-vec2(0.,texel.y)).rgb;
   vec3 e=texture2D(image,uv+vec2(texel.x,0.)).rgb,w=texture2D(image,uv-vec2(texel.x,0.)).rgb;
   float lo=min(min(luma(n),luma(s)),min(luma(e),luma(w))),hi=max(max(luma(n),luma(s)),max(luma(e),luma(w)));
   if(hi-lo>max(.075,hi*.16)){vec3 adj=abs(luma(n)-luma(s))<abs(luma(e)-luma(w))?(n+s)*.5:(e+w)*.5;c=mix(c,adj,.34);}
 }
 if(ao>.5 && z<105.){
   vec2 r=texel*clamp(40./z,1.8,8.);float shade=0.;
   for(int i=0;i<6;i++){
     float a=float(i)*1.0472+.35;float d=z-depthAt(uv+vec2(cos(a),sin(a))*r);
     shade+=smoothstep(.04,.42,d)*(1.-smoothstep(.55,2.1,d));
   }c*=1.-shade*.041;
 }
 if(reflectLevel>1.5 && z<82. && uv.y<.70){
   vec3 p=viewPos(uv),n=normalize(cross(dFdx(p),dFdy(p))),dir=normalize(p);
   vec4 world=cameraWorld*vec4(p,1.);vec3 local=(worldToCar*world).xyz;
   bool polished=all(lessThan(abs(local),vehicleHalf)) && local.y>-.31;
   bool water=abs(world.y-.14)<.19;
   float grazing=1.-clamp(dot(-dir,n),0.,1.);
   if((polished||water)&&grazing>.43){
     vec3 ray=reflect(dir,n);float distanceAlong=.55;
     for(int i=0;i<14;i++){
       if(i>=8 && reflectLevel<2.8)break;
       vec3 sampleP=p+n*.10+ray*distanceAlong;
       vec4 clip=projection*vec4(sampleP,1.);if(clip.w<=0.)break;
       vec2 at=clip.xy/clip.w*.5+.5;if(any(lessThan(at,vec2(.015)))||any(greaterThan(at,vec2(.985))))break;
       float delta=-sampleP.z-depthAt(at);
       if(delta>0. && delta<max(.32,distanceAlong*.12)){
         float edge=clamp(min(min(at.x,1.-at.x),min(at.y,1.-at.y))*9.,0.,1.);
         c=mix(c,texture2D(image,at).rgb,edge*grazing*grazing*.15);break;
       }distanceAlong=distanceAlong*1.32+.30;
     }
   }
 }
 if(glow>.5){
   vec3 bright=vec3(0.);
   for(int i=0;i<8;i++){float a=float(i)*.7854;vec3 p=texture2D(image,uv+vec2(cos(a),sin(a))*texel*4.).rgb;bright+=p*smoothstep(1.25,3.1,luma(p));}
   c+=bright*.016;
 }
 if(blur>.001){vec2 dir=(uv-vec2(.5,.54))*blur*.035;vec3 streak=vec3(0.);for(int i=1;i<=4;i++)streak+=texture2D(image,uv-dir*float(i)/4.).rgb;c=mix(c,streak*.25,clamp(length(dir)*17.,0.,.5));}
 c*=exposure;c=clamp((c*(2.51*c+.03))/(c*(2.43*c+.59)+.14),0.,1.);
 c=mix(vec3(luma(c)),c,.96);gl_FragColor=vec4(c,1.);
 #include <colorspace_fragment>
}`;
export class PostEffects {
  private scene=new Scene();
  private camera=new OrthographicCamera(-1,1,1,-1,0,1);
  private target:WebGLRenderTarget;
  private screen:ShaderMaterial;
  private size=new Vector2();
  private supported:boolean;
  constructor(private renderer:WebGLRenderer){
    this.supported=renderer.extensions.has('EXT_color_buffer_float');
    this.target=new WebGLRenderTarget(1,1,{type:this.supported?HalfFloatType:undefined,minFilter:LinearFilter,magFilter:LinearFilter,colorSpace:NoColorSpace});
    this.target.depthTexture=new DepthTexture(1,1,UnsignedIntType);
    this.screen=new ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,vertexShader:'varying vec2 uvScreen; void main(){uvScreen=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:fragment,
      uniforms:{image:{value:this.target.texture},depthMap:{value:this.target.depthTexture},texel:{value:new Vector2()},ao:{value:1},glow:{value:1},blur:{value:0},fxaa:{value:1},reflectLevel:{value:1},exposure:{value:1},nearClip:{value:.12},farClip:{value:1600},inverseProjection:{value:new Matrix4()},projection:{value:new Matrix4()},cameraWorld:{value:new Matrix4()},worldToCar:{value:new Matrix4()},vehicleHalf:{value:new Vector3()}}});
    this.scene.add(new Mesh(new PlaneGeometry(2,2),this.screen));
  }
  render(scene:Scene,camera:PerspectiveCamera,g:Graphics,car:VehicleController){
    const r=this.renderer;
    // Antialiasing is available independently of the other post effects.
    if(!g.post&&!g.aa){r.setRenderTarget(null);r.render(scene,camera);return;}
    r.getDrawingBufferSize(this.size);
    if(this.target.width!==this.size.x||this.target.height!==this.size.y)this.target.setSize(this.size.x,this.size.y);
    const u=this.screen.uniforms;u.texel.value.set(1/this.size.x,1/this.size.y);
    u.ao.value=Number(g.post&&g.ao);u.glow.value=Number(g.post&&g.bloom);u.fxaa.value=Number(g.aa);
    u.blur.value=g.post&&g.blur?Math.min(1,Math.abs(car.speed)/75):0;u.reflectLevel.value=g.post&&this.supported?g.reflections:0;
    u.exposure.value=r.toneMappingExposure;u.nearClip.value=camera.near;u.farClip.value=camera.far;
    u.inverseProjection.value.copy(camera.projectionMatrixInverse);u.projection.value.copy(camera.projectionMatrix);
    camera.updateMatrixWorld();u.cameraWorld.value.copy(camera.matrixWorld);
    u.worldToCar.value.makeRotationFromQuaternion(car.rotation).setPosition(car.position).invert();
    u.vehicleHalf.value.set(car.spec.width*.53,car.spec.height*.7,car.spec.length*.51);
    r.setRenderTarget(this.target);r.render(scene,camera);r.setRenderTarget(null);r.render(this.scene,this.camera);
  }
  dispose(){this.target.dispose();this.screen.dispose();(this.scene.children[0] as Mesh).geometry.dispose();}
}
