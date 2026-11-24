import { clockTime,clamp } from '../core/math';
import type { VehicleController } from '../physics/VehicleController';
import type { ScoringManager } from '../scoring/ScoringManager';
import type { Settings } from '../settings/SettingsManager';
import type { TrafficManager } from '../traffic/TrafficManager';
import { roadAt,ROUTES } from '../world/roads';
import { icon } from './icons';
import { touchMarkup } from '../input/TouchControls';
export function hudMarkup(settings:Settings){
  const touch=settings.touch==='On'||(settings.touch==='Auto'&&matchMedia('(any-pointer: coarse)').matches);
  const revSegments=Array.from({length:24},(_,i)=>'<i class="'+(i>=20?'redline':'')+'"></i>').join('');
  return '<div class="hud'+(touch?' touch-layout':'')+'"><div class="score-box"><small>Drive score</small><strong id="score">0</strong><b id="combo">×1.0</b></div><div class="hud-top-right"><span id="fps-read"></span><span id="session-clock">00:00</span><button class="hud-pause" data-tap="pause" title="Pause" aria-label="Pause">'+icon('pause',16)+'</button></div>'+
    '<div id="pass-notice"></div><div class="map-hud"><canvas id="minimap" width="300" height="190" aria-label="Nearby route and traffic"></canvas><span id="map-name"></span></div>'+
    '<div class="cluster"><div class="gear-read"><small>GEAR</small><strong id="gear">1</strong></div><div class="speed-read"><strong id="speed">0</strong><small id="unit">MPH</small></div><div class="tach">'+revSegments+'</div><div class="rpm-read"><span id="rpm">800 RPM</span><span id="transmission">AUTO</span></div></div>'+
    '<div class="drive-hints"><span><kbd>W</kbd> Accelerate</span><span><kbd>S</kbd> Brake</span><span><kbd>C</kbd> Camera</span><span><kbd>Esc</kbd> Pause</span></div><pre id="diagnostics"></pre>'+touchMarkup(settings)+'</div>';
}
export class RaceHUD {
  private root?:HTMLElement;private elements=new Map<string,HTMLElement>();private rev:HTMLElement[]=[];private next=0;
  bind(root:HTMLElement){this.root=root;this.elements.clear();root.querySelectorAll<HTMLElement>('[id]').forEach(e=>this.elements.set(e.id,e));this.rev=Array.from(root.querySelectorAll('.tach i'));this.next=0;}
  private text(id:string,text:string){const e=this.elements.get(id);if(e&&e.textContent!==text)e.textContent=text;}
  update(dt:number,v:VehicleController,traffic:TrafficManager,score:ScoringManager,s:Settings,frameMs:number,physicsMs:number,draws:number,triangles:number,notice:string){
    this.next-=dt;if(this.next>0||!this.root)return;this.next=.07;
    this.text('score',Math.floor(score.score).toLocaleString());this.text('combo','×'+score.combo.toFixed(1));this.text('session-clock',clockTime(score.time));
    this.text('gear',v.engine.transmission.gear===0?'N':v.engine.transmission.gear<0?'R':String(v.engine.transmission.gear));
    this.text('speed',String(Math.round(Math.abs(v.speed)*(s.unit==='MPH'?2.23694:3.6))));this.text('unit',s.unit);this.text('rpm',Math.round(v.engine.rpm/10)*10+' RPM');this.text('transmission',s.mode==='Automatic'?'AUTO':'MANUAL');
    const bar=v.engine.rpm/v.spec.redline*this.rev.length;this.rev.forEach((e,i)=>e.classList.toggle('on',i<bar));
    this.text('pass-notice',notice||(score.messageUntil>score.time?score.message:''));
    this.text('fps-read',s.showFps?Math.round(1000/Math.max(1,frameMs))+' FPS':'');
    this.root.querySelector('.drive-hints')?.classList.toggle('gone',score.time>8);
    const diag=this.elements.get('diagnostics')!;
    diag.hidden=!s.diagnostics;
    if(s.diagnostics)this.text('diagnostics',['FRAME   '+frameMs.toFixed(1)+' ms  /  '+(1000/frameMs).toFixed(0)+' FPS','PHYSICS 60 Hz  /  '+physicsMs.toFixed(2)+' ms','TRAFFIC '+traffic.cars.length+'  /  '+traffic.cars.filter(c=>c.body).length+' rigid bodies',
      'VEHICLE '+(v.speed*3.6).toFixed(1)+' km/h  /  '+Math.round(v.engine.rpm)+' RPM  /  G'+v.engine.transmission.gear,'STEER   '+(v.steer*180/Math.PI).toFixed(1)+'°','SPRINGS '+v.wheels.map(w=>Math.round(w.compression*1000)).join('  ')+' mm','SLIP    '+v.wheels.map(w=>w.slip.toFixed(2)).join('  '),'DRAW    '+draws+' calls  /  '+(triangles/1000).toFixed(0)+'k triangles'].join('\n'));
    const canvas=this.elements.get('minimap') as HTMLCanvasElement;
    canvas.parentElement!.hidden=!s.minimap;if(s.minimap)this.map(canvas,v,traffic);
  }
  private map(canvas:HTMLCanvasElement,car:VehicleController,traffic:TrafficManager){
    const ctx=canvas.getContext('2d');if(!ctx)return;
    const route=car.physics.route,w=canvas.width,h=canvas.height;
    const x=(worldX:number)=>(worldX-car.position.x)*1.28+w*.5,y=(s:number)=>h-41-(s-car.s)*.53;
    ctx.clearRect(0,0,w,h);ctx.fillStyle='rgba(15,22,21,.81)';ctx.fillRect(0,0,w,h);
    ctx.strokeStyle='rgba(134,157,146,.10)';ctx.lineWidth=1;
    for(let a=-h;a<w;a+=25){ctx.beginPath();ctx.moveTo(a,0);ctx.lineTo(a+h,h);ctx.stroke();}
    const width=roadAt(route,car.s).lanes*4.7;
    for(const [thick,color] of [[width+3,'#76817b'],[width,'#39443f']] as const){
      ctx.beginPath();ctx.lineWidth=thick;ctx.strokeStyle=color;
      for(let ds=-100;ds<340;ds+=8){const at=car.s+ds,rx=roadAt(route,at).x;if(ds===-100)ctx.moveTo(x(rx),y(at));else ctx.lineTo(x(rx),y(at));}ctx.stroke();
    }
    ctx.fillStyle='#d2cec1';
    for(const c of traffic.cars)if(Math.abs(c.s-car.s)<330){ctx.beginPath();ctx.arc(x(c.x),y(c.s),2.5,0,Math.PI*2);ctx.fill();}
    ctx.save();ctx.translate(w/2,y(car.s));ctx.rotate(Math.atan2(car.forward.x,-car.forward.z));ctx.fillStyle='#ff7446';ctx.beginPath();ctx.moveTo(0,-8);ctx.lineTo(5.5,6);ctx.lineTo(0,3);ctx.lineTo(-5.5,6);ctx.closePath();ctx.fill();ctx.restore();
    this.text('map-name',ROUTES.find(r=>r.id===route)!.name+'   /   '+(Math.max(0,car.s)/1000).toFixed(1)+' km');
  }
}
