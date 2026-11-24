import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PhysicsWorld } from '../src/physics/PhysicsWorld';
import { VehicleController } from '../src/physics/VehicleController';
import { SettingsManager } from '../src/settings/SettingsManager';
import { idleInput } from '../src/input/InputManager';
import { STEP,clamp,wrapAngle } from '../src/core/math';
import { laneOffset,roadAt } from '../src/world/roads';
import { playerVehicle } from '../src/vehicles/specs';
import { EngineSimulation } from '../src/physics/Drivetrain';

test('manual clutch, neutral, reverse and shift torque interruption',()=>{
  const engine=new EngineSimulation(playerVehicle),input={...idleInput,throttle:.9};
  const t=engine.transmission;
  t.select(2,0,false);assert.equal(t.gear,1);
  t.select(0,0,true);assert.equal(t.gear,0);
  for(let i=0;i<35;i++)engine.update(STEP,input,0,0,false,false,1);
  assert.ok(engine.rpm>playerVehicle.idle+1000);assert.equal(engine.outputTorque,0);
  t.select(-1,0);assert.equal(t.gear,-1);
  engine.update(STEP,input,0,0,false,false,1);assert.equal(Math.abs(engine.outputTorque),0);
  for(let i=0;i<32;i++)engine.update(STEP,input,0,0,false,false,1);
  assert.ok(engine.outputTorque<0);input.clutch=1;
  engine.update(STEP,input,0,0,false,false,1);assert.equal(Math.abs(engine.outputTorque),0);
});
test('highway cruise remains upright, road collider count stays bounded, wall collision produces a real impulse',async()=>{
  const physics=await PhysicsWorld.create('mesa');
  try{
    const settings=new SettingsManager(),v=new VehicleController(physics,playerVehicle,settings.tune('test'));
    const input={...idleInput};let crashes=0,maxSpeed=0,peakColliders=0;
    const step=()=>{
      physics.terrain(v.s);v.step(STEP,input,settings.data);
      physics.step((a,b,impulse)=>{if((a===v.collider.handle||b===v.collider.handle)&&impulse>250)crashes++;});
      v.capture();peakColliders=Math.max(peakColliders,physics.world.colliders.len());maxSpeed=Math.max(maxSpeed,v.speed);
    };
    const lane=1;
    for(let i=0;i<60*85;i++){
      const look=clamp((Math.abs(v.speed)*.56)+6,8,55),road=roadAt('mesa',v.s+look);
      const target=road.x+laneOffset('mesa',v.s+look,lane);
      const desired=Math.atan2(target-v.position.x,look),heading=Math.atan2(v.forward.x,-v.forward.z);
      const steer=clamp(wrapAngle(desired-heading)*v.spec.wheelbase*2/look*(1+Math.abs(v.speed)*.074)/.52,-1,1);
      input.steer=Math.sign(steer)*Math.pow(Math.abs(steer),1/1.32);input.throttle=i<70?0:1;
      step();
      assert.ok(Math.abs(v.rotation.x)<.55&&Math.abs(v.rotation.z)<.55,'chassis orientation at '+v.s.toFixed(0)+' m');
    }
    assert.ok(maxSpeed>50,'peak speed in m/s = '+maxSpeed);
    assert.ok(v.s>2200,'progress = '+v.s);assert.ok(peakColliders<520,'active colliders = '+peakColliders);
    const before=crashes;
    input.steer=1;
    for(let i=0;i<215;i++)step();
    assert.ok(crashes>before,'guardrail generates collision events');
  }finally{physics.dispose();}
});
