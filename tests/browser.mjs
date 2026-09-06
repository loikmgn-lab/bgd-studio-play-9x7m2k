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
  if(process.argv.includes('--motion')){
    await page.click('#start');
    await page.evaluate(()=>{
      const {game,renderer}=window.__bgd;game.paused=true;
      const canvas=document.createElement('canvas');canvas.id='motion-review';canvas.width=1280;canvas.height=920;canvas.style.cssText='position:fixed;left:0;top:0;z-index:9999;background:#36312f';document.body.append(canvas);
      const c=canvas.getContext('2d');c.fillStyle='#36312f';c.fillRect(0,0,1280,920);
      for(let dir=0;dir<4;dir++)for(let row=0;row<2;row++)for(let phase=0;phase<4;phase++){
        c.save();c.translate((row*4+phase)*160+80,dir*230+216);renderer.motion.draw(c,row,dir,'walk',phase*Math.PI/2,185);c.restore();
      }
    });
    await page.locator('#motion-review').screenshot({path:'artifacts/walk-cycle-review.png'});
    await page.evaluate(()=>document.getElementById('motion-review').remove());
    for(const id of ['synth','guitar-left','guitar-right','drums']){
      await page.evaluate(async id=>{const {game}=window.__bgd,{INSTRUMENTS}=await import('./content.js');const instrument=INSTRUMENTS.find(i=>i.id===id);Object.assign(game.npc,{...instrument,state:'playing_instrument',instrument,visible:true,moving:false});game.elapsed=5;},id);
      await page.waitForTimeout(180);await page.evaluate(()=>document.getElementById('pause-screen').style.display='none');await page.locator('#world').screenshot({path:`artifacts/playing-${id}.png`});
    }
    assert.deepEqual(errors,[]);console.log('Motion atlas and all instrument poses rendered without errors.');
  }
  else if(process.argv.includes('--chaos')){
    await page.evaluate(()=>Object.assign(window.__bgd.game.settings,{firstArrivalAt:.1,arrivalInterval:.7,firstEventAt:999,firstSadAt:999,secretSeconds:2}));
    await page.click('#start');await page.waitForFunction(()=>window.__bgd.game.npcs.every(n=>n.visible&&n.state!=='arriving'),{timeout:30000});
    await page.evaluate(()=>{const g=window.__bgd.game;Object.assign(g.person('tema'),{x:1080,y:480,state:'dancing',instrument:null,danceUntil:g.elapsed+50});g.spawnEvent('comfort','samat');});
    await page.waitForTimeout(800);await page.screenshot({path:'artifacts/chaos-dance-samat.png'});
    await page.evaluate(()=>{const g=window.__bgd.game,n=g.person('samat');Object.assign(g.player,{x:n.x+15,y:n.y});});await page.keyboard.press('KeyE');await page.waitForFunction(()=>document.getElementById('speaker').textContent==='Самат');await page.keyboard.press('KeyE');
    assert.equal(await page.evaluate(()=>window.__bgd.game.roomQueue.length),4);
    await page.evaluate(()=>{Object.assign(window.__bgd.game.player,{x:195,y:747});});
    await page.waitForFunction(()=>!!window.__bgd.game.roomOccupant,{timeout:15000});await page.waitForTimeout(1200);await page.screenshot({path:'artifacts/chaos-queue-smoke.png'});
    await page.waitForFunction(()=>window.__bgd.game.stats.secretVisits===4,{timeout:20000});assert.equal(await page.evaluate(()=>window.__bgd.game.roomOccupant),null);
    await page.screenshot({path:'artifacts/chaos-happy.png'});assert.deepEqual(errors,[]);console.log('PASS: arrivals, Samat dialogue, dance, four-person queue, smoke and four happy returns.');
  }
  else if(process.argv.includes('--screens-only')){await page.click('#start');await page.waitForTimeout(500);await page.screenshot({path:'artifacts/game-desktop.png'});console.log(JSON.stringify({errors}));}
  else{
    await page.evaluate(()=>{Object.assign(window.__bgd.game.settings,{firstEventAt:.2,firstSadAt:999,staggerArrivals:false,queueCompanions:0});});
    await page.click('#start');
    await page.evaluate(()=>window.__bgd.game.spawnEvent('comfort','loik'));
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
    await walkTo({x:195,y:747});await page.waitForFunction(()=>!window.__bgd.game.npc.visible,{timeout:10000});
    await page.waitForTimeout(1400);await page.screenshot({path:'artifacts/curtain-waiting.png'});
    await page.waitForFunction(()=>window.__bgd.game.npc.state==='happy',{timeout:12000});assert.equal((await read()).stats.secretVisits,1);await page.screenshot({path:'artifacts/happy-return.png'});console.log('Escort, hidden wait and happy return verified.');
    await page.keyboard.press('Escape');const before=(await read()).elapsed;await page.waitForTimeout(600);assert.equal((await read()).elapsed,before);await page.click('#resume');
    await page.evaluate(()=>{const g=window.__bgd.game;g.settings.sessionSeconds=g.elapsed+.3;});await page.waitForFunction(()=>window.__bgd.game.mode==='finished');await page.screenshot({path:'artifacts/shift-finished.png'});
    assert.match(await page.locator('#stats').innerText(),/Устранено неполадок/);await page.click('#restart');assert.equal((await read()).stats.repairs,0);console.log('Pause, finish, statistics and restart verified.');
    await page.setViewportSize({width:390,height:844});await page.goto(base);await page.waitForFunction(()=>!document.getElementById('start').disabled);await page.screenshot({path:'artifacts/start-mobile.png'});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);console.log('Mobile viewport has no horizontal overflow.');
    assert.deepEqual(errors,[]);console.log(JSON.stringify({result:'PASS',errors}));
  }
}catch(error){await page.screenshot({path:'artifacts/browser-failure.png'}).catch(()=>{});throw error;}finally{await browser.close();}
