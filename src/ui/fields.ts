import type { Settings, Graphics, Tune } from '../settings/SettingsManager';
import { lightNames, densityCounts, presets } from '../settings/SettingsManager';
import { icon } from './icons';
export function select(label:string,key:string,options:readonly (string|number)[]|Record<string,string>,value:string|number){
  const entries=Array.isArray(options)?options.map(v=>[String(v),String(v)]):Object.entries(options);
  return '<label class="field"><span>'+label+'</span><select aria-label="'+label+'" data-field="'+key+'">'+entries.map(([v,title])=>'<option value="'+v+'"'+(String(value)===v?' selected':'')+'>'+title+'</option>').join('')+'</select></label>';
}
export function range(label:string,key:string,value:number,min:number,max:number,step:number,units=''){
  return '<label class="field range-field"><span>'+label+'</span><span class="range-control"><input aria-label="'+label+'" data-field="'+key+'" type="range" min="'+min+'" max="'+max+'" step="'+step+'" value="'+value+'"><output>'+Number(value.toFixed(2))+units+'</output></span></label>';
}
function toggle(label:string,key:string,on:boolean){
  return '<label class="field"><span>'+label+'</span><input type="checkbox" class="switch" data-field="'+key+'" '+(on?'checked':'')+'></label>';
}
export function sessionFields(s:Settings){return select('Lighting','lighting',lightNames,s.lighting)+select('Traffic density','density',[...Object.keys(densityCounts),'Custom'],s.density)+(s.density==='Custom'?range('Active vehicles','customCount',s.customCount,6,72,1):'');}
export function options(tab:string,s:Settings) {
  if(tab==='Driving')return select('Speed units','unit',['MPH','KM/H'],s.unit)+select('Transmission','mode',['Automatic','Manual'],s.mode)+
    select('Touch controls','touch',['Auto','On','Off'],s.touch)+toggle('Automatic clutch','autoClutch',s.autoClutch)+toggle('Traction control','traction',s.traction)+toggle('Steering assist','steeringAssist',s.steeringAssist)+
    range('Steering sensitivity','sensitivity',s.sensitivity,.55,1.6,.05)+range('Stick dead zone','deadzone',s.deadzone,.02,.35,.01)+
    range('Field of view','fov',s.fov,44,90,1,'°')+range('Chase distance','chaseDistance',s.chaseDistance,4.8,10,.1,'m')+
    range('Chase height','chaseHeight',s.chaseHeight,1.5,4,.05,'m')+toggle('Route minimap','minimap',s.minimap);
  if(tab==='Audio')return toggle('Mute audio','muted',s.muted)+range('Master volume','master',s.master,0,1,.01)+range('Engine & drivetrain','engine',s.engine,0,1,.01)+range('Road & passing traffic','road',s.road,0,1,.01)+range('Tires & impacts','effects',s.effects,0,1,.01);
  const g=s.graphics;
  return select('Graphics preset','preset',[...Object.keys(presets),...(s.preset==='Custom'?['Custom']:[])],s.preset)+
    range('Render scale','gfx.scale',g.scale,.5,1.5,.05)+'<div class="field-group">World detail</div>'+
    select('Road texture resolution','gfx.texture',{'256':'256 px','512':'512 px','1024':'1024 px','2048':'2048 px'},g.texture)+
    select('Shadow quality','gfx.shadows',{'0':'Off','512':'Low','1024':'Medium','2048':'High','4096':'Ultra'},g.shadows)+
    range('Shadow distance','gfx.shadowDistance',g.shadowDistance,30,175,5,'m')+
    select('Reflections','gfx.reflections',{'0':'Basic probe','1':'Clear probe','2':'Screen space','3':'Extended screen space'},g.reflections)+
    range('Vegetation density','gfx.vegetation',g.vegetation,.2,1,.05)+range('Traffic draw distance','gfx.trafficDistance',g.trafficDistance,150,900,10,'m')+
    range('World draw distance','gfx.worldDistance',g.worldDistance,450,1650,25,'m')+
    select('Anisotropic filtering','gfx.anisotropy',[1,2,4,8,16],g.anisotropy)+'<div class="field-group">Image processing</div>'+
    toggle('Antialiasing','gfx.aa',g.aa)+toggle('Postprocessing','gfx.post',g.post)+
    '<fieldset '+(!g.post?'disabled':'')+'>'+toggle('Ambient occlusion','gfx.ao',g.ao)+toggle('Bloom','gfx.bloom',g.bloom)+toggle('Motion blur','gfx.blur',g.blur)+'</fieldset>'+
    toggle('Atmospheric clouds','gfx.atmosphere',g.atmosphere)+select('Frame limit','gfx.fpsLimit',{'0':'Display refresh','30':'30 FPS','45':'45 FPS','60':'60 FPS','90':'90 FPS','120':'120 FPS','144':'144 FPS'},g.fpsLimit)+
    toggle('FPS counter','showFps',s.showFps)+toggle('Performance diagnostics','diagnostics',s.diagnostics);
}
export const palette=['#b7c3c6','#ddd9cc','#8b9c91','#526d83','#a13c2d','#d39340','#2f3539','#64715a'];
export function paintFields(t:Tune,stock:string,s:Settings){
  return '<div class="field paint-field"><span>Body color</span><div class="swatches">'+Array.from(new Set([stock,...palette])).map(c=>'<button aria-label="Paint '+c+'" data-paint="'+c+'" style="--paint:'+c+'" class="'+((t.paint??stock)===c?'chosen':'')+'"></button>').join('')+'</div></div>'+
  range('Metallic finish','tune.metallic',t.metallic,0,1,.05)+select('Wheel design','tune.wheelStyle',{'0':'Factory','1':'Split spoke','2':'Track mesh'},t.wheelStyle)+
  select('Wheel finish','tune.wheelColor',{'#686b6a':'Gunmetal','#b4b4ae':'Machined silver','#242726':'Graphite','#9a805d':'Bronze'},t.wheelColor)+
  range('Ride height offset','tune.ride',t.ride,-.06,.075,.005,'m')+range('Spring stiffness','tune.spring',t.spring,.7,1.45,.05,'×')+
  range('Steering sensitivity','sensitivity',s.sensitivity,.55,1.6,.05)+select('Transmission','mode',['Automatic','Manual'],s.mode);
}
export function controls(){
  const groups=[['Keyboard',[['W / ↑','Accelerate'],['S / ↓','Brake · hold at rest to reverse in automatic'],['A D / ← →','Steer'],['Space','Handbrake'],['Q / E','Downshift / upshift in manual'],['Shift','Clutch'],['C / V','Cycle camera / free look'],['Drag','Look around'],['L / R','Headlights / reset vehicle'],['Z / X','Left / right indicators'],['Esc / F3','Pause / diagnostics']]],
  ['Standard controller',[['RT / LT','Accelerate / brake'],['Left stick','Steer'],['Right stick','Look around'],['Y / X','Camera / handbrake'],['LB / RB','Downshift / upshift'],['A','Clutch · select in menus'],['View / Menu','Reset / pause'],['D-pad / B','Navigate menus / back']]]] as const;
  const touch='<h3 class="field-group">Touch</h3><div class="control-row"><kbd>Left thumb</kbd><span>Hold either arrow to steer. Handbrake sits above the arrows.</span></div><div class="control-row"><kbd>Right thumb</kbd><span>Hold Gas or Brake. Keep Brake held at a stop for automatic reverse.</span></div><div class="control-row"><kbd>Camera</kbd><span>Tap the camera to change view or drag across the road to look around.</span></div><div class="control-row"><kbd>Manual</kbd><span>Tap Gear − or Gear + to shift. Hold Clutch if automatic clutch is off.</span></div>';
  return touch+groups.map(([title,rows])=>'<h3 class="field-group">'+title+'</h3>'+rows.map(([key,ex])=>'<div class="control-row"><kbd>'+key+'</kbd><span>'+ex+'</span></div>').join('')).join('');
}
export const closeButton='<button type="button" class="icon-btn close" data-action="back" title="Back" aria-label="Back">'+icon('close')+'</button>';
