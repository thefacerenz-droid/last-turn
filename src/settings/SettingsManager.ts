import { clamp } from '../core/math';
import { ROUTES, type RouteId } from '../world/roads';

export const lightNames = { golden: 'Golden hour', afternoon: 'Afternoon', evening: 'Warm evening', night: 'Night drive', overcast: 'Overcast' } as const;
export type Lighting = keyof typeof lightNames;
export const densityCounts = { Low: 14, Medium: 26, High: 42, 'Very high': 60 };
export type Density = keyof typeof densityCounts | 'Custom';
export type Preset = 'Low' | 'Medium' | 'High' | 'Ultra';
export interface Graphics {
  scale: number; texture: number; shadows: number; shadowDistance: number; reflections: number;
  ao: boolean; aa: boolean; vegetation: number; trafficDistance: number; worldDistance: number;
  post: boolean; bloom: boolean; blur: boolean; atmosphere: boolean; anisotropy: number; fpsLimit: number;
}
const levels = (scale:number, texture:number, shadows:number, shadowDistance:number, reflections:number, vegetation:number, trafficDistance:number, worldDistance:number, anisotropy:number): Graphics =>
  ({ scale, texture, shadows, shadowDistance, reflections, ao: shadows >= 1024, aa: true, vegetation, trafficDistance, worldDistance,
    post: shadows >= 1024, bloom: shadows >= 1024, blur: false, atmosphere: shadows >= 2048, anisotropy, fpsLimit: 0 });
export const presets: Record<Preset, Graphics> = {
  Low: levels(.65,256,0,40,0,.32,220,520,1),
  Medium: levels(.82,512,1024,60,1,.62,400,820,4),
  High: levels(1,1024,2048,95,2,.85,600,1150,8),
  Ultra: levels(1.15,2048,4096,150,3,1,850,1550,16),
};
export interface Tune { paint?:string; metallic:number; wheelStyle:number; wheelColor:string; ride:number; spring:number }
export interface Settings {
  route:RouteId; lighting:Lighting; density:Density; customCount:number; car:string;
  preset:Preset|'Custom'; graphics:Graphics; unit:'MPH'|'KM/H'; mode:'Automatic'|'Manual';
  sensitivity:number; deadzone:number; autoClutch:boolean; traction:boolean; steeringAssist:boolean;
  fov:number; chaseDistance:number; chaseHeight:number; minimap:boolean; diagnostics:boolean; showFps:boolean;
  master:number; engine:number; road:number; effects:number; muted:boolean; tunes:Record<string,Tune>;
}
const base:Settings = {
  route:'pacific', lighting:'golden', density:'Medium', customCount:32, car:'',
  preset:'High',graphics:presets.High,unit:'MPH',mode:'Automatic',sensitivity:1,deadzone:.1,
  autoClutch:true,traction:true,steeringAssist:true,fov:62,chaseDistance:6.9,chaseHeight:2.55,minimap:true,
  diagnostics:false,showFps:false,master:.75,engine:.8,road:.42,effects:.65,muted:false,tunes:{},
};
const storageKey='coastline.settings.1';
export function saveLocal(key:string,value:unknown) { try { localStorage.setItem(key,JSON.stringify(value)); } catch { /* Settings work in memory when storage is full. */ } }
export function readLocal<T>(key:string,fallback:T):T { try { const raw=localStorage.getItem(key); return raw?JSON.parse(raw):fallback; } catch { return fallback; } }
function restore<T extends object>(defaults:T,source:unknown):T {
  const result={...defaults};
  if(!source || typeof source!=='object') return result;
  for(const k of Object.keys(defaults) as (keyof T)[]) {
    const value=(source as T)[k];
    if(typeof value===typeof defaults[k] && value!==null && (typeof value!=='number'||Number.isFinite(value))) result[k]=value;
  }
  return result;
}
const defaultTune:Tune={metallic:.78,wheelStyle:0,wheelColor:'#686b6a',ride:0,spring:1};
export class SettingsManager {
  data:Settings;
  constructor() {
    const saved=readLocal<Partial<Settings>|null>(storageKey,null);
    this.data=restore(base,saved);
    this.data.graphics=restore(presets.High,saved?.graphics);
    if(!ROUTES.some(r=>r.id===this.data.route)) this.data.route='pacific';
    if(!(this.data.lighting in lightNames)) this.data.lighting='golden';
    if(!(this.data.density in densityCounts) && this.data.density!=='Custom') this.data.density='Medium';
    this.data.customCount=clamp(Math.round(this.data.customCount),6,72);
  }
  get count(){return this.data.density==='Custom'?this.data.customCount:densityCounts[this.data.density];}
  tune(id:string):Tune {
    const old=this.data.tunes[id];
    const tune=restore(defaultTune,old);
    if(old?.paint && /^#[0-9a-f]{6}$/i.test(old.paint)) tune.paint=old.paint;
    return this.data.tunes[id]=tune;
  }
  preset(which:Preset){this.data.preset=which;this.data.graphics={...presets[which]};this.save();}
  save(){saveLocal(storageKey,this.data);}
}
