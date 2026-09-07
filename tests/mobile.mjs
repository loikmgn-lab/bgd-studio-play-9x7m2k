import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)('/Users/yanafidoeva/hr-platform/node_modules/playwright');
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Yandex.app/Contents/MacOS/Yandex'});
const errors=[],base=process.env.BGD_URL||'http://127.0.0.1:4178/bgd/';
function overlap(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}
try{
 for(const [width,height] of [[568,320],[844,390],[1440,1000]]){
  const phone=width<1000;
  const page=await browser.newPage({viewport:{width:phone?height:width,height:phone?width:height},hasTouch:phone,isMobile:phone});
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
  await page.goto(base+'?debug=1',{waitUntil:'domcontentloaded',timeout:60000});await page.waitForFunction(()=>window.__bgd,{timeout:60000});
  if(phone){
   assert.ok(await page.locator('#rotate-screen').isVisible());assert.equal(await page.evaluate(()=>window.__bgd.game.mode),'start');
   await page.screenshot({path:`artifacts/v06-portrait-${height}.png`});
   await page.setViewportSize({width,height});await page.waitForFunction(()=>document.getElementById('rotate-screen').hidden);
  }
  await page.locator('#start').click();
  await page.evaluate(()=>{const g=window.__bgd.game;Object.assign(g.settings,{staggerArrivals:false,firstEventAt:999,firstSadAt:999});g.start();Object.assign(g.player,{x:980,y:650});g.elapsed=55;
   const spots=[[450,430],[700,470],[375,425],[900,550],[1070,520],[580,440],[800,450],[1160,520],[470,380],[1000,760]];
   g.npcs.forEach((n,i)=>{Object.assign(n,{x:spots[i][0],y:spots[i][1],state:'idle',path:[],moving:false,instrument:null,wanderAt:999,instrumentAt:999,drinkAt:999,danceAt:999});});
   for(const n of g.npcs)g.bubble(n,'Хорошо здесь.');
  });
  await page.waitForTimeout(200);assert.deepEqual(errors,[]);
  await page.screenshot({path:`artifacts/v06-${width}.png`});
  const boxes=await page.evaluate(()=>['.mood-card','.shift-clock','.task-strip','#joystick','#touch-e'].map(id=>{const el=document.querySelector(id),r=el.getBoundingClientRect();return {id,x:r.x,y:r.y,w:r.width,h:r.height,visible:!!el.getClientRects().length};}).filter(r=>r.visible));
  for(const r of boxes)assert.ok(r.x>=0&&r.y>=0&&r.x+r.w<=width+1&&r.y+r.h<=height+1,JSON.stringify(r));
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)assert.ok(!overlap(boxes[i],boxes[j]),`overlap ${width}: ${boxes[i].id} ${boxes[j].id}`);
  assert.equal(await page.locator('#toast').isVisible(),false);
  assert.ok(await page.evaluate(()=>window.__bgd.renderer.speechRects.length<=1));
  assert.equal(await page.evaluate(()=>{const r=window.__bgd.renderer;return r.speechRects.some(a=>(r.textExclusions||[]).some(b=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y));}),false);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  if(phone){
   const joy=await page.locator('#joystick').boundingBox(),before=await page.evaluate(()=>window.__bgd.game.player.x);
   await page.mouse.move(joy.x+joy.width*.8,joy.y+joy.height/2);await page.mouse.down();await page.waitForTimeout(450);await page.mouse.up();assert.ok((await page.evaluate(()=>window.__bgd.game.player.x))>before,'touch movement');
   await page.setViewportSize({width:height,height:width});await page.waitForFunction(()=>window.__bgd.game.orientationBlocked);
   const frozen=await page.evaluate(()=>window.__bgd.game.elapsed);await page.waitForTimeout(450);assert.equal(await page.evaluate(()=>window.__bgd.game.elapsed),frozen);
   await page.setViewportSize({width,height});await page.waitForFunction(()=>!window.__bgd.game.orientationBlocked);await page.waitForTimeout(150);assert.ok((await page.evaluate(()=>window.__bgd.game.elapsed))>frozen);
  }
  await page.evaluate(()=>{window.__bgd.game.say('Юзернейм','Тот же вайб, новый день. Музыка есть, компания есть. Всё на месте.');window.__bgd.updateUI();});
  await page.screenshot({path:`artifacts/v06-dialogue-${width}.png`});
  assert.equal(await page.locator('.task-strip').isVisible(),false);assert.ok(await page.locator('#dialogue-next').isVisible());
  if(phone){await page.setViewportSize({width:height,height:width});await page.waitForFunction(()=>window.__bgd.game.orientationBlocked);await page.setViewportSize({width,height});await page.waitForFunction(()=>!window.__bgd.game.orientationBlocked);assert.ok(await page.locator('#dialogue').isVisible());}
  await page.locator('#dialogue-next').click();assert.equal(await page.evaluate(()=>window.__bgd.game.dialogue),null);
  // Compact status result and long objective must fit in the shared strip.
  await page.evaluate(()=>{const g=window.__bgd.game;g.notice('Контакт исправен. Проверь дальше.');Object.assign(g.player,{x:g.npc.x+15,y:g.npc.y});window.__bgd.updateUI();});
  const fits=await page.locator('.task-strip').evaluate(el=>el.scrollWidth<=el.clientWidth+1);assert.ok(fits,'status strip wraps');
  await page.close();console.log(`PASS ${width}x${height}: compact HUD, one bubble, dialogues${phone?', landscape gate, rotation freeze/resume, touch':''}`);
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
