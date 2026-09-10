import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)('/Users/yanafidoeva/hr-platform/node_modules/playwright');
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Yandex.app/Contents/MacOS/Yandex'});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
try{
 await page.goto('http://127.0.0.1:4179/bgd/');assert.match(await page.locator('body').innerText(),/Вход в игру временно закрыт/);assert.equal(await page.locator('script').count(),0);assert.equal(await page.locator('#start').count(),0);await page.screenshot({path:'artifacts/v081-maintenance.png'});
 await page.goto('http://127.0.0.1:4179/bgd/__preview?debug=1');await page.waitForFunction(()=>window.__bgd,null,{timeout:60000});await page.evaluate(()=>{Element.prototype.requestFullscreen=()=>Promise.reject(new Error('test'));Object.assign(window.__bgd.game.settings,{staggerArrivals:false,firstEventAt:999,firstSadAt:999,sessionSeconds:999});});await page.click('#start');
 await page.evaluate(()=>{const {game:g,renderer:r}=window.__bgd;r.overview=true;g.elapsed=20;g.nextSpeech=999;g.nextAmbient=999;for(const n of g.npcs)Object.assign(n,{state:'idle',instrument:null,wanderAt:999,instrumentAt:999,drinkAt:999,danceAt:999});Object.assign(g.player,{x:850,y:520});
  const smoke=r.smoke.bind(r),curtain=r.curtain.bind(r),render=r.render.bind(r);r.smoke=(...args)=>{r.lastSmoke=true;return smoke(...args);};r.curtain=(...args)=>{r.lastCurtain=true;return curtain(...args);};r.render=(...args)=>{r.lastSmoke=false;r.lastCurtain=false;return render(...args);};
 });await page.waitForTimeout(150);await page.screenshot({path:'artifacts/v081-corner-band.png'});
 for(const [i,time] of [18,24.7].entries()){await page.evaluate(time=>{window.__bgd.game.elapsed=time;},time);await page.waitForTimeout(50);await page.screenshot({path:`artifacts/v081-band-sip-${i}.png`});}
 assert.ok(await page.evaluate(()=>{const r=window.__bgd.renderer;return r.band.boxes.length===2&&r.band.boxes.every(row=>row.length===4)&&window.__bgd.game.guests.every(n=>n.x<475);}));
 await page.evaluate(()=>{const g=window.__bgd.game;g.spawnEvent('comfort','loik');g.beginEscort(g.events[0]);Object.assign(g.npc,{x:195,y:747});g.roomQueue[0].activated=true;g.updateRoom();g.roomOccupant.returnAt=999;g.beginPair();Object.assign(g.player,{x:220,y:747});Object.assign(g.person('anfisa'),{x:270,y:735});});
 await page.waitForFunction(()=>/Там сейчас занято/.test(window.__bgd.game.toast?.text));await page.waitForTimeout(900);
 assert.ok(await page.evaluate(()=>{const {game:g,renderer:r}=window.__bgd;return !g.minigame&&g.player.visible&&g.person('anfisa').visible&&r.lastSmoke&&!r.lastCurtain;}));await page.screenshot({path:'artifacts/v081-busy-smoke.png'});
 await page.keyboard.press('KeyE');assert.match(await page.evaluate(()=>window.__bgd.game.toast.text),/Там сейчас занято/);assert.equal(await page.evaluate(()=>window.__bgd.game.minigame),null);
 await page.evaluate(()=>{const g=window.__bgd.game;g.roomOccupant.returnAt=g.elapsed;});await page.waitForFunction(()=>!!window.__bgd.game.minigame);await page.waitForTimeout(130);
 assert.ok(await page.evaluate(()=>{const {game:g,renderer:r}=window.__bgd;return !g.player.visible&&!g.person('anfisa').visible&&!r.lastSmoke&&r.lastCurtain;}));await page.screenshot({path:'artifacts/v081-pair-curtain.png'});await page.click('#pencil-exit');
 // Finish the existing full cast/mini-game scenario against the private local preview.
 await page.reload();await page.waitForFunction(()=>window.__bgd);await (await import('./cast.mjs')).castQA(page,errors);
 assert.deepEqual(errors,[]);console.log('PASS v081: closed entry, four drinking musicians on corner sofa, smoke for regular guests, occupied-room refusal, moving curtain only for pair, full cast/minigame regression.');
}finally{await browser.close();}
