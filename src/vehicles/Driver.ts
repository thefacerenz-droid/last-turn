import { BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, Object3D, SphereGeometry, Vector3 } from 'three';

const suit = new MeshStandardMaterial({color:0x28313a, roughness:.92});
const fabric = new MeshStandardMaterial({color:0x444d54, roughness:.83});
const leather = new MeshStandardMaterial({color:0x181b20, roughness:.68});
const stripe = new MeshStandardMaterial({color:0xca9c62, roughness:.62});
const shell = new MeshStandardMaterial({color:0xd8d6cc, roughness:.28,metalness:.18});
const visor = new MeshStandardMaterial({color:0x242e3a, roughness:.13,metalness:.7});
const oval = new SphereGeometry(1,18,14);
const up = new Vector3(0,1,0);
function part(parent:Object3D, material:MeshStandardMaterial,x:number,y:number,z:number,w:number,h:number,d:number){
  const mesh=new Mesh(oval,material);
  mesh.position.set(x,y,z);mesh.scale.set(w,h,d);parent.add(mesh);return mesh;
}

// Elliptical rings give the seated suit a waist, ribcage and sloped shoulders.
function jacket(){
  const vertices:number[]=[],indices:number[]=[];
  const rings=[[0,.125,.084],[.055,.149,.102],[.13,.134,.09],[.23,.166,.107],[.32,.183,.096],[.355,.154,.08],[.382,.073,.061]];
  rings.forEach(([y,w,d],j)=>{
    for(let i=0;i<24;i++){
      const a=i*Math.PI/12;vertices.push(w*Math.cos(a),y,d*Math.sin(a)+y*.22);
      if(j){const b=j*24+i,c=j*24+(i+1)%24;indices.push(b-24,b,c,c,c-24,b-24);}
    }
  });
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
const coat=jacket();

class Limb {
  private upper:Mesh;private lower:Mesh;
  private joint=new Vector3();private axis=new Vector3();private bend=new Vector3();
  constructor(root:Group,private start:Vector3,private pole:Vector3,private a:number,private b:number,private width:number){
    this.upper=new Mesh(oval,suit);this.lower=new Mesh(oval,fabric);root.add(this.upper,this.lower);
  }
  move(end:Vector3){
    const distance=Math.max(.001,this.axis.subVectors(end,this.start).length());
    this.axis.divideScalar(distance);
    this.bend.copy(this.pole).addScaledVector(this.axis,-this.axis.dot(this.pole)).normalize();
    const along=Math.min(this.a,Math.max(-this.a,(distance*distance+this.a*this.a-this.b*this.b)/(2*distance)));
    this.joint.copy(this.start).addScaledVector(this.axis,along).addScaledVector(this.bend,Math.sqrt(Math.max(0,this.a*this.a-along*along)));
    this.segment(this.upper,this.start,this.joint,this.width);
    this.segment(this.lower,this.joint,end,this.width*.81);
  }
  private segment(mesh:Mesh,a:Vector3,b:Vector3,w:number){
    const length=this.axis.subVectors(b,a).length();
    mesh.position.lerpVectors(a,b,.5);mesh.scale.set(w,length*.5+w*.47,w*.93);
    mesh.quaternion.setFromUnitVectors(up,this.axis.normalize());
  }
}

export class Driver {
  readonly root=new Group();
  private head=new Group();
  private arms:Limb[]=[];private legs:Limb[]=[];private hands:Group[]=[];private boots:Mesh[]=[];
  private target=new Vector3();private grip=new Vector3();private lever=new Group();
  constructor(private wheel:Vector3,private height:number,seatZ:number){
    const root=this.root;root.name='Driver';root.position.set(wheel.x,0,seatZ);
    this.wheel=wheel.clone().sub(root.position);
    const hip=height*.34;
    const jacketMesh=new Mesh(coat,suit);jacketMesh.position.set(0,hip,-.012);root.add(jacketMesh);
    for(const side of [-1,1]){
      const belt=part(root,leather,side*.091,hip+.205,-.061,.021,.161,.014);belt.rotation.x=.20;belt.rotation.z=-side*.14;
      const shoulder=new Vector3(side*.162,hip+.32,.04);
      this.arms.push(new Limb(root,shoulder,new Vector3(side*.7,-1,.28),.27,.265,.061));
      const hand=new Group();root.add(hand);this.hands.push(hand);
      part(hand,leather,0,0,0,.032,.052,.032);
      part(hand,stripe,side*.014,0,.024,.015,.031,.006);
      for(let i=0;i<4;i++)part(hand,leather,-side*.010,.030-i*.016,-.023,.027,.008,.014);
      part(hand,fabric,-side*.028,.026,.001,.014,.025,.016);
      this.legs.push(new Limb(root,new Vector3(side*.087,hip+.018,0),new Vector3(side*.2,1,0),.37,.39,.086));
      this.boots.push(part(root,leather,0,0,0,.048,.051,.115));
    }
    root.add(this.head);this.head.position.set(0,hip+.483,.075);
    part(this.head,shell,0,0,0,.111,.136,.118);
    part(this.head,visor,0,.012,-.046,.107,.058,.086);
    part(this.head,shell,0,-.064,-.038,.098,.048,.089);
    part(this.head,leather,0,-.109,.007,.074,.037,.068);
    this.lever.position.set(.225,hip-.045,-.126);root.add(this.lever);
    part(this.lever,leather,0,.045,-.085,.017,.020,.109).rotation.x=.4;
    this.update(0,0,0,0,false);
  }
  update(angle:number,gas:number,brake:number,handbrake:number,cockpit:boolean){
    this.head.visible=!cockpit;
    this.lever.rotation.x=handbrake*.68;
    const cs=Math.cos(angle),sn=Math.sin(angle);
    for(let i=0;i<2;i++){
      const side=i*2-1,hand=this.hands[i],reach=i?handbrake:0;
      const x=side*.15,y=.04;
      this.target.set(x*cs-y*sn,x*sn+y*cs,.014).add(this.wheel);
      this.grip.set(0,.059,-.147).applyQuaternion(this.lever.quaternion).add(this.lever.position);
      hand.position.copy(this.target.lerp(this.grip,reach));
      hand.rotation.z=angle*(1-reach);this.arms[i].move(hand.position);
      const press=i?Math.max(gas,brake):0,boot=this.boots[i];
      boot.position.set(i?.054-.118*brake:-.136,this.height*.275+.024-press*.018,this.wheel.z-.19-press*.032);
      boot.rotation.x=-.33+press*.27;this.target.copy(boot.position);this.target.z+=.06;
      this.legs[i].move(this.target);
    }
  }
}
