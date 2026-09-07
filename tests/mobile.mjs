import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)('/Users/yanafidoeva/hr-platform/node_modules/playwright');
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Yandex.app/Contents/MacOS/Yandex'});
const errors=[];
try{
 for(const [width,height] of [[320,568],[390,844],[844,390],[1440,1000]]){
  const page=await browser.newPage({viewport:{width,height},hasTouch:true,isMobile:width<900});page.on('pageerror',e=>errors.push(e.message));
  await page.goto((process.env.BGD_URL||'http://127.0.0.1:4178/bgd/')+'?debug=1');await page.waitForFunction(()=>window.__bgd);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.locator('#start').click();
  await page.evaluate(()=>{const g=window.__bgd.game;Object.assign(g.settings,{staggerArrivals:false,firstEventAt:999,firstSadAt:999});g.start();Object.assign(g.player,{x:1020,y:520});Object.assign(g.person('nikita'),{x:1110,y:550,state:'drinking',sipStarted:0,sipUntil:99});Object.assign(g.person('david'),{x:1190,y:550,state:'drinking',sipStarted:0,sipUntil:99});Object.assign(g.person('tema'),{x:920,y:540,state:'dancing',danceStarted:-2,danceUntil:99});g.spawnEvent('comfort','samat');Object.assign(g.person('samat'),{x:1030,y:660});g.elapsed=2;g.bubble(g.person('nikita'),'Хороший вечер можно не торопить.',20);});
  await page.waitForTimeout(300);assert.deepEqual(errors,[]);await page.screenshot({path:`artifacts/v05-${width}.png`});
  assert.equal(await page.evaluate(()=>{const r=window.__bgd.renderer;return r.speechRects.some(a=>(r.textExclusions||[]).some(b=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y));}),false,'speech avoids HUD');
  const boxes=await page.evaluate(()=>{const ids=['.mood-card','.shift-clock','.task-strip','#interaction','#joystick','#touch-e','#toast'];return ids.map(id=>{const el=document.querySelector(id),r=el.getBoundingClientRect();return {id,x:r.x,y:r.y,w:r.width,h:r.height,visible:!!el.getClientRects().length};}).filter(r=>r.visible);});
  for(const r of boxes){assert.ok(r.x>=0&&r.y>=0&&r.x+r.w<=width+1&&r.y+r.h<=height+1,JSON.stringify(r));}
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];assert.ok(!(a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y),`overlap ${width}: ${a.id} ${b.id}`);}
  if(width<700){const joy=await page.locator('#joystick').boundingBox(),before=await page.evaluate(()=>window.__bgd.game.player.x);await page.mouse.move(joy.x+joy.width*.8,joy.y+joy.height/2);await page.mouse.down();await page.waitForTimeout(500);await page.mouse.up();assert.ok((await page.evaluate(()=>window.__bgd.game.player.x))>before,'touch movement');}
  await page.evaluate(()=>{const g=window.__bgd.game;g.say('Юзернейм','Тот же вайб, новый день. Музыка есть, компания есть. Всё на месте.');window.__bgd.updateUI();});
  await page.screenshot({path:`artifacts/v05-dialogue-${width}.png`});assert.ok(await page.locator('#dialogue-next').isVisible());await page.locator('#dialogue-next').click();assert.equal(await page.evaluate(()=>window.__bgd.game.dialogue),null);
  await page.close();console.log(`PASS viewport ${width}x${height}: UI bounds, no overlap, dialogue${width<700?', touch movement':''}`);
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
