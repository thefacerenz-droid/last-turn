import { clamp } from '../core/math';
export type Action='pause'|'camera'|'up'|'down'|'reset'|'look'|'confirm'|'back'|'navLeft'|'navRight'|'navUp'|'navDown'|'diagnostics'|'lights'|'leftSignal'|'rightSignal';
export interface Controls {throttle:number;brake:number;steer:number;handbrake:boolean;clutch:number;lookX:number;lookY:number}
export const idleInput:Controls={throttle:0,brake:0,steer:0,handbrake:false,clutch:0,lookX:0,lookY:0};
const keys:Record<string,Action>={Escape:'pause',KeyC:'camera',KeyQ:'down',KeyE:'up',KeyR:'reset',KeyV:'look',F3:'diagnostics',KeyL:'lights',KeyZ:'leftSignal',KeyX:'rightSignal'};
const buttons:Record<number,Action>={0:'confirm',1:'back',3:'camera',4:'down',5:'up',8:'reset',9:'pause',10:'look',12:'navUp',13:'navDown',14:'navLeft',15:'navRight'};
export class InputManager {
  private held=new Set<string>();
  private padHeld=new Set<number>();
  private input:Controls={...idleInput};
  private drag=false;
  private dx=0;
  private dy=0;
  connected=false;
  constructor(private dispatch:(event:Action)=>void,private driving:()=>boolean,private orbit:(dx:number,dy:number)=>void) {
    window.addEventListener('keydown',e=>{
      const form=/INPUT|SELECT|TEXTAREA/.test((e.target as HTMLElement)?.tagName);
      if(keys[e.code] && (!form||e.code==='Escape') && !e.repeat){e.preventDefault();this.dispatch(keys[e.code]);}
      if(this.driving() && ['Space','ArrowDown','ArrowUp','ArrowLeft','ArrowRight','Tab'].includes(e.code)) e.preventDefault();
      if(this.driving())this.held.add(e.code);
    });
    window.addEventListener('keyup',e=>this.held.delete(e.code));
    window.addEventListener('blur',()=>this.clear());
    window.addEventListener('pointerdown',e=>{if(!(e.target as Element).closest('button,input,select,label,.drawer,.option-sheet') && e.button===0){this.drag=true;}});
    window.addEventListener('pointerup',()=>this.drag=false);
    window.addEventListener('pointermove',e=>{
      if(!this.drag) return;
      if(this.driving()){this.dx+=e.movementX;this.dy+=e.movementY;}else this.orbit(e.movementX,e.movementY);
    });
  }
  clear(){this.held.clear();this.dx=this.dy=0;this.drag=false;}
  read(deadzone:number):Controls {
    const pads=navigator.getGamepads?.();
    const pad=pads?Array.from(pads).find(p=>p?.connected && (p.mapping==='standard'||p.buttons.length>=12)):null;
    this.connected=!!pad;
    const down=(code:string,alias?:string)=>Number(this.held.has(code)||!!alias&&this.held.has(alias));
    const axis=(x=0)=>Math.abs(x)<=deadzone?0:Math.sign(x)*(Math.abs(x)-deadzone)/(1-deadzone);
    const press=(i:number)=>pad?.buttons[i]?.value??0;
    if(pad) for(const [id,action] of Object.entries(buttons)){
      const n=Number(id);if(press(n)>.5){if(!this.padHeld.has(n))this.dispatch(action);this.padHeld.add(n);}else this.padHeld.delete(n);
    }else this.padHeld.clear();
    this.input.throttle=Math.max(down('KeyW','ArrowUp'),press(7));
    this.input.brake=Math.max(down('KeyS','ArrowDown'),press(6));
    this.input.steer=clamp(down('KeyD','ArrowRight')-down('KeyA','ArrowLeft')+axis(pad?.axes[0]),-1,1);
    this.input.handbrake=!!down('Space')||press(2)>.5;
    this.input.clutch=Math.max(down('ShiftLeft','ShiftRight'),press(0));
    this.input.lookX=axis(pad?.axes[2]) + this.dx*.028;
    this.input.lookY=axis(pad?.axes[3]) + this.dy*.028;
    this.dx=this.dy=0;
    return this.input;
  }
}
