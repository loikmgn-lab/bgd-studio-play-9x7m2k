import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'/Users/yanafidoeva/hr-platform/node_modules/playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||'/Applications/Yandex.app/Contents/MacOS/Yandex',args:['--no-first-run','--no-default-browser-check']});
const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
const base=process.env.BGD_URL||'http://127.0.0.1:4178/bgd/';
try{
  await page.goto(base+'?debug=1');await page.waitForFunction(()=>window.__bgd,{timeout:30000});
  await page.screenshot({path:'artifacts/start-desktop.png'});console.log('Start loaded; screenshot saved.');
  if(process.argv.includes('--screens-only')){await page.click('#start');await page.waitForTimeout(500);await page.screenshot({path:'artifacts/game-desktop.png'});console.log(JSON.stringify({errors}));}
  else{
    await page.evaluate(()=>{window.__bgd.game.settings.firstEventAt=.2;window.__bgd.game.settings.firstSadAt=.6;});
    await page.click('#start');
    const read=()=>page.evaluate(()=>{const g=window.__bgd.game;return {player:{x:g.player.x,y:g.player.y},npc:{x:g.npc.x,y:g.npc.y,state:g.npc.state,visible:g.npc.visible},stats:g.stats,events:g.events,elapsed:g.elapsed,paused:g.paused,mode:g.mode,dialogue:g.dialogue?.text,repair:g.repair?.objectId};});
    async function walkTo(target){
      // Keyboard uses eight directions, unlike an NPC's continuous steering. Keep grid corners.
      const path=await page.evaluate(async target=>{const {findPath}=await import('./core.js');return findPath(window.__bgd.game.player,target,18,false);},target);
      assert.ok(path.length,'A route must exist');
      for(const waypoint of path){
        let attempts=0;
        while(attempts++<100){
          const {player,paused}=await read();assert.equal(paused,false,'browser lost focus');
          const dx=waypoint.x-player.x,dy=waypoint.y-player.y;
          if(Math.hypot(dx,dy)<6)break;
          const horizontal=Math.abs(dx)>2?(dx>0?'KeyD':'KeyA'):null,vertical=Math.abs(dy)>2?(dy>0?'KeyS':'KeyW'):null;
          if(horizontal)await page.keyboard.down(horizontal);if(vertical)await page.keyboard.down(vertical);
          await page.waitForTimeout(Math.min(95,Math.max(15,Math.hypot(dx,dy)/182*1000*.65)));
          if(horizontal)await page.keyboard.up(horizontal);if(vertical)await page.keyboard.up(vertical);
        }
        assert.ok(attempts<100,'movement got stuck at '+JSON.stringify({waypoint,state:await read()}));
      }
    }
    await page.waitForTimeout(800);await walkTo({x:477,y:573});await page.keyboard.press('KeyE');
    await page.waitForFunction(()=>!!window.__bgd.game.dialogue);await page.screenshot({path:'artifacts/dialogue.png'});await page.keyboard.press('KeyE');
    const cause=await page.evaluate(()=>window.__bgd.game.events.find(e=>e.type==='microphone').cause);
    const checks=await page.evaluate(async cause=>{const {OBJECTS}=await import('./content.js');return ['cable','amplifier','console'].filter(id=>id!==cause).concat(cause).map(id=>OBJECTS.find(o=>o.id===id));},cause);
    for(const target of checks){await walkTo(target);await page.keyboard.press('KeyE');await page.waitForFunction(()=>!window.__bgd.game.repair,{timeout:6000});}
    assert.equal((await read()).stats.repairs,1);console.log('Technical event solved through keyboard, all three checks exercised.');
    const npc=(await read()).npc;await walkTo({x:npc.x-35,y:npc.y+12});await page.keyboard.press('KeyE');await page.waitForFunction(()=>!!window.__bgd.game.dialogue);await page.keyboard.press('KeyE');
    await walkTo({x:195,y:747});await page.waitForFunction(()=>{const n=window.__bgd.game.npc;return Math.hypot(n.x-195,n.y-747)<125;},{timeout:10000});
    await page.screenshot({path:'artifacts/escort.png'});await page.keyboard.press('KeyE');await page.waitForFunction(()=>!window.__bgd.game.npc.visible);await page.screenshot({path:'artifacts/curtain-waiting.png'});
    await page.waitForFunction(()=>window.__bgd.game.npc.state==='happy',{timeout:12000});assert.equal((await read()).stats.secretVisits,1);await page.screenshot({path:'artifacts/happy-return.png'});console.log('Escort, hidden wait and happy return verified.');
    await page.keyboard.press('Escape');const before=(await read()).elapsed;await page.waitForTimeout(600);assert.equal((await read()).elapsed,before);await page.click('#resume');
    await page.evaluate(()=>{const g=window.__bgd.game;g.settings.sessionSeconds=g.elapsed+.3;});await page.waitForFunction(()=>window.__bgd.game.mode==='finished');await page.screenshot({path:'artifacts/shift-finished.png'});
    assert.match(await page.locator('#stats').innerText(),/Устранено неполадок/);await page.click('#restart');assert.equal((await read()).stats.repairs,0);console.log('Pause, finish, statistics and restart verified.');
    await page.setViewportSize({width:390,height:844});await page.goto(base);await page.waitForFunction(()=>!document.getElementById('start').disabled);await page.screenshot({path:'artifacts/start-mobile.png'});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);console.log('Mobile viewport has no horizontal overflow.');
    assert.deepEqual(errors,[]);console.log(JSON.stringify({result:'PASS',errors}));
  }
}catch(error){await page.screenshot({path:'artifacts/browser-failure.png'}).catch(()=>{});throw error;}finally{await browser.close();}
