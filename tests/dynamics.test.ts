import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PhysicsWorld } from '../src/physics/PhysicsWorld';
import { VehicleController } from '../src/physics/VehicleController';
import { SettingsManager } from '../src/settings/SettingsManager';
import { idleInput } from '../src/input/InputManager';
import { STEP } from '../src/core/math';
import { roadAt } from '../src/world/roads';
import type { VehicleSpec } from '../src/vehicles';
import { follow, LaneIndex, drivers } from '../src/traffic/TrafficAI';
import { handlingTunes,type HandlingTune } from '../src/vehicles/handlingTunes';
import { getVehicle } from '../src/vehicles/catalogue';

const fixture={length:4.55,width:1.88,height:1.34,wheelbase:2.72,track:1.61,wheelRadius:.335,mass:1590,cgHeight:.47,
  frontWeight:.51,spring:43000,damping:3800,travel:.22,antiRoll:12500,wheelMass:19,grip:1.12,drivetrain:'AWD',
  hp:480,torque:540,topSpeed:285,zeroTo100:4.1,gears:[4.1,2.72,1.94,1.48,1.18,.96,.81],finalDrive:3.63,
  redline:7500,idle:880,turbo:true,cylinders:6} as VehicleSpec;

test('stock Kuroda keeps rolling grip during hard braking and steering',async()=>{
  for(const steering of [0,.34]){
    const physics=await PhysicsWorld.create('mesa');
    try{
      const settings=new SettingsManager(),car=new VehicleController(physics,getVehicle('kuroda-rs'),settings.tune('kuroda-rs'));
      const input={...idleInput};
      const step=()=>{physics.terrain(car.s);car.step(STEP,input,settings.data);physics.step(()=>{});car.capture();};
      for(let i=0;i<90;i++)step();
      car.body.setLinvel(car.forward.clone().multiplyScalar(100/3.6),true);
      car.engine.transmission.select(4,100/3.6);
      for(const wheel of car.wheels)wheel.omega=100/3.6/wheel.radius;
      const start=car.position.clone();
      input.brake=1;let locked=0,frames=0;
      for(let i=0;i<260;i++){
        input.steer=i<26?steering:0;step();
        if(car.speed>5){for(const w of car.wheels)if(w.planted){frames++;if(w.slip<-.75)locked++;}}
        if(car.speed<.5)break;
      }
      const distance=car.position.distanceTo(start);
      console.log('100 km/h stop',steering?'with steering':'straight',distance.toFixed(1)+' m, wheel lock '+(100*locked/frames).toFixed(1)+'%');
      assert.ok(distance<43 && car.speed<.5);
      assert.ok(locked/frames<.04,'sustained wheel lock');
    }finally{physics.dispose();}
  }
});

test('four loaded wheels accelerate, shift, corner and brake on the actual streamed road',async()=>{
  const physics=await PhysicsWorld.create('pacific');
  try{
    const settings=new SettingsManager();const v=new VehicleController(physics,fixture,settings.tune('fixture'));
    const pedal={...idleInput};let maxRoll=0,minRPM=Infinity,maxRPM=0,maxGear=1;
    const advance=(steps:number)=>{
      for(let i=0;i<steps;i++){
        physics.terrain(v.s);v.step(STEP,pedal,settings.data);physics.step(()=>{});v.capture();
        maxGear=Math.max(maxGear,v.engine.transmission.gear);minRPM=Math.min(minRPM,v.engine.rpm);maxRPM=Math.max(maxRPM,v.engine.rpm);
        maxRoll=Math.max(maxRoll,Math.abs(v.rotation.z));assert.ok(Number.isFinite(v.speed));
      }
    };
    advance(100);
    assert.equal(v.wheels.filter(w=>w.planted).length,4);
    assert.ok(v.wheels.every(w=>w.compression>.035 && w.compression<.18));
    pedal.throttle=1;advance(260);
    assert.ok(v.speed>16,'speed after 4.33 s = '+v.speed);
    assert.ok(maxGear>=2,'upshift reached '+maxGear);assert.ok(maxRPM-minRPM>2200);
    const fast=v.speed;
    pedal.steer=.48;advance(28);pedal.steer=0;
    assert.ok(maxRoll>.008,'chassis roll '+maxRoll);
    pedal.throttle=0;pedal.brake=1;advance(90);
    assert.ok(v.speed<fast-7,'braking deceleration '+fast+' to '+v.speed);
    assert.ok(v.position.y>roadAt('pacific',v.s).y-1);
  }finally{physics.dispose();}
});
test('IDM emergency braking and safe adjacent-lane evaluation',()=>{
  const me={id:1,s:0,speed:29,length:4.6,driver:drivers.normal,cruise:35};
  const slow={...me,id:2,s:20,speed:9};
  assert.ok(follow(me,slow)<-5);assert.ok(follow(me)>0);
  const lanes=new LaneIndex(3);lanes.add(1,slow);lanes.add(0,{...me,id:3,s:-5,speed:40});
  lanes.add(2,{...me,id:-1,s:2,speed:20});lanes.sort();
  assert.equal(lanes.choose(1,me,follow(me,slow)),1);
  lanes.lanes[2]=[];assert.equal(lanes.choose(1,me,follow(me,slow)),2);
});

test('garage presets change acceleration, braking and steering in the simulation',async()=>{
  const runs=new Map<HandlingTune,{speed:number;braking:number;lock:number}>();
  for(const handling of Object.keys(handlingTunes) as HandlingTune[]){
    const physics=await PhysicsWorld.create('pacific');
    try{
      const settings=new SettingsManager(),tune=settings.tune('fixture');
      tune.handling=handling;
      const car=new VehicleController(physics,fixture,tune),input={...idleInput};
      const advance=(steps:number)=>{
        for(let i=0;i<steps;i++){physics.terrain(car.s);car.step(STEP,input,settings.data);physics.step(()=>{});car.capture();}
      };
      advance(90);input.throttle=1;advance(210);const speed=car.speed;
      car.reset(0,1);input.throttle=0;advance(90);
      car.body.setLinvel(car.forward.clone().multiplyScalar(22),true);
      for(const wheel of car.wheels)wheel.omega=22/wheel.radius;
      input.brake=1;advance(24);const braking=22-car.speed;
      car.reset(0,1);input.brake=0;input.steer=1;advance(60);
      runs.set(handling,{speed,braking,lock:car.steer});
    }finally{physics.dispose();}
  }
  const stock=runs.get('Stock')!,grip=runs.get('Grip')!,speed=runs.get('Speed')!,mixed=runs.get('Grip + Speed')!;
  assert.ok(speed.speed>stock.speed && mixed.speed>stock.speed);
  assert.ok(grip.braking>stock.braking && mixed.braking>stock.braking);
  assert.ok(runs.get('Drift')!.lock>stock.lock*1.2);
});
