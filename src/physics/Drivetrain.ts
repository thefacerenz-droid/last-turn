import { clamp, damp } from '../core/math';
import type { VehicleSpec } from '../vehicles';
import type { Controls } from '../input/InputManager';

const toRPM=60/(2*Math.PI);
export class TransmissionSimulation {
  gear=1;
  delay=0;
  private cooldown=0;
  private reverseHold=0;
  shiftSerial=0;
  constructor(private spec:VehicleSpec){}
  get ratio(){return this.gear===-1?-3.24:this.gear===0?0:this.spec.gears[this.gear-1];}
  select(gear:number,speed:number,manualClutch=true) {
    const target=clamp(gear,-1,this.spec.gears.length);
    if(!manualClutch||this.delay>0||target===this.gear||(target===-1 && speed>2.5)||(target>0 && speed< -3))return;
    if(target>0 && Math.abs(speed)/this.spec.wheelRadius*toRPM*this.spec.gears[target-1]*this.spec.finalDrive>this.spec.redline*1.1)return;
    this.gear=target;this.delay=this.spec.gears.length>=7?.145:.24;
    this.cooldown=.62;this.shiftSerial++;
  }
  update(dt:number,input:Controls,auto:boolean,speed:number,rpm:number) {
    this.delay=Math.max(0,this.delay-dt);this.cooldown=Math.max(0,this.cooldown-dt);
    if(!auto)return;
    if(Math.abs(speed)<.65 && ((this.gear>=0&&input.brake>.6&&!input.throttle)||(this.gear<0&&input.throttle>.35))){
      this.reverseHold+=dt;
      if(this.reverseHold>.38){this.select(this.gear<0?1:-1,speed);this.reverseHold=0;}
    }else this.reverseHold=0;
    if(this.gear===0&&input.throttle>.15)this.select(1,speed);
    if(this.cooldown||this.gear<1)return;
    const upRPM=this.spec.redline*(.59+.35*input.throttle);
    if(rpm>upRPM && speed>4) this.select(this.gear+1,speed);
    else if(this.gear>1){
      const lowerRPM=rpm*this.spec.gears[this.gear-2]/this.ratio;
      if(rpm<this.spec.redline*.31 || (input.throttle>.87 && rpm<this.spec.redline*.49 && lowerRPM<this.spec.redline*.86))this.select(this.gear-1,speed);
    }
  }
}

export class EngineSimulation {
  rpm:number; omega:number; throttle=0; boost=0; clutch=0; outputTorque=0;
  readonly transmission:TransmissionSimulation;
  constructor(private spec:VehicleSpec){
    this.rpm=spec.idle;this.omega=spec.idle/toRPM;
    this.transmission=new TransmissionSimulation(spec);
  }
  torqueAt(rpm:number){
    const x=clamp(rpm/this.spec.redline,0,1.1);
    const knots=[[0,.37],[.16,.59],[.32,this.spec.turbo?.9:.76],[.53,1],[.7,.98],[.88,.9],[1,.75],[1.08,0]];
    let torque=0;
    for(let i=1;i<knots.length;i++)if(x<=knots[i][0]){
      const a=knots[i-1],b=knots[i];torque=this.spec.torque*(a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]));break;
    }
    return Math.min(torque,this.spec.hp*745.7/Math.max(1,rpm/toRPM));
  }
  update(dt:number,input:Controls,wheelOmega:number,speed:number,auto:boolean,autoClutch:boolean,tcs:number) {
    const box=this.transmission;
    box.update(dt,input,auto,speed,this.rpm);
    const reversePedals=auto&&box.gear<0;
    const pedal=reversePedals?input.brake:input.throttle;
    this.throttle=damp(this.throttle,pedal*tcs,pedal>this.throttle?8:15,dt);
    this.boost=damp(this.boost,this.throttle*clamp((this.rpm-1300)/2000,0,1),this.throttle>.2?2.7:8,dt);
    const ratio=box.ratio*this.spec.finalDrive;
    const coupled=wheelOmega*ratio;
    const launchSpeed=(this.spec.idle+this.throttle*1400)/toRPM;
    const launch=clamp((this.omega-launchSpeed*.78)/(launchSpeed*.27),.06,1);
    const clutchTarget=box.delay>0||!ratio?0:(auto||autoClutch?Math.max(launch,clamp(Math.abs(speed)/8,0,1)):1-input.clutch);
    this.clutch=clutchTarget===0?0:damp(this.clutch,clutchTarget,14,dt);
    const inertia=.21+this.spec.cylinders*.023;
    const capacity=this.spec.torque*1.42*this.clutch;
    // The clutch impulse cannot close more than the current shaft-speed difference in one step.
    const clutchTorque=clamp((this.omega-coupled)*Math.min(6.2,inertia/dt*.45),-capacity,capacity);
    const idleForce=clamp((this.spec.idle/toRPM-this.omega)*8,0,this.spec.torque*.53);
    const firing=this.rpm>=this.spec.redline?0:this.torqueAt(this.rpm)*this.throttle*(this.spec.turbo?.76+.24*this.boost:1);
    const friction=12+this.omega*.039+(1-this.throttle)*this.omega*.041;
    this.omega=clamp(this.omega+(firing+idleForce-clutchTorque-friction)*dt/inertia,this.spec.idle*.68/toRPM,this.spec.redline*1.025/toRPM);
    this.rpm=this.omega*toRPM;
    this.outputTorque=clutchTorque*ratio*.91;
    return {torque:this.outputTorque,brake:reversePedals?input.throttle:input.brake};
  }
}
