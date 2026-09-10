import assert from 'node:assert/strict';
export async function castQA(page,errors){
 await page.evaluate(()=>{Element.prototype.requestFullscreen=()=>Promise.reject(new Error('test fallback'));Object.assign(window.__bgd.game.settings,{staggerArrivals:false,firstEventAt:999,firstSadAt:999,sessionSeconds:999});});
 await page.click('#start');
 await page.evaluate(()=>{const {game:g,renderer:r}=window.__bgd;g.nextSpeech=999;g.nextAmbient=999;g.elapsed=40;r.overview=true;
  for(const [i,n] of g.npcs.entries())Object.assign(n,{x:330+(i%6)*145,y:440+Math.floor(i/6)*170,state:'idle',moving:false,instrument:null,path:[],wanderAt:999,instrumentAt:999,drinkAt:999,danceAt:999});
  Object.assign(g.player,{x:820,y:850});
 });await page.waitForTimeout(150);await page.screenshot({path:'artifacts/v08-full-cast.png'});
 // Render a neutral contact sheet to inspect actual in-game scale and keyed edges.
 await page.evaluate(()=>{const {game:g,renderer:r}=window.__bgd,c=document.createElement('canvas');c.id='cast-review';c.width=1400;c.height=430;c.style.cssText='position:fixed;inset:0;z-index:300;background:#393532';document.body.append(c);const ctx=c.getContext('2d');ctx.fillStyle='#393532';ctx.fillRect(0,0,1400,430);
  const old=r.ctx;r.ctx=ctx;for(const [i,n] of [g.npc,g.person('tema'),g.person('katya'),g.person('nikita'),g.person('alex'),g.person('anfisa')].entries()){ctx.save();ctx.translate(115+i*225,320);ctx.scale(1.8,1.8);r.character({body:{...n,x:0,y:0,moving:false,direction:'down'},row:n.atlasRow,player:false},g.elapsed,g);ctx.restore();ctx.fillStyle='#eee';ctx.font='18px Arial';ctx.textAlign='center';ctx.fillText(n.name,115+i*225,375);}r.ctx=old;
 });await page.locator('#cast-review').screenshot({path:'artifacts/v08-style-review.png'});await page.evaluate(()=>document.getElementById('cast-review').remove());
 // Every dance phase is a connected whole-body sprite.
 await page.evaluate(()=>{const {game:g,renderer:r}=window.__bgd;Object.assign(g.person('tema'),{x:1080,y:480,state:'dancing',danceStarted:40,danceUntil:48});g.elapsed=40;});
 for(const [i,t] of [40.3,41.8,43.9,45.9,47.1].entries()){await page.evaluate(t=>{const g=window.__bgd.game;g.elapsed=t;g.person('tema').danceUntil=48;},t);await page.waitForTimeout(35);await page.screenshot({path:`artifacts/v08-dance-${i}.png`});}
 // Approach-triggered speech and invitation through the real E binding.
 await page.evaluate(()=>{const g=window.__bgd.game;Object.assign(g.person('anfisa'),{x:370,y:540,state:'idle'});Object.assign(g.player,{x:400,y:540});g.approachAvailableAt=0;g.speakers().forEach(n=>n.bubble=null);});
 await page.waitForFunction(()=>!!window.__bgd.game.person('anfisa').bubble);await page.screenshot({path:'artifacts/v08-approach.png'});
 await page.keyboard.press('KeyE');await page.waitForFunction(()=>window.__bgd.game.dialogue?.speaker==='Анфиса');await page.keyboard.press('KeyE');assert.equal(await page.evaluate(()=>window.__bgd.game.person('anfisa').state),'following_pair');
 // Walk along a reachable route using game inputs; follower routes independently.
 await page.evaluate(async()=>{const {game:g}=window.__bgd,{findPath}=await import('./core.js?v=0.8.1');const path=findPath(g.player,{x:195,y:747},16);for(const p of path){for(let i=0;i<800&&Math.hypot(g.player.x-p.x,g.player.y-p.y)>4&&!g.minigame;i++){const dx=p.x-g.player.x,dy=p.y-g.player.y,d=Math.hypot(dx,dy);g.update(.025,{x:dx/d,y:dy/d});}}for(let i=0;i<800&&!g.minigame;i++)g.update(.025);});
 await page.waitForFunction(()=>!!window.__bgd.game.minigame);await page.waitForTimeout(120);assert.ok(await page.locator('#pencil-screen').isVisible());
 assert.ok(await page.evaluate(()=>{const g=window.__bgd.game;return !g.player.visible&&!g.person('anfisa').visible;}));
 const elapsed=await page.evaluate(()=>window.__bgd.game.elapsed);await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>window.__bgd.game.elapsed),elapsed);
 await page.screenshot({path:'artifacts/v08-pencil-desktop.png'});
 // Miss, pause, resume, and three actual button/keyboard drops.
 await page.evaluate(()=>window.__bgd.game.minigame.anchor=105);await page.keyboard.press('Space');await page.waitForFunction(()=>window.__bgd.game.minigame?.drop?.resolved);assert.equal(await page.evaluate(()=>window.__bgd.game.minigame.score),0);
 await page.keyboard.press('Escape');const time=await page.evaluate(()=>window.__bgd.game.minigame.time);await page.waitForTimeout(130);assert.equal(await page.evaluate(()=>window.__bgd.game.minigame.time),time);assert.ok(await page.locator('#pause-screen').isVisible());await page.click('#resume');
 for(let i=0;i<3;i++){
  await page.waitForFunction(()=>window.__bgd.game.minigame&&!window.__bgd.game.minigame.drop);
  await page.evaluate(async()=>{const g=window.__bgd.game,m=g.minigame,{pencilTip}=await import('./minigame.js?v=0.8.1');m.anchor+=m.target-pencilTip(m).x;});
  await page.keyboard.press('KeyE');await page.waitForTimeout(1150);
 }
 await page.waitForFunction(()=>!window.__bgd.game.minigame);assert.equal(await page.evaluate(()=>window.__bgd.game.stats.pencilWins),1);assert.ok(await page.evaluate(()=>{const g=window.__bgd.game;return g.player.visible&&g.person('anfisa').visible&&g.person('anfisa').dizzyUntil>g.elapsed;}));await page.screenshot({path:'artifacts/v08-happy-return.png'});
 // Re-entry and exit at all target landscape sizes, real pointer controls.
 for(const [width,height] of [[568,320],[844,390],[1440,900]]){
  await page.setViewportSize({width,height});await page.evaluate(()=>{const g=window.__bgd.game;g.beginPair();Object.assign(g.player,{x:195,y:747});Object.assign(g.person('anfisa'),{x:220,y:747});g.updatePair();});await page.waitForTimeout(120);
  const card=await page.locator('.pencil-card').boundingBox();assert.ok(card.x>=0&&card.y>=0&&card.x+card.width<=width+1&&card.y+card.height<=height+1,JSON.stringify(card));
  const initial=await page.evaluate(()=>window.__bgd.game.minigame.anchor);const right=await page.locator('#pencil-right').boundingBox();await page.mouse.move(right.x+right.width/2,right.y+right.height/2);await page.mouse.down();await page.waitForTimeout(120);await page.mouse.up();assert.ok((await page.evaluate(()=>window.__bgd.game.minigame.anchor))>initial+8);
  await page.screenshot({path:`artifacts/v08-pencil-${width}.png`});await page.click('#pencil-exit');assert.equal(await page.evaluate(()=>window.__bgd.game.minigame),null);assert.equal(await page.evaluate(()=>window.__bgd.game.stats.pencilWins),1);
 }
 assert.deepEqual(errors,[]);console.log('PASS v08: cast, dance, proximity speech, pair routing, misses, 3 wins, pause, return, repeat/exit, 3 landscape layouts.');
}
