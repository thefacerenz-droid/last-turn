import { clamp } from '../core/math';
import type { VehicleController } from '../physics/VehicleController';
import type { Settings } from '../settings/SettingsManager';

import { RecordedEngine } from './RecordedEngine';

export class AudioManager {
  private recorded?: RecordedEngine;
  private ctx?:AudioContext;private master?:GainNode;private engine?:GainNode;private road?:GainNode;private fx?:GainNode;
  private harmonics:OscillatorNode[]=[];private voices:GainNode[]=[];private exhaust?:BiquadFilterNode;
  private turbo?:OscillatorNode;private turboVolume?:GainNode;private tire?:GainNode;private wind?:GainNode;
  private pass?:GainNode;private passTone?:BiquadFilterNode;private noise?:AudioBuffer;
  private lastGear=0;private lastThrottle=0;private oldDistance=200;
  async unlock() {
    if(this.ctx){if(this.ctx.state==='suspended')await this.ctx.resume();return;}
    const ctx=this.ctx=new AudioContext();
    const gain=(v:number,to:AudioNode)=>{const g=ctx.createGain();g.gain.value=v;g.connect(to);return g;};
    const limiter=ctx.createDynamicsCompressor();limiter.threshold.value=-8;limiter.ratio.value=7;limiter.connect(ctx.destination);
    this.master=gain(0,limiter);this.engine=gain(.7,this.master);this.road=gain(.4,this.master);this.fx=gain(.6,this.master);
    this.recorded=new RecordedEngine(ctx,this.engine);
    this.noise=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate);
    const samples=this.noise.getChannelData(0);let prev=0;
    for(let i=0;i<samples.length;i++){prev=.17*prev+.83*(Math.random()*2-1);samples[i]=prev;}
    this.exhaust=ctx.createBiquadFilter();this.exhaust.type='lowpass';this.exhaust.frequency.value=780;this.exhaust.Q.value=.6;this.exhaust.connect(this.engine);
    const wave=ctx.createPeriodicWave(new Float32Array(12),new Float32Array([0,1,.36,.56,.12,.22,.11,.08,.08,.05,.025,.018]),{disableNormalization:false});
    for(let i=0;i<3;i++){
      const osc=ctx.createOscillator();osc.setPeriodicWave(wave);const g=gain(0,this.exhaust);osc.connect(g);osc.start();this.harmonics.push(osc);this.voices.push(g);
    }
    this.turbo=ctx.createOscillator();this.turbo.type='sine';this.turboVolume=gain(0,this.engine);this.turbo.connect(this.turboVolume);this.turbo.start();
    const bed=(kind:BiquadFilterType,hz:number,dest:AudioNode)=>{
      const source=ctx.createBufferSource();source.buffer=this.noise!;source.loop=true;const filter=ctx.createBiquadFilter();filter.type=kind;filter.frequency.value=hz;
      const level=gain(0,dest);source.connect(filter).connect(level);source.start(0,Math.random());return {level,filter};
    };
    this.tire=bed('bandpass',1850,this.fx).level;this.wind=bed('lowpass',840,this.road).level;
    const passing=bed('bandpass',340,this.road);this.pass=passing.level;this.passTone=passing.filter;
    await ctx.resume();
  }
  private set(param:AudioParam|undefined,value:number,rate=.046){if(param&&this.ctx)param.setTargetAtTime(value,this.ctx.currentTime,rate);}
  private burst(strength:number,hz:number,seconds:number,destination:GainNode,type:BiquadFilterType='lowpass'){
    if(!this.ctx||!this.noise)return;const ctx=this.ctx,source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),g=ctx.createGain();
    source.buffer=this.noise;filter.type=type;filter.frequency.value=hz;g.gain.setValueAtTime(strength,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+seconds);
    source.connect(filter).connect(g).connect(destination);source.start(0,.1);source.stop(ctx.currentTime+seconds+.02);
    source.onended=()=>{source.disconnect();filter.disconnect();g.disconnect();};
  }
  impact(deltaV:number){if(this.fx)this.burst(clamp(deltaV*.24,.18,1.8),500+Math.min(3000,deltaV*130),.16+Math.min(.32,deltaV*.02),this.fx);}
  mute(){this.set(this.master?.gain,0,.025);}
  update(car:VehicleController,s:Settings,distance:number,cockpit=false){
    if(!this.ctx)return;
    const en=car.engine,rpm=en.rpm,throttle=en.throttle,v=Math.abs(car.speed),firing=rpm*car.spec.cylinders/120;
    this.set(this.master?.gain,s.muted?0:s.master*.75);this.set(this.engine?.gain,s.engine);this.set(this.road?.gain,s.road);this.set(this.fx?.gain,s.effects);
    const sampled=this.recorded?.update(car.spec.cylinders,rpm,throttle,en.transmission.delay>0,cockpit);
    const ratios=[1,.501,1.997],amps=[.18,.105,.05];
    this.harmonics.forEach((o,i)=>{this.set(o.frequency,Math.max(16,firing*ratios[i]),.022);this.set(this.voices[i].gain,amps[i]*(sampled ? .16 : 1)*(.43+.57*throttle),.022);});
    this.set(this.exhaust?.frequency,320+rpm*.16+throttle*1150);
    this.set(this.turbo?.frequency,980+en.boost*2450);this.set(this.turboVolume?.gain,car.spec.turbo?en.boost*.021:0);
    const slip=Math.max(...car.wheels.map(w=>Math.abs(w.lateralSlip)*1.4+Math.abs(w.slip)*.38));
    this.set(this.tire?.gain,clamp((slip-.12)*.70,0,.42)*Math.min(1,v/6));
    this.set(this.wind?.gain,.015+Math.min(.32,v*v*.00006));
    this.set(this.pass?.gain,.021+.29*Math.exp(-distance/11));this.set(this.passTone?.frequency,clamp(640+(this.oldDistance-distance)*145,230,1050));
    this.oldDistance=distance;
    if(this.lastGear!==en.transmission.shiftSerial&&this.fx)this.burst(.25,460,.09,this.fx);
    if(car.spec.turbo&&this.lastThrottle-throttle>.15&&en.boost>.4&&this.fx)this.burst(en.boost*.17,2350,.17,this.fx,'highpass');
    this.lastGear=en.transmission.shiftSerial;this.lastThrottle=throttle;
  }
}
