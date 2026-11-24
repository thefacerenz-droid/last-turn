import { BackSide, Color, Mesh, Scene, ShaderMaterial, SphereGeometry, Vector3, type Texture } from 'three';
import type { Lighting } from '../settings/SettingsManager';
export const conditions={
  golden:{zenith:'#6688aa',horizon:'#efbc88',fog:'#c7ae93',sun:'#ffddac',vector:[-260,95,-380],power:2.8,ambient:1.05,exposure:1.02},
  afternoon:{zenith:'#498dcb',horizon:'#ccddec',fog:'#b5cedd',sun:'#fff3db',vector:[-155,370,-210],power:3,ambient:1.42,exposure:1},
  evening:{zenith:'#3d4b78',horizon:'#cf937e',fog:'#998b9a',sun:'#ffc297',vector:[-330,24,-200],power:1.3,ambient:.86,exposure:1.14},
  night:{zenith:'#091220',horizon:'#323f52',fog:'#283447',sun:'#bbd7f0',vector:[-210,230,-190],power:.35,ambient:.41,exposure:1.18},
  overcast:{zenith:'#87929d',horizon:'#c1c5c7',fog:'#bcc1c2',sun:'#e2e7eb',vector:[-195,320,-140],power:.65,ambient:1.6,exposure:1.1},
} satisfies Record<Lighting,object>;
const vertexShader='varying vec3 vDirection; void main(){vDirection=position;vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;}';
const fragmentShader=`
uniform vec3 highColor,lowColor,sunColor,sunDir;
uniform float solar,clouds,night;
uniform sampler2D panorama;
uniform float hasPhoto,photoPower;
uniform vec3 skyTint;
varying vec3 vDirection;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.545);}
float noise2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
float fbm(vec2 p){return .52*noise2(p)+.27*noise2(p*2.1+7.)+.14*noise2(p*4.2+4.)+.07*noise2(p*8.6);}
void main(){
  vec3 d=normalize(vDirection);float h=max(0.,d.y),s=max(0.,dot(d,sunDir));
  vec3 c=mix(lowColor,highColor,pow(clamp(h,0.,1.),.44));
  c+=sunColor*(.12*pow(s,9.)+.34*pow(s,68.)+7.*smoothstep(.99988,.99998,s))*solar;
  vec2 cloudPos=d.xz/max(.055,h+.10);
  float cloud=smoothstep(.48,.72,fbm(cloudPos*vec2(2.7,5.)+vec2(6.,2.)))*smoothstep(.005,.12,h)*clouds;
  c=mix(c,mix(vec3(.83,.76,.72),vec3(.95,.87,.76),s)*mix(.8,.075,night),cloud*.62);
  if(hasPhoto>.5 && d.y>-.018){
    float az=atan(d.z,d.x)-atan(sunDir.z,sunDir.x)+.704;
    vec2 skyUV=vec2(fract(.5+az*.15915494),.5+asin(max(0.,d.y))*.31830989);
    vec3 observed=texture2D(panorama,skyUV).rgb*skyTint*photoPower;
    c=mix(c,observed,clamp(.52+h*.8,0.,.89)*(1.-night*.66));
  }
  float stars=step(.9989,hash(floor(d.xz/(.15+h)*1350.)))*smoothstep(.08,.5,h);
  c+=night*stars*.55;
  if(d.y<0.)c=mix(lowColor,vec3(.11,.115,.105),smoothstep(0.,.45,-d.y));
  gl_FragColor=vec4(c,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
export class Sky {
  readonly material=new ShaderMaterial({side:BackSide,depthWrite:false,depthTest:false,vertexShader,fragmentShader,
    uniforms:{highColor:{value:new Color()},lowColor:{value:new Color()},sunColor:{value:new Color()},sunDir:{value:new Vector3()},solar:{value:1},clouds:{value:1},night:{value:0},panorama:{value:null},hasPhoto:{value:0},photoPower:{value:1},skyTint:{value:new Color()}}});
  readonly mesh=new Mesh(new SphereGeometry(1,40,20),this.material);
  readonly probeScene=new Scene();
  constructor(scene:Scene){this.mesh.renderOrder=-1000;this.mesh.frustumCulled=false;scene.add(this.mesh);const copy=this.mesh.clone();this.probeScene.add(copy);}
  setPanorama(t:Texture){this.material.uniforms.panorama.value=t;this.material.uniforms.hasPhoto.value=1;}
  set(time:Lighting,atmosphere:boolean){
    const c=conditions[time],u=this.material.uniforms;
    u.highColor.value.set(c.zenith);u.lowColor.value.set(c.horizon);u.sunColor.value.set(c.sun);
    u.sunDir.value.fromArray(c.vector).normalize();u.solar.value=time==='overcast'?.12:time==='night'?.13:1;
    u.clouds.value=atmosphere?(time==='overcast'?1.6:1):0;u.night.value=Number(time==='night');
    u.skyTint.value.set(time==='golden'?'#ffeacb':time==='evening'?'#dab7bd':time==='night'?'#7d9dc7':'#f5f7ff');
    u.photoPower.value=time==='night'?.013:time==='evening'?.45:time==='overcast'?.75:1.12;
  }
}
