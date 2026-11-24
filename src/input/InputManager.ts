import { clamp } from '../core/math';
import { TouchControls } from './TouchControls';
export type Action='pause'|'camera'|'up'|'down'|'reset'|'look'|'confirm'|'back'|'navLeft'|'navRight'|'navUp'|'navDown'|'diagnostics'|'lights'|'leftSignal'|'rightSignal';
export interface Controls {throttle:number;brake:number;steer:number;handbrake:boolean;clutch:number;lookX:number;lookY:number}
export const idleInput:Controls={throttle:0,brake:0,steer:0,handbrake:false,clutch:0,lookX:0,lookY:0};
const keys:Record<string,Action>={Escape:'pause',KeyC:'camera',KeyQ:'down',KeyE:'up',KeyR:'reset',KeyV:'look',F3:'diagnostics',KeyL:'lights',KeyZ:'leftSignal',KeyX:'rightSignal'};
const buttons:Record<number,Action>={0:'confirm',1:'back',3:'camera',4:'down',5:'up',8:'reset',9:'pause',10:'look',12:'navUp',13:'navDown',14:'navLeft',15:'navRight'};
export class InputManager {
  private held=new Set<string>();
  private padHeld=new Set<number>();
  private input:Controls={...idleInput};
  private dragPointer?:number;
  private dragX=0;
  private dragY=0;
  private touch:TouchControls;
  private dx=0;
  private dy=0;
  connected=false;
  constructor(root:HTMLElement,private dispatch:(event:Action)=>void,private driving:()=>boolean,private orbit:(dx:number,dy:number)=>void) {
    this.touch=new TouchControls(root,action=>{if(this.driving())this.dispatch(action);});
    window.addEventListener('keydown',e=>{
      const form=/INPUT|SELECT|TEXTAREA/.test((e.target as HTMLElement)?.tagName);
      if(keys[e.code] && (!form||e.code==='Escape') && !e.repeat){e.preventDefault();this.dispatch(keys[e.code]);}
      if(this.driving() && ['Space','ArrowDown','ArrowUp','ArrowLeft','ArrowRight','Tab'].includes(e.code)) e.preventDefault();
      if(this.driving())this.held.add(e.code);
    });
    window.addEventListener('keyup',e=>this.held.delete(e.code));
    window.addEventListener('blur',()=>this.clear());
    window.addEventListener('pointerdown',e=>{
      if(e.target instanceof HTMLCanvasElement && this.dragPointer===undefined && e.button===0){
        this.dragPointer=e.pointerId;this.dragX=e.clientX;this.dragY=e.clientY;e.target.setPointerCapture(e.pointerId);
      }
    });
    const endDrag=(e:PointerEvent)=>{if(this.dragPointer===e.pointerId)this.dragPointer=undefined;};
    window.addEventListener('pointerup',endDrag);
    window.addEventListener('pointercancel',endDrag);
    window.addEventListener('lostpointercapture',endDrag);
    window.addEventListener('pointermove',e=>{
      if(e.pointerId!==this.dragPointer) return;
      const dx=e.clientX-this.dragX,dy=e.clientY-this.dragY;this.dragX=e.clientX;this.dragY=e.clientY;
      if(this.driving()){this.dx+=dx;this.dy+=dy;}else this.orbit(dx,dy);
    });
  }
  clear(){this.held.clear();this.touch.clear();this.dx=this.dy=0;this.dragPointer=undefined;}
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
    this.input.throttle=Math.max(down('KeyW','ArrowUp'),press(7),this.touch.held('gas'));
    this.input.brake=Math.max(down('KeyS','ArrowDown'),press(6),this.touch.held('brake'));
    this.input.steer=clamp(down('KeyD','ArrowRight')-down('KeyA','ArrowLeft')+axis(pad?.axes[0])+this.touch.held('right')-this.touch.held('left'),-1,1);
    this.input.handbrake=!!down('Space')||press(2)>.5||!!this.touch.held('handbrake');
    this.input.clutch=Math.max(down('ShiftLeft','ShiftRight'),press(0),this.touch.held('clutch'));
    this.input.lookX=axis(pad?.axes[2]) + this.dx*.028;
    this.input.lookY=axis(pad?.axes[3]) + this.dy*.028;
    this.dx=this.dy=0;
    return this.input;
  }
}
