import { test,expect } from '@playwright/test';

test.use({isMobile:true,hasTouch:true,viewport:{width:844,height:390},deviceScaleFactor:2});

test('two thumbs steer, accelerate and brake, with manual shifting and cancellation',async({page,context},info)=>{
  const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('button',{name:'Start driving'})).toBeVisible({timeout:60000});
  await page.getByRole('button',{name:'Settings',exact:true}).tap();
  await expect(page.getByLabel('Graphics preset')).toHaveValue('Low');
  await page.getByLabel('Performance diagnostics').check();
  await page.getByRole('button',{name:'Driving',exact:true}).tap();
  await page.getByLabel('Transmission',{exact:true}).selectOption('Manual');
  await page.getByLabel('Automatic clutch').uncheck();
  await page.getByRole('button',{name:'Back',exact:true}).tap();
  await page.getByRole('button',{name:'Start driving',exact:true}).tap();
  await expect(page.getByRole('button',{name:'Accelerate',exact:true})).toBeInViewport({timeout:60000});

  const client=await context.newCDPSession(page);
  const contact=async(label:string,id:number)=>{
    const box=await page.getByRole('button',{name:label,exact:true}).boundingBox();
    if(!box)throw new Error(label+' touch surface is missing');
    return {x:box.x+box.width/2,y:box.y+box.height/2,radiusX:4,radiusY:4,id};
  };
  const gas=await contact('Accelerate',1),right=await contact('Steer right',2);
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[gas]});
  await expect.poll(async()=>Number(await page.locator('#speed').innerText()),{timeout:30000}).toBeGreaterThan(12);
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[gas,right]});
  await expect(page.locator('[data-hold="right"]')).toHaveClass(/pressed/);
  await expect(page.locator('[data-hold="gas"]')).toHaveClass(/pressed/);
  await expect(page.locator('#diagnostics')).toContainText(/STEER\s+[1-9]/);
  await client.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  await expect(page.locator('.touch-deck .pressed')).toHaveCount(0);

  const brake=await contact('Brake and reverse',3);
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[brake]});
  await expect.poll(async()=>Number(await page.locator('#speed').innerText())).toBeLessThan(4);
  await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  const clutch=await contact('Hold clutch',4),shift=await contact('Upshift',5);
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[clutch]});
  await page.waitForTimeout(100);
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[clutch,shift]});
  await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[clutch]});
  await expect(page.locator('#gear')).toHaveText('2');
  await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.getByRole('button',{name:'Change camera',exact:true}).tap();
  await expect(page.locator('#pass-notice')).toHaveText('Close chase');
  await page.screenshot({path:info.outputPath('touch-landscape.png')});
  await page.setViewportSize({width:390,height:844});
  await expect(page.getByRole('button',{name:'Accelerate'})).toBeInViewport();
  await expect(page.getByRole('button',{name:'Steer left'})).toBeInViewport();
  await page.getByRole('button',{name:'Reset vehicle',exact:true}).tap();
  await expect(page.locator('#pass-notice')).toHaveText('Vehicle reset');
  await page.getByRole('button',{name:'Pause',exact:true}).tap();
  await page.getByRole('button',{name:'Return to main menu'}).tap();
  await page.screenshot({path:info.outputPath('phone-home.png')});
  await page.getByRole('button',{name:'Garage',exact:true}).tap();
  await page.getByRole('button',{name:'Cockpit',exact:true}).tap();
  await expect(page.getByRole('button',{name:'Drive this car'})).toBeInViewport();
  expect(errors).toEqual([]);
});
