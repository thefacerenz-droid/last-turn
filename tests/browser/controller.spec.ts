import { expect,test } from '@playwright/test';

test('standard gamepad, all camera mounts, 1080p rendering and night lighting',async({page},info)=>{
  test.setTimeout(150000);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.setViewportSize({width:1920,height:1080});
  await page.addInitScript(()=>{
    const pad={id:'Test standard controller',mapping:'standard',connected:true,index:0,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,touched:false,value:0}))};
    Object.assign(window,{testPad:pad});Object.defineProperty(navigator,'getGamepads',{value:()=>[pad,null,null,null]});
  });
  const button=(index:number,value:number)=>page.evaluate(([i,v])=>{
    const p=(window as unknown as {testPad:{buttons:{pressed:boolean;value:number}[]}}).testPad;
    p.buttons[i].pressed=v>.5;p.buttons[i].value=v;
  },[index,value]);
  const tap=async(i:number)=>{await button(i,1);await page.waitForTimeout(130);await button(i,0);await page.waitForTimeout(95);};
  await page.goto('/');await expect(page.getByRole('button',{name:'Start driving',exact:true})).toBeVisible({timeout:60000});
  await page.getByRole('button',{name:'Session setup',exact:true}).click();
  await page.getByLabel('Traffic density').selectOption('Very high');await page.getByRole('button',{name:'Back',exact:true}).click();
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  await page.getByLabel('Performance diagnostics').check();
  await page.getByRole('button',{name:'Back',exact:true}).click();
  await page.getByRole('button',{name:'Start driving',exact:true}).click();
  await expect(page.locator('#gear')).toBeVisible({timeout:60000});await button(7,.95);
  await expect.poll(async()=>Number(await page.locator('#speed').innerText()),{timeout:45000}).toBeGreaterThan(38);
  await button(7,0);
  await page.screenshot({path:info.outputPath('pacific-high.png')});
  const hardware=await page.evaluate(()=>{
    const gl=document.querySelector<HTMLCanvasElement>('#scene')!.getContext('webgl2')!;
    const ext=gl.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'Unavailable';
  });
  const frameTimes=await page.evaluate(()=>new Promise<number[]>(resolve=>{
    const times:number[]=[];let start=performance.now();
    function sample(now:number){times.push(now-start);start=now;if(times.length>=100)resolve(times.slice(4).sort((a,b)=>a-b));else requestAnimationFrame(sample);}
    requestAnimationFrame(sample);
  }));
  console.log('1080p High, 60 active cars, '+hardware+'; median '+frameTimes[Math.floor(frameTimes.length*.5)].toFixed(2)+' ms, p95 '+frameTimes[Math.floor(frameTimes.length*.95)].toFixed(2)+' ms.');
  await expect(page.locator('#diagnostics')).toContainText('TRAFFIC 60');
  for(const mode of ['Close chase','Hood','Cockpit','Free look','Cinematic','Chase']){
    await tap(3);await expect(page.locator('#pass-notice')).toHaveText(mode);
    if(mode==='Cockpit'){await page.waitForTimeout(650);await page.screenshot({path:info.outputPath('cockpit.png')});}
  }
  await tap(9);await expect(page.getByRole('button',{name:'Resume drive',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Return to main menu'}).click();
  await page.getByRole('button',{name:'Session setup',exact:true}).click();
  await page.getByRole('combobox',{name:'Highway',exact:true}).selectOption('marina');await page.getByLabel('Lighting').selectOption('night');
  await page.getByRole('button',{name:'Start driving',exact:true}).click();
  await expect(page.locator('#gear')).toBeVisible();await expect(page.locator('#session-clock')).not.toHaveText('00:00');
  await page.screenshot({path:info.outputPath('night.png')});await page.keyboard.press('l');
  await expect(page.locator('#pass-notice')).toHaveText('Headlights off');
  expect(errors).toEqual([]);
});
