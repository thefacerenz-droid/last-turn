import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PhysicsWorld } from '../src/physics/PhysicsWorld';
import { VehicleController } from '../src/physics/VehicleController';
import { SettingsManager } from '../src/settings/SettingsManager';
import { TrafficManager } from '../src/traffic/TrafficManager';
import { ScoringManager } from '../src/scoring/ScoringManager';
import { getVehicle,vehicles } from '../src/vehicles';
import { roadAt,laneOffset,roadHeight } from '../src/world/roads';
import { STEP } from '../src/core/math';
import { idleInput } from '../src/input/InputManager';

test('traffic brakes for a stationary player and both bodies receive collision impulses',async()=>{
  const world=await PhysicsWorld.create('pacific');
  try{
    const opts=new SettingsManager(),car=new VehicleController(world,getVehicle('kessel-r4'),opts.tune('kessel-r4'));
    const traffic=new TrafficManager(world,null,car,1),other=traffic.cars[0];
    const where=-28,r=roadAt('pacific',where);
    other.s=where;other.x=r.x+laneOffset('pacific',where,1);other.y=roadHeight('pacific',where,other.x);other.speed=15;
    other.lane=other.target=other.laneFloat=1;other.cooldown=10;other.think=0;other.cruise=30;
    other.position.set(other.x,other.y,-where);
    let worst=0;
    for(let i=0;i<180;i++){car.step(STEP,idleInput,opts.data);traffic.step(STEP);world.step(()=>{});car.capture();traffic.capture();worst=Math.min(worst,other.acceleration);}
    assert.ok(worst< -4,'slows when entering the player lane');assert.ok(other.speed<8,'following speed '+other.speed);
    assert.ok(other.s<car.s-2.7,'AI kept a gap');
    // Kick the actual traffic body into the stationary car and observe the contact callback.
    const p=car.position,d=car.forward;
    other.body!.setTranslation({x:p.x-d.x*6,y:p.y+.12,z:p.z-d.z*6},true);
    other.body!.setLinvel({x:d.x*24,y:0,z:d.z*24},true);other.hit=2;
    let impulse=0;
    for(let i=0;i<36;i++){car.step(STEP,idleInput,opts.data);traffic.step(STEP);
      world.step((a,b,j)=>{if(a===car.collider.handle||b===car.collider.handle){impulse=Math.max(impulse,j);traffic.incident(a,j);traffic.incident(b,j);}});
      car.capture();traffic.capture();}
    assert.ok(impulse>1000,'contact impulse in N·s '+impulse);assert.ok(car.body.linvel().z< -2);
    traffic.dispose();
  }finally{world.dispose();}
});
test('density changes simulated population, high-density fleet stays finite and far cars use no rigid body',async()=>{
  const physics=await PhysicsWorld.create('marina');
  try{
    const opts=new SettingsManager(),car=new VehicleController(physics,vehicles[0],opts.tune('aurelia-cx'));
    const traffic=new TrafficManager(physics,null,car,14);traffic.setCount(60);assert.equal(traffic.cars.length,60);
    const start=performance.now();let peak=0;
    for(let i=0;i<60*24;i++){car.step(STEP,idleInput,opts.data);traffic.step(STEP);physics.step((a,b,j)=>{traffic.incident(a,j);traffic.incident(b,j);});car.capture();traffic.capture();
      peak=Math.max(peak,traffic.cars.filter(c=>c.body).length);}
    console.log('High-density simulation '+((performance.now()-start)/(60*24)).toFixed(2)+' ms/step; '+peak+' nearby traffic bodies at peak.');
    assert.ok(peak<38);assert.ok(traffic.cars.every(c=>Number.isFinite(c.s)&&Number.isFinite(c.speed)));
    traffic.setCount(8);assert.equal(traffic.cars.length,8);traffic.dispose();
  }finally{physics.dispose();}
});
test('score requires a completed pass, rewards a streak and breaks it on impact',()=>{
  const score=new ScoringManager(),spec=vehicles[0];const vp={spec,s:0,position:{x:0},speed:36,wheels:[]} as unknown as VehicleController;
  const other={id:1,s:15,x:spec.width+.7,speed:19,length:4.5,spec} as TrafficManager['cars'][number];
  for(let i=0;i<125;i++)score.step(STEP,vp,[other]);
  for(let i=0;i<85;i++){vp.position.z=0;other.s-=.35;score.step(STEP,vp,[other]);}
  assert.equal(score.passes,1);const first=score.score;other.id=2;other.s=11;
  for(let i=0;i<62;i++){other.s-=.35;score.step(STEP,vp,[other]);}
  assert.equal(score.passes,2);assert.ok(score.combo>1&&score.score>first*2);score.impact();assert.equal(score.combo,1);
});
