import { Color,DoubleSide,Group,InstancedMesh,Mesh,MeshLambertMaterial,Object3D,PointLight,Scene,type BufferGeometry,type Material } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { presets,type Lighting } from '../settings/SettingsManager';
import { GeometryBatch,box,mound,spar,white,type Point } from './sceneryGeometry';
import { LANE_WIDTH,ROUTES,laneOffset,rampAt,roadAt,roadHeight,roadWalls,scatter,terrainHeight,type RouteId } from './roads';
import { RoadMaterials,plates,type Plate } from './roadMaterials';
import { seeded } from '../core/math';

interface Quality {drawDistance:number;vegetation:number;textureSize:number;anisotropy:number}
interface Chunk {group:Group; geometry:BufferGeometry[]; palms?:InstancedMesh; lampPositions:Point[]}
const length=160;
const palette={yellow:new Color('#e1b65e'),cream:new Color('#e1ded0'),cement:new Color('#aaa394'),steel:new Color('#8c9291'),
  bark:new Color('#75684c'),light:new Color('#ffe2a0'),dark:new Color('#3d4441'),sand:new Color('#b4a183'),scrub:new Color('#7a7856')};
function panel(batch:GeometryBatch,x:number,y:number,z:number,w:number,h:number,plate:Plate) {
  const [u,v,pw,ph]=plates[plate],u1=u/1024,u2=(u+pw)/1024,v1=1-(v+ph)/512,v2=1-v/512;
  batch.face(batch.vertex([x-w/2,y,z],white,u1,v1),batch.vertex([x+w/2,y,z],white,u2,v1),
    batch.vertex([x+w/2,y+h,z],white,u2,v2),batch.vertex([x-w/2,y+h,z],white,u1,v2));
}
let palmsPromise:Promise<BufferGeometry[]>|undefined;
async function palmAssets(){
  if(!palmsPromise)palmsPromise=Promise.all(['palm','palm-lod'].map(async key=>{
    const g=await new GLTFLoader().loadAsync('/assets/world/'+key+'.glb');let geometry:BufferGeometry|undefined;
    g.scene.traverse(o=>{if(o instanceof Mesh){geometry=o.geometry;(o.material as Material).dispose();}});
    if(!geometry)throw new Error('Missing palm mesh in '+key);return geometry;
  })).catch(e=>{palmsPromise=undefined;throw e;});
  return palmsPromise;
}
export class WorldStreamer {
  private materials:RoadMaterials;private treeMaterial=new MeshLambertMaterial({vertexColors:true,side:DoubleSide});
  private chunks=new Map<number,Chunk>();private pool:Group[]=[];private lampPool:PointLight[]=[];
  private quality:Quality={drawDistance:1150,vegetation:.85,textureSize:1024,anisotropy:8};
  private time:Lighting='golden';private center=Infinity;private transform=new Object3D();private root=new Group();
  static async create(scene:Scene,route:RouteId){return new WorldStreamer(scene,route,await palmAssets());}
  private constructor(scene:Scene,private route:RouteId,private palms:BufferGeometry[]){
    this.materials=new RoadMaterials(route,presets.High);this.root.name='Streamed highway';scene.add(this.root);
    for(let i=0;i<4;i++){const l=new PointLight('#ffdfab',0,48,1.6);this.lampPool.push(l);this.root.add(l);}
  }
  setRoute(route:RouteId){if(this.route!==route){this.route=route;this.rebuild();}}
  setQuality(q:Quality){
    if(JSON.stringify(q)===JSON.stringify(this.quality))return;
    this.quality={...q};this.rebuild();
  }
  private rebuild(){
    for(const c of this.chunks.values())this.release(c);this.chunks.clear();this.center=Infinity;
    this.materials.dispose();this.materials=new RoadMaterials(this.route,{...presets.High,texture:this.quality.textureSize,anisotropy:this.quality.anisotropy});this.setLighting(this.time);
  }
  setLighting(time:Lighting){
    this.time=time;const dark=time==='night'||time==='evening',m=this.materials;
    m.windows.emissive.set(dark?'#fff1d7':'#000000');m.windows.emissiveIntensity=time==='night'?.92:.22;
    m.lamps.color.set(dark?'#ffdfae':'#d5d5c7');m.lamps.toneMapped=!dark;
    m.signs.emissiveIntensity=dark?.7:.15;
    m.billboard.emissiveIntensity=dark?.75:.11;
    for(const lamp of this.lampPool)lamp.intensity=dark?(time==='night'?128:44):0;
  }
  update(s:number,dt:number){
    const center=Math.floor(s/length);
    if(center!==this.center){
      this.center=center;const ahead=Math.ceil(this.quality.drawDistance/length)+1,back=Math.max(3,Math.ceil(ahead*.65));
      for(const [index,c] of this.chunks)if(index<center-back||index>center+ahead){this.release(c);this.chunks.delete(index);}
      for(let index=center-back;index<=center+ahead;index++)if(!this.chunks.has(index))this.chunks.set(index,this.build(index));
    }
    for(const [i,c] of this.chunks)if(c.palms)c.palms.geometry=this.palms[Math.abs(i*length+length/2-s)>250?1:0];
    if(this.time==='night'||this.time==='evening'){
      const positions:Point[]=[];for(let i=center-1;i<=center+1;i++)positions.push(...this.chunks.get(i)!.lampPositions);
      positions.sort((a,b)=>Math.abs(-a[2]-s-18)-Math.abs(-b[2]-s-18));
      this.lampPool.forEach((l,i)=>{if(positions[i])l.position.fromArray(positions[i]);});
    }
    this.materials.waterNormals.offset.x=(this.materials.waterNormals.offset.x+dt*.014)%1;
  }
  private build(index:number):Chunk{
    const m=this.materials,g=this.pool.pop()??new Group();g.name='Road '+index;this.root.add(g);
    const c:Chunk={group:g,geometry:[],lampPositions:[]};
    const road=new GeometryBatch(),paint=new GeometryBatch(),solid=new GeometryBatch(),soil=new GeometryBatch(),ocean=new GeometryBatch(),
      glass=new GeometryBatch(),signs=new GeometryBatch(),advert=new GeometryBatch(),lamps=new GeometryBatch(),green=new GeometryBatch();
    const at=index*length,end=at+length,route=this.route,random=seeded((index+80331)*901+ROUTES.findIndex(r=>r.id===route)*331);
    const surface=(s:number,offset:number,dy=0):Point=>{const r=roadAt(route,s),x=r.x+offset;return [x,roadHeight(route,s,x)+dy,-s];};
    const stripe=(a:number,b:number,leftA:number,rightA:number,leftB:number,rightB:number,color:Color,dy=.023)=>{
      paint.quad(surface(a,leftA,dy),surface(a,rightA,dy),surface(b,rightB,dy),surface(b,leftB,dy),color);
    };
    for(let a=at;a<end;a+=8){
      const b=a+8,ra=roadAt(route,a),rb=roadAt(route,b);
      function asphalt(l1:number,r1:number,l2:number,r2:number,dy=0){
        const corners=[surface(a,l1,dy),surface(a,r1,dy),surface(b,r2,dy),surface(b,l2,dy)],offsets=[l1,r1,r2,l2];
        const vertices=corners.map((p,i)=>road.vertex(p,white,offsets[i]/LANE_WIDTH,(i<2?a:b)/10));
        road.face(vertices[0],vertices[1],vertices[2],vertices[3]);
      }
      asphalt(ra.left-.35,ra.right+.35,rb.left-.35,rb.right+.35);
      const rampa=rampAt(route,a),rampb=rampAt(route,b);
      if(rampa&&rampb){asphalt(rampa.left,rampa.right,rampb.left,rampb.right,.012);stripe(a,b,rampa.right-.40,rampa.right-.29,rampb.right-.40,rampb.right-.29,palette.cream,.036);}
      for(let lane=0;lane<ra.lanes-1;lane++){
        const x1=(laneOffset(route,a,lane)+laneOffset(route,a,lane+1))/2,mid=a+3.3;
        const x2=(laneOffset(route,mid,lane)+laneOffset(route,mid,lane+1))/2;
        stripe(a,mid,x1-.066,x1+.066,x2-.066,x2+.066,palette.cream);
        if(a%16===0)box(lamps,surface(a+4,x1,.033),.11,.021,.17,new Color('#c6bd97'));
      }
      stripe(a,b,ra.left+1.14,ra.left+1.27,rb.left+1.14,rb.left+1.27,palette.yellow);
      if(!rampa||rampa.left>ra.right+1)stripe(a,b,ra.right-1.61,ra.right-1.48,rb.right-1.61,rb.right-1.48,palette.cream);
      const rw=roadWalls(route,b);
      for(const wall of roadWalls(route,a)){
        const other=rw.find(w=>w.id===wall.id);if(!other)continue;
        const o=wall.offset,n=other.offset;
        if(wall.id==='median'||route==='marina'){
          const p=surface(a,o),q=surface(b,n),toward=wall.id==='median'?1:-1;
          const h=(v:Point,z:number,x:number):Point=>[v[0]+x*toward,v[1]+z,v[2]];
          solid.quad(h(p,.04,.23),h(q,.04,.23),h(q,.42,.10),h(p,.42,.10),palette.cement);
          solid.quad(h(p,.42,.10),h(q,.42,.10),h(q,.87,.07),h(p,.87,.07),palette.cement);
          solid.quad(h(p,.87,-.15),h(p,.87,.07),h(q,.87,.07),h(q,.87,-.15),palette.cement);
        }else{
          const p=surface(a,o,.65),q=surface(b,n,.65),len=Math.hypot(q[0]-p[0],8),yaw=-Math.atan2(q[0]-p[0],8);
          box(solid,[(p[0]+q[0])/2,(p[1]+q[1])/2,(p[2]+q[2])/2],.105,.26,len+.026,palette.steel,yaw);
          box(solid,surface(a,o,.36),.115,.72,.12,palette.steel);
        }
      }
    }
    const offsets=[-520,-300,-160,-100,-64,-44,-25,-12,0,12,26,44,65,96,140,220,350,550,800,1150];
    const terrainPoint=(s:number,o:number):Point=>{const r=roadAt(route,s);return [r.x+o,terrainHeight(route,s,o,r),-s];};
    for(let a=at;a<end;a+=16){
      const b=a+16;
      for(let j=0;j<offsets.length-1;j++){
        const l=offsets[j],r=offsets[j+1];if(route!=='mesa'&&r< -110)continue;
        const stone=route==='mesa'?'#9a825e':l< -35?'#b3a287':l>160?'#89816b':'#8b896e';
        const points=[terrainPoint(a,l),terrainPoint(a,r),terrainPoint(b,r),terrainPoint(b,l)];
        const vertices=points.map(p=>soil.vertex(p,new Color(stone).offsetHSL(0,0,.025*Math.sin(p[0]*.064+p[2]*.006)),p[0]/5,p[2]/6));soil.face(vertices[0],vertices[1],vertices[2],vertices[3]);
      }
    }
    if(route!=='mesa'){
      const x=roadAt(route,at).x;
      const verts=[[x-2050,.14,-at],[x-17,.14,-at],[x-17,.14,-end],[x-2050,.14,-end]].map(([x,y,z])=>ocean.vertex([x,y,z],white,x/12,z/18));
      ocean.face(verts[0],verts[1],verts[2],verts[3]);
    }
    // Lamps use the same spatial positions for both the fixtures and the nearest night lights.
    for(let s=at+18;s<end;s+=40){const r=roadAt(route,s),side=(Math.floor(s/40)%3===0)?-1:1;
      const offset=side<0?r.left-.6:r.right+.8,p=surface(s,offset,-.25),tip:Point=[p[0]-side*2.3,p[1]+8.7,p[2]];
      spar(solid,p,[p[0],p[1]+7.9,p[2]],.13,.078,palette.steel,8);
      spar(solid,[p[0],p[1]+7.9,p[2]],tip,.08,.049,palette.steel,8);
      box(solid,tip,.48,.16,.95,palette.steel);box(lamps,[tip[0],tip[1]-.088,tip[2]],.36,.019,.71,palette.light);c.lampPositions.push(tip);
    }
    if(((index%3)+3)%3===0){
      const s=at+116,r=roadAt(route,s),y=r.y+6.7,x=r.x;
      for(const offset of [r.left-.6,r.right+.6]){
        const base=surface(s,offset);spar(solid,base,[base[0],y+1.4,-s],.12,.10,palette.steel,8);
      }
      const width=r.right-r.left+1.6;for(const z of [-.27,.27])box(solid,[x,y+.93,-s+z],width,.11,.11,palette.steel);
      for(let o=r.left;o<r.right;o+=1.4)spar(solid,[x+o,y+.91,-s-.27],[x+o+1.4,y+.55,-s+.27],.035,.035,palette.steel,4);
      box(solid,[x+1,y+.06,-s-.09],6.4,2.16,.13,new Color('#58685b'));panel(signs,x+1,y-.99,-s+.012,6.27,2.08,'overhead');
    }
    if(index%2===0){const s=at+67,r=roadAt(route,s),p=surface(s,r.right+1.1);
      box(solid,[p[0],p[1]+1.15,p[2]],.068,2.3,.07,palette.steel);panel(signs,p[0],p[1]+1.75,p[2]+.051,.91,1.26,index%4===0?'route':'limit');}
    if(((index%7)+7)%7===2){
      const s=at+48,r=roadAt(route,s),y=r.y+6.65,x=r.x;
      box(solid,[x,y,-s],102,1.16,9.6,palette.cement,.10);box(solid,[x,y+.75,-s+4.5],102,.80,.35,palette.cement,.10);
      for(const off of [r.left-3,r.right+5,36,-38]){const ground=terrainPoint(s,off);box(solid,[x+off,(ground[1]+y)/2,-s],1.8,y-ground[1],3.3,palette.cement);}
    }
    const town=route==='marina'||route==='pacific'&&index%9>=3;
    const count=route==='marina'?18:town?9:3;
    for(let i=0;i<count;i++){
      const s=at+random()*length,o=(route==='marina'&&i%5===0?-1:1)*(29+random()*(town?205:115));
      const p=terrainPoint(s,o),width=8+random()*16,depth=7+random()*15;
      const high=town&&o>50&&random()>.35,h=high?23+random()*(route==='marina'?86:42):3.5+random()*8;
      const base=new Color().setHSL(.075+random()*.03,.09+random()*.09,.49+random()*.20);
      box(solid,[p[0],p[1]+h/2-.25,p[2]],width,h+.5,depth,base);
      if(high){
        const f:Point=[p[0]-width/2,p[1]+.4,p[2]+depth/2+.04],b:Point=[p[0]+width/2,p[1]+.4,p[2]+depth/2+.04];
        glass.quad(f,b,[b[0],p[1]+h-.6,b[2]],[f[0],p[1]+h-.6,f[2]],white,width/7,h/13);
        glass.quad([f[0]-.04,f[1],p[2]-depth/2],f,[f[0],p[1]+h-.6,f[2]],[f[0]-.04,p[1]+h-.6,p[2]-depth/2],white,depth/7,h/13);
        for(let floor=4;floor<h;floor+=6)box(solid,[p[0],p[1]+floor,p[2]],width+.45,.22,depth+.45,base);
        box(solid,[p[0]+.4,p[1]+h+1.2,p[2]],width*.66,2.4,depth*.62,base);
      }else{
        box(solid,[p[0],p[1]+h-.15,p[2]],width+.5,.4,depth+.5,palette.cream);
        for(let win=1;win<5;win++)box(glass,[p[0]-width*.5+width*win/5,p[1]+h*.61,p[2]+depth*.503],width*.12,Math.min(h*.41,2.8),.03,white);
      }
    }
    if(index%8===1){const s=at+26,p=terrainPoint(s,32);
      box(solid,[p[0],p[1]+4.2,p[2]],16,.65,9,new Color('#b97854'));for(const dx of [-5,5]){
        box(solid,[p[0]+dx,p[1]+2,p[2]],.37,4,.37,palette.cream);box(solid,[p[0]+dx,p[1]+.83,p[2]+1],.74,1.65,.65,new Color('#a64732'));}
    }
    if(((index%6)+6)%6===1){const s=at+75,p=terrainPoint(s,25),x=p[0],y=p[1]+5.3,z=p[2];
      box(solid,[x,y-2.5,z],.61,5.7,.61,palette.steel);box(solid,[x,y+1.45,z-.19],8.25,3.1,.35,palette.dark);
      advert.quad([x-4,y,z],[x+4,y,z],[x+4,y+2.99,z],[x-4,y+2.99,z]);
    }
    if(route==='marina'&&index%5===0){
      const p=terrainPoint(at+91,41),x=p[0],y=p[1],z=p[2];
      for(let level=0;level<4;level++){
        const floor=y+level*3.1;
        box(solid,[x,floor,z],21,.42,29,palette.cement);
        for(const dx of [-9,0,9])for(const dz of [-12,0,12])box(solid,[x+dx,floor+1.54,z+dz],.72,3.1,.74,palette.cement);
        box(solid,[x-10.3,floor+.58,z],.28,.95,29,palette.cement);
      }
      box(solid,[x,y+12.4,z],21,.43,29,palette.cement);
    }
    const trees:Point[]=[];const total=Math.floor((route==='mesa'?8:route==='marina'?14:29)*this.quality.vegetation);
    for(let i=0;i<total;i++){
      const s=at+random()*length,side=i%3===0?-1:1,r=roadAt(route,s);
      const o=side<0?r.left-4-random()*(route==='mesa'?50:27):r.right+4+random()*49;
      const ramp=rampAt(route,s,r);if(ramp&&o>ramp.left-2&&o<ramp.right+2)continue;
      trees.push(terrainPoint(s,o));
    }
    if(trees.length){
      const inst=new InstancedMesh(this.palms[1],this.treeMaterial,trees.length);
      trees.forEach((p,i)=>{this.transform.position.fromArray(p);this.transform.rotation.set(0,random()*6.28,(random()-.5)*.075);this.transform.scale.setScalar(.65+random()*.81);this.transform.updateMatrix();inst.setMatrixAt(i,this.transform.matrix);});
      inst.castShadow=true;inst.receiveShadow=true;inst.computeBoundingSphere();g.add(inst);c.palms=inst;
    }
    for(let i=0;i<Math.floor(77*this.quality.vegetation);i++){const s=at+random()*length,r=roadAt(route,s),offset=(i%3===0?-1:1)*(Math.max(-r.left,r.right)+4+random()*70);
      const ramp=rampAt(route,s,r);if(ramp&&offset>ramp.left-1&&offset<ramp.right+1)continue;
      const p=terrainPoint(s,offset);const shrub=new Color().setHSL(.19+random()*.052,.17+random()*.19,.22+random()*.13);
      mound(green,[p[0],p[1]+.30,p[2]],[.8+random()*2.2,.5+random()*1.25,.8+random()*1.5],shrub,random()*7,7);
    }
    for(const [batch,material,cast,receive] of [[road,m.asphalt,false,true],[paint,m.paint,false,true],[solid,m.solid,true,true],[soil,m.soil,false,true],[ocean,m.ocean,false,false],
      [glass,m.windows,false,true],[signs,m.signs,false,true],[advert,m.billboard,false,true],[lamps,m.lamps,false,false],[green,m.leaves,true,true]] as const){
      const geo=batch.finish();if(!geo)continue;const mesh=new Mesh(geo,material);mesh.castShadow=cast;mesh.receiveShadow=receive;g.add(mesh);c.geometry.push(geo);
    }
    return c;
  }
  private release(c:Chunk){c.group.removeFromParent();c.palms?.dispose();c.group.clear();for(const geo of c.geometry)geo.dispose();this.pool.push(c.group);}
  dispose(){for(const c of this.chunks.values())this.release(c);this.chunks.clear();this.pool.length=0;this.materials.dispose();this.treeMaterial.dispose();this.root.removeFromParent();this.root.clear();}
}
