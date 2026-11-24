import { CanvasTexture, LinearFilter, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace } from 'three';
import type { VehicleSpec } from './catalogue';
import type { VehicleController } from '../physics/VehicleController';
import { cabinDesign, instrumentMount, type InstrumentStyle } from './cabinLayout';

const width=640,height=212,ink='#ecebe2',secondary='#a9b4b1',needle='#f18554',red='#cd604c';
const start=Math.PI*.78, sweep=Math.PI*1.44;
function textAt(c:CanvasRenderingContext2D,value:string,x:number,y:number,px:number,color:string,weight=500) {
  c.font=weight+' '+px+'px Barlow, Arial, sans-serif';c.fillStyle=color;c.fillText(value,x,y);
}
function scale(c:CanvasRenderingContext2D,x:number,y:number,r:number,divisions:number,labelStep:number,max:number,tach:boolean) {
  c.lineWidth=2;c.strokeStyle='#687473';
  c.beginPath();c.arc(x,y,r,start,start+sweep);c.stroke();
  for(let i=0;i<=divisions*4;i++){
    const fraction=i/(divisions*4),angle=start+sweep*fraction,major=i%4===0;
    const co=Math.cos(angle),si=Math.sin(angle),inside=r-(major?12:5);
    c.strokeStyle=tach&&fraction>.862?red:major?ink:secondary;c.lineWidth=major?2.6:1.4;
    c.beginPath();c.moveTo(x+inside*co,y+inside*si);c.lineTo(x+r*co,y+r*si);c.stroke();
    if(major&&(i/4)%labelStep===0)textAt(c,String(Math.round(fraction*max)),x+(r-24)*co,y+(r-24)*si+5,15,ink);
  }
}
function pointer(c:CanvasRenderingContext2D,x:number,y:number,r:number,fraction:number) {
  const a=start+sweep*Math.max(0,Math.min(1,fraction)),co=Math.cos(a),si=Math.sin(a);
  c.fillStyle=needle;c.beginPath();c.moveTo(x-si*3-co*9,y+co*3-si*9);c.lineTo(x+r*co,y+r*si);
  c.lineTo(x+si*3-co*9,y-co*3-si*9);c.closePath();c.fill();
  c.fillStyle='#8e9794';c.beginPath();c.arc(x,y,5,0,Math.PI*2);c.fill();
}

export class Dashboard {
  readonly mesh:Mesh<PlaneGeometry,MeshBasicMaterial>;
  private face:HTMLCanvasElement;private ctx:CanvasRenderingContext2D;private texture:CanvasTexture;
  private wait=0;private lastUnit='';private lastReading='';private style:InstrumentStyle;
  private maxSpeed=200;private maxRpm:number;

  constructor(private spec:VehicleSpec){
    this.style=cabinDesign(spec.design).cluster;
    this.maxRpm=Math.ceil(spec.redline/1000);
    this.face=document.createElement('canvas');this.face.width=width;this.face.height=height;
    const frames=document.createElement('canvas');frames.width=width;frames.height=height;
    this.ctx=frames.getContext('2d',{alpha:false})!;
    this.texture=new CanvasTexture(frames);this.texture.colorSpace=SRGBColorSpace;
    this.texture.minFilter=LinearFilter;this.texture.generateMipmaps=false;
    const mount=instrumentMount(spec);
    this.mesh=new Mesh(new PlaneGeometry(mount.width,mount.height),new MeshBasicMaterial({map:this.texture,toneMapped:false}));
    this.mesh.rotation.x=mount.tilt;
    this.mesh.position.set(mount.x,mount.y,mount.z+.026);
    this.mesh.name='Instruments';this.mesh.visible=false;
  }

  private printFace(unit:string){
    const c=this.face.getContext('2d')!;
    this.lastUnit=unit;
    const step=unit==='MPH'?20:40;
    this.maxSpeed=Math.ceil(this.spec.topSpeed*(unit==='MPH'?.621371:1)/step)*step;
    c.fillStyle='#141b1e';c.fillRect(0,0,width,height);c.textAlign='center';
    if(this.style==='twin'){
      scale(c,127,110,89,this.maxSpeed/step,1,this.maxSpeed,false);scale(c,513,110,89,this.maxRpm,1,this.maxRpm,true);
      textAt(c,unit,127,170,15,secondary);textAt(c,'×1000 RPM',513,170,14,secondary);
      c.fillStyle='#475254';c.fillRect(257,125,126,1);textAt(c,'GEAR',350,166,15,secondary);
    }else if(this.style==='chronograph'){
      scale(c,322,109,91,this.maxRpm,1,this.maxRpm,true);
      textAt(c,'×1000 RPM',322,175,14,secondary);textAt(c,unit,118,161,20,secondary);textAt(c,'GEAR',518,161,20,secondary);
    }else{
      for(let i=0;i<=this.maxRpm;i++)textAt(c,String(i),36+i*(568/this.maxRpm),31,18,i===this.maxRpm?red:secondary);
      textAt(c,unit,200,168,19,secondary);textAt(c,'GEAR',524,170,19,secondary);
      c.fillStyle='#465256';c.fillRect(447,91,1,79);
    }
  }

  draw(dt:number,car:VehicleController,unit:string,active:boolean){
    this.mesh.visible=active;this.wait-=dt;if(!active||this.wait>0)return;this.wait=1/16;
    const speed=Math.round(Math.abs(car.speed)*(unit==='MPH'?2.23694:3.6));
    this.reading(unit,speed,Math.round(car.engine.rpm/20)*20,car.engine.transmission.gear);
  }
  parked(unit:string){
    this.mesh.visible=true;this.reading(unit,0,0,0);
  }
  private reading(unit:string,speed:number,rpm:number,gear:number){
    const sig=unit+'/'+speed+'/'+rpm+'/'+gear;
    if(sig===this.lastReading)return;this.lastReading=sig;
    if(this.lastUnit!==unit)this.printFace(unit);
    const c=this.ctx,g=gear===0?'N':gear<0?'R':String(gear);
    c.drawImage(this.face,0,0);c.textAlign='center';
    if(this.style==='twin'){
      pointer(c,127,110,79,speed/this.maxSpeed);pointer(c,513,110,79,rpm/(this.maxRpm*1000));
      textAt(c,String(speed),320,110,61,ink,600);textAt(c,g,293,169,32,ink,600);
    }else if(this.style==='chronograph'){
      pointer(c,322,109,84,rpm/(this.maxRpm*1000));textAt(c,String(speed),118,130,72,ink,600);
      textAt(c,g,518,130,66,ink,600);
    }else{
      const activeCount=Math.round(rpm/(this.maxRpm*1000)*40);
      for(let i=0;i<40;i++){
        const x=32+i*14.3,y=47+(1-i/39)*14;
        c.fillStyle=i<activeCount?(i>33?red:'#d9c69f'):'#364347';
        c.beginPath();c.moveTo(x+4,y);c.lineTo(x+14,y);c.lineTo(x+10,76);c.lineTo(x,76);c.closePath();c.fill();
      }
      textAt(c,String(speed),107,168,82,ink,600);textAt(c,g,524,146,55,ink,600);
      textAt(c,rpm.toLocaleString('en-US')+' RPM',335,167,20,secondary);
    }
    this.texture.needsUpdate=true;
  }
  dispose(){this.mesh.removeFromParent();this.mesh.geometry.dispose();this.mesh.material.dispose();this.texture.dispose();}
}
