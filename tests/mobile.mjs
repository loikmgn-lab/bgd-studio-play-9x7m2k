import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)('/Users/yanafidoeva/hr-platform/node_modules/playwright');
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Yandex.app/Contents/MacOS/Yandex'});
const errors=[],base=process.env.BGD_URL||'http://127.0.0.1:4178/bgd/';
try{
 for(const [width,height] of [[568,320],[844,390],[1440,900]]){
  const phone=width<1000;
  const page=await browser.newPage({viewport:{width:phone?height:width,height:phone?width:height},hasTouch:phone,isMobile:phone,deviceScaleFactor:phone?2:1});
  // Deterministic viewport sizes also exercise browsers that reject fullscreen.
  await page.addInitScript(()=>{Element.prototype.requestFullscreen=function(){window.fullscreenRequested=true;return Promise.reject(new DOMException('Unavailable in this test','NotAllowedError'));};});
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
  await page.goto(base+'?debug=1',{waitUntil:'domcontentloaded',timeout:60000});await page.waitForFunction(()=>window.__bgd,{timeout:60000});
  if(phone){assert.ok(await page.locator('#rotate-screen').isVisible());await page.setViewportSize({width,height});await page.waitForFunction(()=>!window.__bgd.game.orientationBlocked);}
  await page.locator('#start').click();assert.ok(await page.evaluate(()=>window.fullscreenRequested));
  await page.evaluate(()=>{const g=window.__bgd.game;Object.assign(g.settings,{staggerArrivals:false,firstEventAt:999,firstSadAt:999});g.start();Object.assign(g.player,{x:1000,y:550});g.elapsed=60;
   g.npcs.forEach((n,i)=>Object.assign(n,{x:350+i*85,y:400+(i%3)*70,state:'idle',path:[],moving:false,instrument:null,wanderAt:999,instrumentAt:999,drinkAt:999,danceAt:999}));
   for(const id of ['nikita','david'])Object.assign(g.person(id),{x:id==='nikita'?1080:1180,y:560,state:'drinking',sipStarted:59,sipUntil:99,direction:'left'});
   g.bubble(g.npc,'Хороший вечер.');
  });await page.waitForTimeout(250);assert.deepEqual(errors,[]);
  const frame=await page.locator('#world').boundingBox();assert.equal(frame.x,0);assert.equal(frame.y,0);assert.equal(frame.width,width);assert.equal(frame.height,height);
  assert.ok(await page.evaluate(()=>{const r=window.__bgd.renderer,v=r.view;return v.x<=.01&&v.y<=.01&&v.x+1536*v.scale>=r.width-.1&&v.y+1024*v.scale>=r.height-.1;}));
  await page.screenshot({path:`artifacts/v07-${width}.png`});
  const rects=await page.evaluate(()=>['.mood-card','.shift-clock','.task-strip','.top-actions','#touch-e'].map(s=>document.querySelector(s)).filter(e=>e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};}));
  for(const r of rects)assert.ok(r.x>=0&&r.y>=0&&r.x+r.w<=width+1&&r.y+r.h<=height+1,JSON.stringify(r));
  for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){const a=rects[i],b=rects[j];assert.ok(!(a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y),'HUD overlap');}
  await page.locator('#overview').click();await page.waitForTimeout(80);assert.ok(await page.evaluate(()=>window.__bgd.renderer.overview));await page.locator('#overview').click();
  if(phone){
   assert.equal(await page.locator('#joystick').isVisible(),false);
   const cdp=await page.context().newCDPSession(page),a={x:width*.23,y:height*.68,id:1};
   const send=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
   await send('touchStart',[a]);await page.waitForTimeout(30);assert.ok(await page.locator('#joystick').isVisible());
   const pos=await page.locator('#joystick').boundingBox();assert.ok(Math.abs(pos.x+pos.width/2-a.x)<2&&Math.abs(pos.y+pos.height/2-a.y)<2);
   assert.deepEqual(await page.evaluate(()=>window.__bgd.getInput()),{x:0,y:0});
   const before=await page.evaluate(()=>window.__bgd.game.player.x);await send('touchMove',[{...a,x:a.x+40}]);await page.waitForTimeout(350);assert.ok((await page.evaluate(()=>window.__bgd.game.player.x))>before+20);
   // Keep the left finger held while the right finger interacts.
   await page.evaluate(()=>{const g=window.__bgd.game;Object.assign(g.npc,{x:g.player.x+12,y:g.player.y,state:'idle'});});
   const e=await page.locator('#touch-e').boundingBox(),b={x:e.x+e.width/2,y:e.y+e.height/2,id:2};
   await send('touchStart',[{...a,x:a.x+40},b]);await page.waitForFunction(()=>!!window.__bgd.game.dialogue);
   assert.deepEqual(await page.evaluate(()=>window.__bgd.getInput()),{x:0,y:0});await send('touchEnd',[]);await page.locator('#dialogue-next').click();
   const next={x:width*.37,y:height*.55,id:3};await send('touchStart',[next]);const second=await page.locator('#joystick').boundingBox();assert.ok(Math.abs(second.x+second.width/2-next.x)<2);
   await send('touchMove',[{...next,x:next.x+25}]);await send('touchCancel',[]);assert.deepEqual(await page.evaluate(()=>window.__bgd.getInput()),{x:0,y:0});assert.equal(await page.locator('#joystick').isVisible(),false);
   await page.setViewportSize({width:height,height:width});await page.waitForFunction(()=>window.__bgd.game.orientationBlocked);assert.ok(await page.locator('#rotate-screen').isVisible());const frozen=await page.evaluate(()=>window.__bgd.game.elapsed);await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>window.__bgd.game.elapsed),frozen);
   await page.setViewportSize({width,height});await page.waitForFunction(()=>!window.__bgd.game.orientationBlocked);await page.waitForTimeout(100);assert.ok((await page.evaluate(()=>window.__bgd.game.elapsed))>frozen);
  }else{
   // Review every drink pose/direction next to the normal body scale.
   await page.evaluate(()=>{const r=window.__bgd.renderer,c=document.createElement('canvas');c.id='drink-review';c.width=1120;c.height=850;c.style.cssText='position:fixed;inset:0;z-index:300;background:#393532';document.body.append(c);const ctx=c.getContext('2d');ctx.fillStyle='#393532';ctx.fillRect(0,0,c.width,c.height);
    for(const [i,id] of ['nikita','david'].entries())for(let row=0;row<3;row++)for(let col=0;col<4;col++){const src=r.drinks[id],b=src.boxes[row][col],h=220,w=h*b.w/b.h,x=(i*4+col)*140+70,y=row*280+265;ctx.drawImage(src.atlas,b.x,b.y,b.w,b.h,x-w/2,y-h,w,h);}
   });await page.locator('#drink-review').screenshot({path:'artifacts/v07-drink-review.png'});await page.evaluate(()=>document.getElementById('drink-review').remove());
  }
  if(!phone){
   await page.evaluate(()=>{const {game:g,renderer:r}=window.__bgd;g.start();g.elapsed=50;r.cameraTime=null;g.spawnEvent('comfort','erbak');g.beginEscort(g.events[0]);Object.assign(g.person('erbak'),{x:195,y:747});Object.assign(g.player,{x:265,y:747});});
   await page.waitForFunction(()=>window.__bgd.game.person('erbak').state==='leaving_queue');await page.waitForTimeout(180);
   assert.equal(await page.evaluate(()=>window.__bgd.game.stats.secretVisits),0);assert.match(await page.evaluate(()=>window.__bgd.game.person('erbak').bubble.text),/аскеза|искушать/);
   await page.screenshot({path:'artifacts/v07-erbak.png'});
  }
  await page.evaluate(()=>{window.__bgd.game.say('Никита','Хороший вечер можно не торопить.');window.__bgd.updateUI();});await page.screenshot({path:`artifacts/v07-dialogue-${width}.png`});await page.locator('#dialogue-next').click();
  assert.deepEqual(errors,[]);await page.close();console.log(`PASS ${width}x${height}: viewport fill, fullscreen fallback, camera, HUD${phone?', floating stick, multi-touch action, cancel, rotation':''}`);
 }
 // Real browser fullscreen uses a real user click; Escape must safely pause.
 const page=await browser.newPage({viewport:{width:1280,height:800}});page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'?debug=1',{timeout:60000});await page.waitForFunction(()=>window.__bgd,{timeout:60000});await page.locator('#start').click();await page.waitForFunction(()=>!!document.fullscreenElement);
 await page.evaluate(()=>document.exitFullscreen());await page.waitForFunction(()=>window.__bgd.game.paused);await page.locator('#resume').click();await page.locator('#fullscreen').click();await page.waitForFunction(()=>!!document.fullscreenElement);await page.close();
 assert.deepEqual(errors,[]);console.log('PASS real fullscreen enter/exit/re-enter; no JS/HTTP errors');
}finally{await browser.close();}
