import { clamp } from '../core/math';
import { readLocal,saveLocal } from '../settings/SettingsManager';

type Placement = {x:number;y:number;scale:number};
type Layout = Record<string,Placement>;
type Orientation = 'portrait'|'landscape';
const key='last-exit.touch-layout.1';
const selector='button[data-hold],button[data-tap]';
const id=(b:HTMLElement)=>b.dataset.hold??b.dataset.tap!;

export const layoutToolbar=`<section class="layout-tools" aria-label="Edit touch layout">
  <header><strong>Touch layout</strong><button data-layout="move">Move panel</button></header>
  <label>Drag to move <select aria-label="Button to edit"></select></label>
  <label>Size <input aria-label="Button size" type="range" min="75" max="175" step="5"><output></output></label>
  <div><button data-layout="reset">Reset layout</button><button data-action="back">Cancel</button><button class="primary" data-layout="save">Save layout</button></div>
</section>`;

export class TouchLayout {
  private saved=readLocal<Partial<Record<Orientation,Layout>>>(key,{})??{};
  private draft?:Partial<Record<Orientation,Layout>>;
  private selected='gas';
  private drag?:{pointer:number;button:HTMLElement;dx:number;dy:number};
  private get orientation():Orientation{return this.root.clientWidth>=this.root.clientHeight?'landscape':'portrait';}
  private get buttons(){return [...this.root.querySelectorAll<HTMLButtonElement>(selector)];}
  private get toolbar(){return this.root.querySelector<HTMLElement>('.layout-tools');}

  constructor(private root:HTMLElement,private close:()=>void){
    new ResizeObserver(()=>{this.drag=undefined;this.apply();}).observe(root);
    root.addEventListener('pointerdown',e=>{
      const b=(e.target as Element).closest<HTMLButtonElement>(selector);
      if(!this.draft||!b||this.drag)return;
      e.preventDefault();b.setPointerCapture(e.pointerId);
      const rect=b.getBoundingClientRect();this.selected=id(b);
      this.drag={pointer:e.pointerId,button:b,dx:e.clientX-rect.left-rect.width/2,dy:e.clientY-rect.top-rect.height/2};
      this.sync();
    });
    root.addEventListener('pointermove',e=>{
      const d=this.drag;if(!d||d.pointer!==e.pointerId||!this.draft)return;
      const rect=root.getBoundingClientRect(),layout=this.draft[this.orientation]??={};
      layout[id(d.button)]={x:clamp((e.clientX-d.dx-rect.left)/rect.width,0,1),y:clamp((e.clientY-d.dy-rect.top)/rect.height,0,1),scale:layout[id(d.button)]?.scale??1};
      this.apply();
    });
    const release=(e:PointerEvent)=>{if(this.drag?.pointer===e.pointerId)this.drag=undefined;};
    root.addEventListener('pointerup',release);root.addEventListener('pointercancel',release);root.addEventListener('lostpointercapture',release);
    root.addEventListener('change',e=>{
      if(e.target instanceof HTMLSelectElement&&this.toolbar?.contains(e.target)){this.selected=e.target.value;this.sync();}
    });
    root.addEventListener('input',e=>{
      if(!this.draft||!(e.target instanceof HTMLInputElement)||!this.toolbar?.contains(e.target))return;
      const button=this.buttons.find(b=>id(b)===this.selected);if(!button)return;
      const rect=button.getBoundingClientRect(),bounds=root.getBoundingClientRect(),layout=this.draft[this.orientation]??={};
      const placement=layout[this.selected]??{x:(rect.left+rect.width/2-bounds.left)/bounds.width,y:(rect.top+rect.height/2-bounds.top)/bounds.height,scale:1};
      layout[this.selected]={...placement,scale:e.target.valueAsNumber/100};this.apply();
    });
    root.addEventListener('click',e=>{
      if(!this.draft)return;
      const action=(e.target as Element).closest<HTMLElement>('[data-layout]')?.dataset.layout;
      if(action==='move')this.toolbar?.classList.toggle('lower');
      if(action==='reset'){delete this.draft[this.orientation];this.apply();}
      if(action==='save'){this.saved=this.draft;saveLocal(key,this.saved);this.close();}
    });
  }

  bind(editing:boolean){
    this.drag=undefined;
    this.draft=editing?structuredClone(this.saved):undefined;
    const select=this.toolbar?.querySelector('select');
    if(select)for(const b of this.buttons)select.add(new Option(b.getAttribute('aria-label')??id(b),id(b)));
    if(select&&!this.buttons.some(b=>id(b)===this.selected))this.selected='gas';
    this.apply();
  }
  private sync(){
    const panel=this.toolbar;if(!panel)return;
    panel.querySelector('select')!.value=this.selected;
    const percent=Math.round((this.draft?.[this.orientation]?.[this.selected]?.scale??1)*100);
    panel.querySelector('input')!.value=String(percent);panel.querySelector('output')!.value=percent+'%';
    for(const b of this.buttons)b.classList.toggle('layout-selected',id(b)===this.selected);
  }
  private apply(){
    if(!this.root.querySelector('.touch-layout'))return;
    const layout=(this.draft??this.saved)[this.orientation]??{};
    const bounds=this.root.getBoundingClientRect();
    for(const b of this.buttons){
      b.style.removeProperty('transform');
      const value=layout[id(b)];
      if(!value||![value.x,value.y,value.scale].every(Number.isFinite))continue;
      const r=b.getBoundingClientRect(),scale=clamp(value.scale,.75,1.75);
      const halfW=r.width*scale/2,halfH=r.height*scale/2;
      const cx=clamp(value.x*bounds.width,halfW+5,bounds.width-halfW-5);
      const cy=clamp(value.y*bounds.height,halfH+5,bounds.height-halfH-5);
      b.style.transform='translate('+(cx+bounds.left-r.left-r.width/2)+'px,'+(cy+bounds.top-r.top-r.height/2)+'px) scale('+scale+')';
    }
    this.sync();
  }
}
