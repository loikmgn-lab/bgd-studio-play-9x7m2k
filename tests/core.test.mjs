import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game,canStand,moveBody,findPath,lineClear,distance} from '../public/core.js';
import {WORLD,OBJECTS,SETTINGS,INSTRUMENTS} from '../public/content.js';
const tick=(g,seconds,input={})=>{for(let i=0;i<Math.ceil(seconds/.025);i++)g.update(.025,input);};
const active=()=>{const g=new Game({firstEventAt:999,firstSadAt:999,sessionSeconds:300},()=>.01);g.start();return g;};
test('all interaction positions, entrance and curtain exit are reachable from spawn',()=>{
  for(const target of [...OBJECTS,WORLD.curtain.exit]){
    assert.ok(canStand(target.x,target.y),`${target.id||'exit'} is inside a collider`);
    const path=findPath(WORLD.spawn,target);assert.ok(path.length,`no route to ${target.id}`);
    let point=WORLD.spawn;for(const next of path){assert.ok(lineClear(point,next),`route segment blocked: ${target.id}`);point=next;}
  }
});
test('walls, couch, drums, desk, tea equipment and speakers block travel',()=>{
  for(const [x,y] of [[75,750],[1180,200],[620,735],[595,190],[225,443],[1290,865]])assert.equal(canStand(x,y),false);
  const body={x:1180,y:310,radius:12};moveBody(body,0,-500);assert.ok(body.y>=260);assert.ok(canStand(body.x,body.y));
  const wall={x:1100,y:875,radius:12};moveBody(wall,0,1000);assert.ok(wall.y<978);assert.ok(canStand(wall.x,wall.y));
});
test('podium allows walking on its clear edge; drum kit remains solid',()=>{
  assert.ok(canStand(813,750));assert.equal(canStand(620,740),false);
});
test('diagonal movement is normalized; Shift is faster',()=>{
  const a=active(),b=active(),c=active();for(const g of[a,b,c])Object.assign(g.player,{x:1050,y:500});
  tick(a,.5,{x:1,y:0});tick(b,.5,{x:1,y:1});tick(c,.5,{x:1,y:0,run:true});
  assert.ok(Math.abs(distance(a.player,{x:1050,y:500})-distance(b.player,{x:1050,y:500}))<.1);
  assert.ok(distance(c.player,{x:1050,y:500})>distance(a.player,{x:1050,y:500})*1.4);
});
test('repair requires E at microphone, dialogue, diagnosis, actual timed repair',()=>{
  const g=active();g.spawnEvent('microphone');Object.assign(g.player,OBJECTS.find(o=>o.id==='microphone'));g.interact();assert.ok(g.dialogue);g.interact();assert.equal(g.events[0].phase,'checking');
  Object.assign(g.player,OBJECTS.find(o=>o.id==='amplifier'));g.interact();tick(g,3.2);assert.equal(g.stats.repairs,0);assert.ok(g.events[0].checked.includes('amplifier'));
  Object.assign(g.player,OBJECTS.find(o=>o.id==='cable'));g.interact();tick(g,3.2);assert.equal(g.stats.repairs,1);assert.equal(g.stats.rehearsals,1);assert.equal(g.events.length,0);assert.ok(g.mood>SETTINGS.initialMood);
});
test('all three randomized causes are solvable',()=>{
  for(const chance of [.01,.45,.99]){
    const g=active();g.random=()=>chance;g.spawnEvent('microphone');const e=g.events[0];e.phase='checking';
    Object.assign(g.player,OBJECTS.find(o=>o.id===e.cause));g.interact();tick(g,3.2);assert.equal(g.stats.repairs,1);
  }
});
test('escort routes around furniture; enters only nearby; returns happy and counts once',()=>{
  const g=active();g.spawnEvent('comfort');Object.assign(g.player,{x:g.npc.x+30,y:g.npc.y});g.interact();assert.ok(g.dialogue);g.interact();assert.equal(g.npc.state,'following_albert');
  Object.assign(g.player,WORLD.curtain);g.interact();assert.equal(g.npc.visible,true); // too far to enter
  for(let i=0;i<320&&g.npc.visible;i++)g.update(.025);
  assert.ok(distance(g.npc,WORLD.curtain)<75,`NPC stuck at ${g.npc.x},${g.npc.y}`);assert.ok(canStand(g.npc.x,g.npc.y));
  assert.equal(g.npc.visible,false);assert.equal(g.npc.state,'waiting');assert.equal(g.stats.secretVisits,0);
  tick(g,6);assert.equal(g.npc.visible,false);tick(g,1.2);assert.equal(g.npc.visible,true);assert.equal(g.npc.state,'happy');assert.equal(g.stats.people,1);assert.equal(g.stats.secretVisits,1);assert.ok(canStand(g.npc.x,g.npc.y));
  tick(g,3);assert.equal(g.stats.secretVisits,1);
});
test('escort automatically enters from broad curtain area without any extra E',()=>{
  const g=active();g.spawnEvent('comfort');const e=g.events[0];e.phase='following';g.npc.state='following_albert';
  Object.assign(g.player,{x:240,y:650});Object.assign(g.npc,{x:320,y:690});
  tick(g,1);assert.equal(g.npc.visible,false);assert.equal(e.phase,'waiting');assert.equal(g.stats.secretVisits,0);
  tick(g,8);assert.equal(g.stats.secretVisits,1);
});
test('NPC reaches and plays three instruments, then repeats; sadness interrupts music',()=>{
  const g=active();g.npcs=[g.npc];g.settings.instrumentSeconds=.4;g.settings.instrumentBreak=.1;
  const seen=new Set();
  for(let i=0;i<3000;i++){g.update(.025);if(g.npc.state==='playing_instrument')seen.add(g.npc.instrument.id);}
  assert.deepEqual([...seen].sort(),INSTRUMENTS.map(i=>i.id).sort());
  assert.ok(g.npc.instrumentIndex>=4);assert.ok(g.spawnEvent('comfort'));assert.equal(g.npc.instrument,null);assert.equal(g.npc.state,'sad');
});
test('full crew spawns on reachable floor and instruments have exclusive reservations',()=>{
  const g=active();assert.equal(g.npcs.length,6);
  for(const n of g.npcs){assert.ok(canStand(n.x,n.y),n.name);assert.ok(findPath(WORLD.spawn,n).length,n.name);}
  const seen=new Set();
  for(let i=0;i<3200;i++){
    g.update(.025);const reserved=g.npcs.filter(n=>n.instrument).map(n=>n.instrument.id);
    assert.equal(new Set(reserved).size,reserved.length,'instrument double-booked');
    for(const n of g.npcs){assert.ok(canStand(n.x,n.y),n.name+' inside obstacle');if(n.state==='playing_instrument')seen.add(n.id);}
  }
  assert.equal(seen.size,6,'each crew member gets a turn');
});
test('each crew member responds under their own name',()=>{
  const g=active();
  for(const n of g.npcs){Object.assign(g.player,{x:n.x+20,y:n.y});g.interact();assert.equal(g.dialogue?.speaker,n.name);g.closeDialogue();}
});
test('Albert can play an available instrument and movement immediately releases it',()=>{
  const g=active();Object.assign(g.player,INSTRUMENTS[1]);g.interact();assert.equal(g.player.instrument.id,'guitar');
  tick(g,.1,{x:1,y:0});assert.equal(g.player.instrument,null);
});
test('events repeat, do not duplicate active types, and mood never ends game',()=>{
  const g=new Game({sessionSeconds:250});g.start();tick(g,22);assert.equal(g.events.length,2);tick(g,120);assert.equal(g.events.length,2);assert.ok(g.mood>=0);assert.equal(g.mode,'playing');
  const e=g.events.find(e=>e.type==='microphone');g.solve(e);tick(g,36);assert.ok(g.events.some(e=>e.type==='microphone'));
});
test('dialogue and pause freeze session and secret timer; finish freezes gameplay',()=>{
  const g=active();g.say('Лоик','Тест');tick(g,2);assert.equal(g.elapsed,0);g.closeDialogue();g.togglePause();tick(g,2);assert.equal(g.elapsed,0);g.togglePause();g.settings.sessionSeconds=1;tick(g,1.5);assert.equal(g.mode,'finished');const p={...g.player};tick(g,2,{x:1});assert.deepEqual(g.player,p);
});
test('restart resets statistics, NPC visibility, dialogue and events',()=>{
  const g=active();g.stats.people=5;g.npc.visible=false;g.say('Лоик','Тест');g.start();assert.equal(g.stats.people,0);assert.equal(g.npc.visible,true);assert.equal(g.dialogue,null);assert.equal(g.events.length,0);
});
