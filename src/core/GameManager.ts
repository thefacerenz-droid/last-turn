import { AudioManager } from '../audio/AudioManager';
import { CameraManager,cameraNames } from '../camera/CameraManager';
import { InputManager,idleInput,type Action,type Controls } from '../input/InputManager';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { VehicleController } from '../physics/VehicleController';
import { RenderManager } from '../rendering/RenderManager';
import { Showroom } from '../rendering/Showroom';
import { ScoringManager } from '../scoring/ScoringManager';
import { SettingsManager,presets,type Preset,type Graphics,type Settings,type Tune } from '../settings/SettingsManager';
import { TrafficManager } from '../traffic/TrafficManager';
import { MenuUI } from '../ui/MenuUI';
import { RaceHUD } from '../ui/RaceHUD';
import { createVehicleModel,getVehicle,preloadVehicles,vehicles,trafficVehicles,type VehicleModel } from '../vehicles';
import { Dashboard } from '../vehicles/Dashboard';
import { WorldStreamer } from '../world/WorldStreamer';
import { roadAt } from '../world/roads';
import { clamp,damp,STEP } from './math';

interface Session {
  physics:PhysicsWorld;car:VehicleController;traffic:TrafficManager;world:WorldStreamer;
  model:VehicleModel;score:ScoringManager;camera:CameraManager;dash:Dashboard;
}
export class GameManager {
  readonly settings=new SettingsManager(); readonly audio=new AudioManager();
  readonly render:RenderManager;readonly ui:MenuUI;readonly showroom:Showroom;
  private input:InputManager;private hud=new RaceHUD();
  private session?:Session;private showcase?:VehicleModel;private controls:Controls={...idleInput};
  private last=0;private elapsed=0;private frame=1/60;private raf=0;private busy=false;
  private lastSave=0;private physicsCost=0;private headlights=true;private notice='';private noticeEnd=0;
  private selection=0;private frameStamp=0;private stats={draws:0,triangles:0};
  constructor(canvas:HTMLCanvasElement,interfaceEl:HTMLElement){
    const d=this.settings.data;
    if(!vehicles.some(v=>v.id===d.car))d.car=vehicles[0].id;
    this.render=new RenderManager(canvas,d.graphics);
    this.showroom=new Showroom(this.render.renderer);
    this.ui=new MenuUI(interfaceEl,this.settings,()=>getVehicle(d.car),(id,value)=>this.command(id,value));
    this.input=new InputManager(interfaceEl,a=>this.action(a),()=>this.ui.page==='game',(dx,dy)=>{if(this.ui.page==='garage')this.showroom.orbit(dx,dy);});
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&this.ui.page==='game')this.pause();});
    window.addEventListener('blur',()=>{if(this.ui.page==='game')this.pause();});
    window.addEventListener('pagehide',()=>this.saveRun());
    window.addEventListener('resize',()=>this.render.resize());
  }
  async init(){
    await this.selectCar(this.settings.data.car);
    this.render.renderer.domElement.hidden=false;
    this.ui.show('home');this.raf=requestAnimationFrame(this.loop);
    // Prime traffic assets during menu browsing. Start also awaits them and reports a loading error if needed.
    void preloadVehicles(trafficVehicles.map(v=>v.id)).catch(()=>{});
  }
  private async selectCar(id:string){
    const version=++this.selection;
    await preloadVehicles([id]);
    if(version!==this.selection)return;
    const spec=getVehicle(id),t=this.settings.tune(id);
    const model=createVehicleModel(spec,{...t,paint:t.paint??spec.defaultPaint});
    const old=this.showcase;this.showcase=model;this.showroom.setCar(model.root,spec);old?.dispose();
    this.settings.data.car=id;this.settings.save();
    if(this.ui.page!=='game')this.ui.render();
  }
  private async start(){
    if(this.busy)return;
    this.busy=true;this.ui.setBusy(true);this.input.clear();
    void this.audio.unlock().catch(()=>{});
    let physics:PhysicsWorld|undefined,world:WorldStreamer|undefined,traffic:TrafficManager|undefined,model:VehicleModel|undefined;
    try{
      // Yield once so the session transition can paint before the physics and road allocations.
      await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
      const d=this.settings.data,spec=getVehicle(d.car);
      await preloadVehicles([spec.id,...trafficVehicles.map(v=>v.id)]);
      this.closeSession();
      physics=await PhysicsWorld.create(d.route);
      world=await WorldStreamer.create(this.render.scene,d.route);
      world.setQuality(this.worldQuality());world.setLighting(d.lighting);world.update(0,0);
      const t=this.settings.tune(spec.id),car=new VehicleController(physics,spec,t);
      model=createVehicleModel(spec,{...t,roadShadow:true,driver:true,ride:0,paint:t.paint??spec.defaultPaint});this.render.scene.add(model.root);
      traffic=new TrafficManager(physics,this.render.scene,car,this.settings.count,d.graphics.trafficDistance);
      traffic.clearSpawn(0,1);
      const dash=new Dashboard(spec);model.root.add(dash.mesh);
      this.session={physics,world,car,model,traffic,dash,camera:new CameraManager(this.render.camera),score:new ScoringManager()};
      this.render.setGraphics(d.graphics);this.render.setLighting(d.lighting);
      this.headlights=d.lighting==='night'||d.lighting==='evening';this.frameStamp=this.elapsed=this.lastSave=this.noticeEnd=0;
      this.notice='';this.ui.show('game');this.hud.bind(this.ui.el);
    }catch(error){
      if(!this.session){traffic?.dispose();model?.root.removeFromParent();model?.dispose();world?.dispose();physics?.dispose();}
      this.fail(error,'Could not load this session');
    }finally{this.busy=false;this.ui.setBusy(false);this.last=performance.now();}
  }
  private worldQuality(){const g=this.settings.data.graphics;return {drawDistance:g.worldDistance,vegetation:g.vegetation,textureSize:g.texture,anisotropy:Math.min(g.anisotropy,this.render.renderer.capabilities.getMaxAnisotropy())};}
  private saveRun(){const s=this.session;if(s)s.score.save(s.car.spec.id,s.physics.route);}
  private closeSession(){
    const s=this.session;if(!s)return;this.saveRun();this.audio.mute();
    s.traffic.dispose();s.dash.dispose();s.model.root.removeFromParent();s.model.dispose();s.car.dispose();s.world.dispose();s.physics.dispose();this.session=undefined;
  }
  private pause(){if(this.ui.page!=='game')return;this.audio.mute();this.saveRun();this.input.clear();this.elapsed=0;this.ui.show('pause');}
  private resume(){if(!this.session)return;this.elapsed=0;this.last=performance.now();this.input.clear();this.ui.show('game');this.hud.bind(this.ui.el);void this.audio.unlock().catch(()=>{});}
  private message(text:string){this.notice=text;this.noticeEnd=(this.session?.score.time??0)+2;}
  private action(a:Action){
    if(this.busy)return;
    if(this.ui.page!=='game'){
      if(a==='pause'){if(this.ui.page==='pause')this.resume();else if(this.ui.page!=='home')this.ui.back();}
      else if(a.startsWith('nav')||a==='back'||a==='confirm')this.ui.pad(a);
      return;
    }
    const s=this.session;if(!s)return;
    if(a==='pause')this.pause();
    if(a==='up'||a==='down')s.car.shift(a==='up'?1:-1,this.controls,this.settings.data);
    if(a==='camera'||a==='look'){if(a==='look')s.camera.toggleLook();else s.camera.cycle();this.message(cameraNames[s.camera.mode]);}
    if(a==='lights'){this.headlights=!this.headlights;this.message(this.headlights?'Headlights on':'Headlights off');}
    if(a==='leftSignal'||a==='rightSignal'||a==='navLeft'||a==='navRight'){
      const side=a==='leftSignal'||a==='navLeft'?-1:1;s.car.signal=s.car.signal===side?0:side;
      this.message(s.car.signal===0?'Indicator off':side<0?'Left indicator':'Right indicator');
    }
    if(a==='reset'){const n=Math.floor(roadAt(s.physics.route,s.car.s).lanes/2);s.traffic.clearSpawn(s.car.s,n);s.car.reset(s.car.s,n);s.camera.reset();s.score.resetCar();this.message('Vehicle reset');}
    if(a==='diagnostics'){this.settings.data.diagnostics=!this.settings.data.diagnostics;this.settings.save();}
  }
  private field(path:string,value:string|number|boolean){
    const d=this.settings.data;
    if(path==='car'&&typeof value==='string'&&vehicles.some(car=>car.id===value)){
      void this.selectCar(value).catch(e=>this.fail(e,'Vehicle could not be loaded'));return;
    }
    if(path==='preset' && typeof value==='string' && value in presets)this.settings.preset(value as Preset);
    else if(path.startsWith('gfx.')){
      const key=path.slice(4) as keyof Graphics;
      if(typeof d.graphics[key]==='number')Object.assign(d.graphics,{[key]:Number(value)});else Object.assign(d.graphics,{[key]:value});
      d.preset='Custom';
    }else if(path.startsWith('tune.')){
      const key=path.slice(5) as keyof Tune,t=this.settings.tune(d.car);
      Object.assign(t,{[key]:key==='wheelStyle'?Number(value):value});
      this.showcase?.customize(t);
      if(this.session?.car.spec.id===d.car){this.session.car.tune=t;this.session.model.customize({...t,ride:0});}
    }else{
      const key=path as keyof Settings;
      if(!(key in d))return;
      Object.assign(d,{[key]:typeof d[key]==='number'?Number(value):value});
    }
    if(path==='preset'||path.startsWith('gfx.')){
      this.render.setGraphics(d.graphics);this.session?.world.setQuality(this.worldQuality());
      if(this.session)this.session.traffic.viewDistance=d.graphics.trafficDistance;
    }
    if(path==='lighting'){
      this.render.setLighting(d.lighting);this.session?.world.setLighting(d.lighting);this.headlights=d.lighting==='night'||d.lighting==='evening';
    }
    if(path==='density'||path==='customCount')this.session?.traffic.setCount(this.settings.count);
    this.settings.save();this.ui.render();
  }
  private command(id:string,value?:string|number|boolean){
    if(id==='page')return;
    if(id.startsWith('field:')&&value!==undefined){this.field(id.slice(6),value);return;}
    if(id==='drive'||id==='restart'){void this.start();return;}
    if(id==='pause'){this.pause();return;}if(id==='resume'){this.resume();return;}
    if(id==='menu'){this.closeSession();this.ui.show('home');return;}
    if(id==='prev-car'||id==='next-car'){
      const current=vehicles.findIndex(c=>c.id===this.settings.data.car);
      const idNext=vehicles[(current+(id==='next-car'?1:-1)+vehicles.length)%vehicles.length].id;
      void this.selectCar(idNext).catch(e=>this.fail(e,'Vehicle could not be loaded'));
    }
  }
  private fail(error:unknown,title:string){
    console.error(title,error);const box=document.createElement('dialog');box.className='failure';
    const h=document.createElement('h2');h.textContent=title;const p=document.createElement('p');p.textContent=error instanceof Error?error.message:String(error);
    const button=document.createElement('button');button.className='primary';button.textContent='Return to menu';
    button.onclick=()=>{box.close();box.remove();this.closeSession();this.ui.show('home');};box.append(h,p,button);document.body.append(box);box.showModal();
  }
  private loop=(now:number)=>{
    this.raf=requestAnimationFrame(this.loop);
    const d=this.settings.data,limit=d.graphics.fpsLimit;
    if(limit && now-this.frameStamp<1000/limit-1)return;
    if(document.hidden){this.last=now;return;}
    if(limit)this.frameStamp=now-((now-this.frameStamp)%(1000/limit));else this.frameStamp=now;
    const raw=this.last?(now-this.last)/1000:STEP;const dt=clamp(raw,0,.15);this.last=now;
    this.frame=damp(this.frame,Math.min(raw,.5),3,Math.max(dt,.001));
    this.controls=this.input.read(clamp(d.deadzone,0,.45));this.render.resize();
    const s=this.session;
    if(this.ui.page!=='game'||!s){
      if(this.ui.page==='garage'&&(this.controls.lookX||this.controls.lookY))this.showroom.orbit(this.controls.lookX*dt*180,this.controls.lookY*dt*110);
      if(this.ui.showcase)this.showroom.render(dt,this.ui.garageOpen,this.ui.interior,d);return;
    }
    this.elapsed=Math.min(this.elapsed+dt,STEP*8);
    const start=performance.now();let steps=0;
    while(this.elapsed+1e-9>=STEP){
      s.physics.terrain(s.car.s);s.car.step(STEP,this.controls,d);s.traffic.step(STEP);
      s.physics.step((a,b,impulse)=>{
        s.traffic.incident(a,impulse);s.traffic.incident(b,impulse);
        if((a===s.car.collider.handle||b===s.car.collider.handle)&&impulse>s.car.spec.mass*.22){
          if(s.car.impactTime<=0){const v=impulse/s.car.spec.mass;s.score.impact();this.audio.impact(v);s.camera.impact(v);}
          s.car.impactTime=.28;
        }
      });
      s.car.capture();s.traffic.capture();s.score.step(STEP,s.car,s.traffic.cars);
      this.elapsed=Math.max(0,this.elapsed-STEP);steps++;
    }
    this.physicsCost=damp(this.physicsCost,(performance.now()-start)/Math.max(1,steps),3,Math.max(dt,.001));
    const alpha=this.elapsed/STEP;s.car.draw(s.model,alpha,this.headlights,s.camera.mode===3);s.traffic.draw(alpha,d.graphics.trafficDistance,this.headlights||d.lighting==='night');
    s.world.update(s.car.s,dt);s.camera.update(dt,s.car,this.controls,d,alpha);
    s.dash.draw(dt,s.car,d.unit,s.camera.mode===3);
    this.audio.update(s.car,d,s.traffic.nearestDistance(),s.camera.mode===3);
    this.render.renderer.info.autoReset=false;this.render.renderer.info.reset();
    this.render.draw(dt,s.car,this.headlights);
    this.stats.draws=this.render.renderer.info.render.calls;this.stats.triangles=this.render.renderer.info.render.triangles;
    this.hud.update(dt,s.car,s.traffic,s.score,d,this.frame*1000,this.physicsCost,this.stats.draws,this.stats.triangles,s.score.time<this.noticeEnd?this.notice:'');
    if(s.score.time-this.lastSave>15){this.saveRun();this.lastSave=s.score.time;}
  };
}
