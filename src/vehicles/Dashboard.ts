import { CanvasTexture, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace } from 'three';
import type { VehicleSpec } from './catalogue';
import type { VehicleController } from '../physics/VehicleController';

export class Dashboard {
  readonly mesh:Mesh<PlaneGeometry,MeshBasicMaterial>;
  private ctx:CanvasRenderingContext2D;private texture:CanvasTexture;private wait=0;
  constructor(spec:VehicleSpec){
    const c=document.createElement('canvas');c.width=384;c.height=128;this.ctx=c.getContext('2d')!;
    this.texture=new CanvasTexture(c);this.texture.colorSpace=SRGBColorSpace;
    this.mesh=new Mesh(new PlaneGeometry(.32,.104),new MeshBasicMaterial({map:this.texture,toneMapped:false,depthTest:false,depthWrite:false}));
    this.mesh.renderOrder=6;
    this.mesh.position.set(spec.cockpitX??-spec.width*.225,spec.height*(spec.design==='concept'?.64:.706),(spec.cockpitZ??-.08)-.61);
    this.mesh.rotation.x=-.19;this.mesh.name='Instruments';
  }
  draw(dt:number,car:VehicleController,unit:string,active:boolean){
    this.mesh.visible=active;this.wait-=dt;if(!active||this.wait>0)return;this.wait=.085;
    const c=this.ctx,rpm=car.engine.rpm,ratio=Math.min(1,rpm/car.spec.redline),gear=car.engine.transmission.gear;
    c.fillStyle='#12191a';c.fillRect(0,0,384,128);c.fillStyle='#414b48';c.fillRect(14,12,356,8);
    c.fillStyle=ratio>.86?'#fa7552':'#e5cfa7';c.fillRect(14,12,356*ratio,8);
    c.fillStyle='#e8ede7';c.font='600 58px Arial';c.fillText(String(Math.round(Math.abs(car.speed)*(unit==='MPH'?2.23694:3.6))),15,87);
    c.font='17px Arial';c.fillStyle='#a7b5a9';c.fillText(unit,16,111);
    c.fillStyle='#e4e9dc';c.font='42px Arial';c.fillText(gear===0?'N':gear<0?'R':String(gear),307,80);
    c.fillStyle='#a7b5a9';c.font='16px Arial';c.fillText('GEAR',300,108);c.fillText(Math.round(rpm/10)*10+' RPM',146,109);this.texture.needsUpdate=true;
  }
  dispose(){this.mesh.removeFromParent();this.mesh.geometry.dispose();this.mesh.material.dispose();this.texture.dispose();}
}
