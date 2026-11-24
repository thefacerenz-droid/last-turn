import { clockTime } from '../core/math';
import { records } from '../scoring/ScoringManager';
import { lightNames, type SettingsManager } from '../settings/SettingsManager';
import { ROUTES, roadAt, type Route } from '../world/roads';
import { vehicles, type VehicleSpec } from '../vehicles';
import { brand,icon } from './icons';
import { closeButton,controls,options,paintFields,sessionFields,select } from './fields';
import { hudMarkup } from './RaceHUD';

export type Page='home'|'garage'|'routes'|'setup'|'settings'|'controls'|'records'|'game'|'pause';
type Emit=(action:string,value?:string|number|boolean)=>void;
const titles:Partial<Record<Page,string>>={setup:'Session setup',routes:'Routes',settings:'Settings',controls:'Controls',records:'Records'};
const nightIcon=(t:string)=>t==='night'?'moon':t==='overcast'?'cloud':'sun';
const action=(id:string,label:string,className='',glyph='')=>'<button type="button" class="'+className+'" data-action="'+id+'">'+(glyph?icon(glyph,18):'')+label+'</button>';
const fieldStat=(label:string,value:string)=>'<div><dt>'+label+'</dt><dd>'+value+'</dd></div>';
function mapPreview(r:Route){
  const points:string[]=[];
  for(let i=0;i<=64;i++){const s=i*83;points.push((12+i*2.35).toFixed(1)+','+(38-roadAt(r.id,s).x*.12).toFixed(1));}
  return '<svg class="route-map" viewBox="0 0 175 80" aria-hidden="true"><defs><pattern id="grid-'+r.id+'" width="13" height="13" patternUnits="userSpaceOnUse" patternTransform="rotate(16)"><path d="M0 0H13V13" fill="none" stroke="#4b5750" stroke-width=".75"/></pattern></defs><rect width="175" height="80" fill="#26312e"/><rect width="175" height="80" fill="url(#grid-'+r.id+')"/><polyline points="'+points.join(' ')+'" fill="none" stroke="#171b18" stroke-width="6"/><polyline points="'+points.join(' ')+'" fill="none" stroke="#ef885d" stroke-width="2.5"/><circle cx="12" cy="38" r="3" fill="#f0e4ce"/></svg>';
}
export class MenuUI {
  page:Page='home'; private stack:Page[]=[];private tab='Graphics';private garageTab='Overview';
  private busy=false; private garageFromSession=false;
  constructor(readonly el:HTMLElement,readonly store:SettingsManager,private current:()=>VehicleSpec,private emit:Emit){
    el.addEventListener('click',e=>{
      const b=(e.target as Element).closest<HTMLButtonElement>('button');if(!b||b.disabled)return;
      if(b.dataset.action)this.act(b.dataset.action);
      else if(b.dataset.paint)this.emit('field:tune.paint',b.dataset.paint);
      else if(b.dataset.route)this.emit('field:route',b.dataset.route);
      else if(b.dataset.view){this.interior=b.dataset.view==='inside';this.render();}
      else if(b.dataset.tab){this.tab=b.dataset.tab;this.render();}
      else if(b.dataset.garage){this.garageTab=b.dataset.garage;this.render();}
    });
    el.addEventListener('input',e=>{
      const field=e.target as HTMLInputElement;if(field.type==='range'&&field.nextElementSibling)field.nextElementSibling.textContent=field.value;
    });
    el.addEventListener('change',e=>{
      const field=e.target as HTMLInputElement;if(!field.dataset.field)return;
      const val=field.type==='checkbox'?field.checked:field.type==='range'?Number(field.value):field.value;
      this.emit('field:'+field.dataset.field,val);
    });
    window.addEventListener('keydown',e=>{
      if(e.repeat||this.page==='game'||/INPUT|SELECT/.test((e.target as HTMLElement)?.tagName))return;
      if(this.page==='home' && ['Enter','KeyG','KeyM'].includes(e.code)){
        if(e.code==='Enter'&&(e.target as HTMLElement).tagName==='BUTTON')return;
        e.preventDefault();this.act(e.code==='Enter'?'drive':e.code==='KeyG'?'garage':'routes');
      }
    });
  }
  act(id:string){
    if(this.busy)return;
    if(id==='back'){this.back();return;}
    if(id==='toggle-audio'){this.emit('field:muted',!this.store.data.muted);return;}
    if(id==='garage'||id==='home'||id==='settings'||id==='controls'||id==='routes'||id==='setup'||id==='records'){
      if(id==='home'&&this.garageFromSession){this.emit('menu');return;}
      if(id==='garage'&&this.page==='pause')this.garageFromSession=true;
      if(id==='home')this.stack=[];
      else if(this.page!==id)this.stack.push(this.page);
      this.show(id);return;
    }
    this.emit(id);
  }
  back(){
    if(this.page==='pause'){this.emit('resume');return;}
    if(this.page==='game'){this.emit('pause');return;}
    const last=this.stack.pop();this.show(last??'home');
  }
  show(page:Page){this.page=page;if(page==='game'||page==='home'){this.garageFromSession=false;this.stack=[];}this.render();this.emit('page');}
  setBusy(value:boolean){this.busy=value;this.el.classList.toggle('busy',value);this.el.setAttribute('aria-busy',String(value));}
  get showcase(){return this.page==='home'||this.page==='garage'||this.stack.includes('home')||this.stack.includes('garage');}
  interior=false;
  get garageOpen(){return this.page==='garage'||this.stack.includes('garage');}
  get suspended(){return this.page==='pause'||this.stack.includes('pause');}
  private header(){
    const s=this.store.data;
    const nav:[string,string][]=[['home','Drive'],['garage','Garage'],['routes','Routes'],['records','Records']];
    const links=this.page==='home'?'':'<nav aria-label="Main menu">'+nav.map(([id,t])=>action(id,t,'nav-item '+(this.page===id?'active':''))).join('')+'</nav>';
    return '<header class="masthead"><button class="brand" aria-label="Last Exit home" data-action="home">'+brand+'</button>'+links+'<div class="header-tools">'+
      '<button class="icon-btn audio-btn" data-action="toggle-audio" title="'+(s.muted?'Unmute':'Mute audio')+'" aria-label="'+(s.muted?'Unmute':'Mute audio')+'">'+icon(s.muted?'silent':'sound',19)+'</button>'+
      '<button class="icon-btn" data-action="controls" title="Controls" aria-label="Controls">'+icon('keys',22)+'</button><button class="icon-btn" data-action="settings" title="Settings" aria-label="Settings">'+icon('gear',20)+'</button></div></header>';
  }
  private home(r:Route){
    const car=this.current(),s=this.store.data;
    const shield='<svg class="route-shield" viewBox="0 0 54 53" aria-hidden="true"><path d="M4 6Q15 7 27 2Q39 7 50 6L47 31Q44 42 27 50Q10 42 7 31Z"/><text x="27" y="16" class="shield-state">CALIF.</text><text x="27" y="37">'+Number(r.shield)+'</text></svg>';
    return this.header()+`
      <section class="start-grid" aria-label="Main menu">
        <nav class="start-list" aria-label="Choose an activity">
          <button data-action="drive" class="start-drive primary" aria-label="Start driving">Drive <kbd>Enter</kbd></button>
          ${action('garage','Garage')}${action('routes','Routes')}${action('records','Records')}
        </nav>
        <div class="car-caption">
          <div class="car-typeset"><span>${car.drivetrain} &nbsp; / &nbsp; ${car.hp} hp</span><strong>${car.name}</strong></div>
          <div class="car-switch">${action('prev-car','<span class="sr-only">Previous vehicle</span>','selector-arrow','left')}${action('next-car','<span class="sr-only">Next vehicle</span>','selector-arrow','right')}</div>
        </div>
      </section>
      <footer class="run-strip">
        <button data-action="routes" class="route-stamp" aria-label="Change route">${shield}<span><strong>${r.name}</strong><small>${r.district}, California</small></span></button>
        <div class="run-conditions"><span>${icon(nightIcon(s.lighting),18)}${lightNames[s.lighting]}</span><span>${icon('road',17)}${this.store.count} traffic vehicles</span></div>
        ${action('setup','Session setup','setup-button','sliders')}
      </footer>`;
  }
  private garage(){
    const v=this.current(),t=this.store.tune(v.id);
    const stats=fieldStat('Power',v.hp+' hp')+fieldStat('Peak torque',v.torque+' Nm')+fieldStat('Curb weight',v.mass.toLocaleString()+' kg')+fieldStat('Drivetrain',v.drivetrain)+fieldStat('Top speed',v.topSpeed+' km/h')+fieldStat('0–100 km/h',v.zeroTo100+' s')+fieldStat('Weight on front axle',Math.round(v.frontWeight*100)+'%')+fieldStat('Transmission',v.gears.length+' speeds');
    return this.header()+'<section class="garage-layout"><div class="garage-sheet"><div class="section-tag">Garage</div><div class="vehicle-picker">'+action('prev-car','<span class="sr-only">Previous car</span>','icon-btn','left')+'<span>'+String(vehicles.indexOf(v)+1).padStart(2,'0')+' / '+vehicles.length+'</span>'+action('next-car','<span class="sr-only">Next car</span>','icon-btn','right')+'</div>'+
    '<div class="garage-model"><h1>'+v.name+'</h1>'+icon('down',15)+'<select aria-label="Select vehicle" data-field="car">'+vehicles.map(car=>'<option value="'+car.id+'"'+(car.id===v.id?' selected':'')+'>'+car.name+'</option>').join('')+'</select></div><p class="car-category">'+v.category+'</p><div class="tabs">'+['Overview','Customize'].map(x=>'<button data-garage="'+x+'" class="'+(this.garageTab===x?'selected':'')+'">'+x+'</button>').join('')+'</div>'+
      '<div class="scroll-area">'+(this.garageTab==='Overview'?'<dl class="specs">'+stats+'</dl>':paintFields(t,v.defaultPaint,this.store.data))+'</div><div class="sheet-actions">'+action('drive','Drive this car','primary','play')+action('back','Back','flat')+'</div></div>'+
      '<div class="garage-view-tools" aria-label="Garage camera"><button aria-pressed="'+(!this.interior)+'" data-view="outside">Exterior</button><button aria-pressed="'+this.interior+'" data-view="inside">Cockpit</button></div></section>';
  }
  private overlayBody(r:Route){
    const s=this.store.data;
    if(this.page==='settings')return '<div class="tabs">'+['Graphics','Driving','Audio'].map(t=>'<button data-tab="'+t+'" class="'+(t===this.tab?'selected':'')+'">'+t+'</button>').join('')+'</div><div class="scroll-area">'+options(this.tab,s)+'</div>';
    if(this.page==='controls')return '<div class="scroll-area">'+controls()+'<a class="credit-link" href="/credits.html" target="_blank" rel="noopener">Art and licenses</a></div>';
    if(this.page==='setup')return '<div class="scroll-area">'+select('Highway','route',Object.fromEntries(ROUTES.map(v=>[v.id,v.name])),s.route)+sessionFields(s)+'</div><div class="sheet-actions">'+action(this.suspended?'back':'drive',this.suspended?'Done':'Start driving','primary',this.suspended?'enter':'play')+'</div>';
    if(this.page==='routes')return '<div class="routes-list scroll-area">'+ROUTES.map(v=>'<button data-route="'+v.id+'" class="route-choice '+(v.id===r.id?'chosen':'')+'"><img class="route-map" alt="" src="/art/'+v.id+'-thumb.webp"><span><small>Route '+v.shield+' · '+v.lanes+' lanes</small><strong>'+v.name+'</strong><em>'+v.district+'</em></span><i></i></button>').join('')+'<div class="route-detail">'+mapPreview(r)+'<p class="route-description">'+r.description+'</p></div></div><div class="sheet-actions">'+action('back','Use this route','primary','enter')+action('setup','Session setup','flat','sliders')+'</div>';
    const list=records();
    return '<div class="scroll-area">'+(list.length?'<ol class="record-list">'+list.map((run,i)=>'<li><span>'+String(i+1).padStart(2,'0')+'</span><div><strong>'+(vehicles.find(v=>v.id===run.car)?.name??'Club vehicle')+'</strong><small>'+(ROUTES.find(r=>r.id===run.route)?.name??'Coastal route')+' · '+clockTime(run.seconds)+' · '+(run.distance/1000).toFixed(1)+' km</small></div><b>'+run.score.toLocaleString()+' <small>PTS</small></b></li>').join('')+'</ol>':'<div class="record-empty">'+icon('flag',34)+'<h3>Your first run awaits</h3><p>Complete a drive to record your score, distance and personal best.</p>'+action('drive','Start driving','primary','play')+'</div>')+'</div>';
  }
  render(){
    const r=ROUTES.find(r=>r.id===this.store.data.route)??ROUTES[0];
    const pos=this.el.querySelector('.scroll-area')?.scrollTop??0;
    const oldPage=this.el.dataset.page;this.el.dataset.page=this.page;
    if(this.page==='game')this.el.innerHTML=hudMarkup(this.store.data);
    else if(this.page==='home')this.el.innerHTML=this.home(r);
    else if(this.page==='garage')this.el.innerHTML=this.garage();
    else if(this.page==='pause')this.el.innerHTML='<section class="overlay pause-overlay"><div class="option-sheet pause-sheet"><div class="section-tag">Session paused</div><h1>'+r.name+'</h1><div class="pause-list">'+
      action('resume','Resume drive','primary','play')+action('restart','Restart session','','rotate')+action('garage','Change vehicle','','car')+action('settings','Settings','','sliders')+action('controls','Controls','','keys')+action('menu','Return to main menu','','left')+'</div></div></section>';
    else this.el.innerHTML=(this.suspended?'':this.header())+'<section class="overlay"><div class="option-sheet '+(this.page==='routes'?'map-sheet':'')+'"><div class="sheet-title"><h1>'+titles[this.page]+'</h1>'+closeButton+'</div>'+this.overlayBody(r)+'</div></section>';
    if(oldPage===this.page){const area=this.el.querySelector('.scroll-area');if(area)area.scrollTop=pos;}
    this.el.classList.toggle('in-race',this.page==='game');document.body.dataset.page=this.page;
  }
  pad(actionName:string){
    if(actionName==='back'){this.back();return;}
    const buttons=Array.from(this.el.querySelectorAll<HTMLElement>('button:not([disabled]),select:not([disabled]),input:not([disabled])')).filter(e=>e.offsetParent!==null);
    const index=buttons.indexOf(document.activeElement as HTMLElement);
    if(actionName==='confirm'){if(index<0)buttons.find(b=>b.classList.contains('primary'))?.click();else buttons[index].click();return;}
    const active=buttons[index];
    if((actionName==='navLeft'||actionName==='navRight')&&active&&(active instanceof HTMLSelectElement||active instanceof HTMLInputElement&&active.type==='range')){
      const dir=actionName==='navLeft'?-1:1;
      if(active instanceof HTMLSelectElement)active.selectedIndex=Math.max(0,Math.min(active.options.length-1,active.selectedIndex+dir));
      else if(dir>0)active.stepUp();else active.stepDown();
      const key=active.dataset.field;active.dispatchEvent(new Event('change',{bubbles:true}));this.el.querySelector<HTMLElement>('[data-field="'+key+'"]')?.focus();return;
    }
    if(buttons.length)buttons[(index+(actionName==='navLeft'||actionName==='navUp'?-1:1)+buttons.length)%buttons.length].focus();
  }
}
