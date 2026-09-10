import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game,canStand,moveBody,findPath,lineClear,distance} from '../public/core.js';
import {WORLD,OBJECTS,SETTINGS,INSTRUMENTS} from '../public/content.js';
const tick=(g,seconds,input={})=>{for(let i=0;i<Math.ceil(seconds/.025);i++)g.update(.025,input);};
const active=()=>{const g=new Game({firstEventAt:999,firstSadAt:999,sessionSeconds:300,staggerArrivals:false,queueCompanions:0},()=>.01);g.start();return g;};
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
  const g=active();g.spawnEvent('comfort');const e=g.events[0];g.beginEscort(e);
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
  const g=active();assert.equal(g.npcs.length,12);
  for(const n of g.npcs){assert.ok(canStand(n.x,n.y),n.name);assert.ok(findPath(WORLD.spawn,n).length,n.name);}
  const seen=new Set();
  for(let i=0;i<3200;i++){
    g.update(.025);const reserved=g.npcs.filter(n=>n.instrument).map(n=>n.instrument.id);
    assert.equal(new Set(reserved).size,reserved.length,'instrument double-booked');
    for(const n of g.npcs){assert.ok(canStand(n.x,n.y),n.name+' inside obstacle');if(n.state==='playing_instrument')seen.add(n.id);}
  }
  assert.equal(seen.size,9,'each musician gets a turn');
});
test('each crew member responds under their own name',()=>{
  const g=active();
  for(const n of g.npcs){Object.assign(g.player,{x:n.x+20,y:n.y});g.interact();assert.equal(g.dialogue?.speaker,n.name);g.closeDialogue();}
});
test('Albert can play an available instrument and movement immediately releases it',()=>{
  const g=active();Object.assign(g.player,INSTRUMENTS[1]);g.interact();assert.equal(g.player.instrument.id,'guitar-left');
  tick(g,.1,{x:1,y:0});assert.equal(g.player.instrument,null);
});
test('events repeat, do not duplicate active types, and mood never ends game',()=>{
  const g=new Game({sessionSeconds:250,staggerArrivals:false,firstSadAt:21});g.start();tick(g,22);assert.equal(g.events.length,2);tick(g,120);assert.equal(g.events.length,3);assert.ok(g.mood>=0);assert.equal(g.mode,'playing');
  const e=g.events.find(e=>e.type==='microphone');g.solve(e);tick(g,36);assert.ok(g.events.some(e=>e.type==='microphone'));
});
test('dialogue and pause freeze session and secret timer; finish freezes gameplay',()=>{
  const g=active();g.say('Лоик','Тест');tick(g,2);assert.equal(g.elapsed,0);g.closeDialogue();g.togglePause();tick(g,2);assert.equal(g.elapsed,0);g.togglePause();g.settings.sessionSeconds=1;tick(g,1.5);assert.equal(g.mode,'finished');const p={...g.player};tick(g,2,{x:1});assert.deepEqual(g.player,p);
});
test('restart resets statistics, NPC visibility, dialogue and events',()=>{
  const g=active();g.stats.people=5;g.npc.visible=false;g.say('Лоик','Тест');g.start();assert.equal(g.stats.people,0);assert.equal(g.npc.visible,true);assert.equal(g.dialogue,null);assert.equal(g.events.length,0);
});
test('crew arrives one by one from the entrance and every member eventually arrives',()=>{
  const g=new Game({firstEventAt:999,firstSadAt:999});g.start();assert.ok(g.npcs.filter(n=>n.id!=='anfisa').every(n=>!n.visible));assert.ok(g.person('anfisa').visible);
  const seen=new Set(['anfisa']);for(let i=0;i<2400;i++){g.update(.025);for(const n of g.npcs)if(n.visible&&!seen.has(n.id)){assert.ok(n.x>1050&&n.y>910,'arrival must use entrance');seen.add(n.id);}}
  assert.equal(seen.size,12);assert.ok(g.npcs.every(n=>canStand(n.x,n.y)));
});
test('Samat lies still and shouts; escort stops hysteria; Tema periodically dances',()=>{
  const g=active(),s=g.person('samat');g.spawnEvent('comfort','samat');tick(g,.1);
  assert.equal(s.state,'hysterical');assert.ok(g.signals.some(s=>s.type==='shout'&&/РЕАНИМАЦИОННУЮ/.test(s.text)));
  g.beginEscort(g.events[0]);assert.equal(s.state,'following_albert');assert.ok(g.signals.some(s=>s.type==='stop-speech'));
  const seen=new Set(['anfisa']);for(let i=0;i<2400;i++){g.update(.025);seen.add(g.person('tema').state);}assert.ok(seen.has('dancing'));
});
test('three companions queue and visit strictly one at a time with happy returns',()=>{
  const g=active();g.settings.queueCompanions=3;g.settings.secretSeconds=1;
  g.spawnEvent('comfort','samat');g.beginEscort(g.events[0]);assert.equal(g.roomQueue.length,4);
  const expected=g.roomQueue.map(t=>t.npcId),entered=[],returned=new Set();let checkedPause=false;Object.assign(g.player,WORLD.curtain);
  for(let i=0;i<2400&&returned.size<4;i++){
    g.update(.025);const hidden=g.npcs.filter(n=>!n.visible);assert.ok(hidden.length<=1,'only one person can be inside');
    if(g.roomOccupant&&!entered.includes(g.roomOccupant.npcId))entered.push(g.roomOccupant.npcId);
    if(g.roomOccupant&&!checkedPause){const before=g.elapsed,occupant=g.roomOccupant;g.togglePause();tick(g,3);assert.equal(g.elapsed,before);assert.equal(g.roomOccupant,occupant);g.togglePause();checkedPause=true;}
    for(const n of g.npcs){if(n.state==='happy')returned.add(n.id);if(n.visible)assert.ok(canStand(n.x,n.y));}
  }
  assert.deepEqual(entered,expected);assert.equal(returned.size,4);assert.equal(g.stats.secretVisits,4);assert.equal(g.stats.people,4);
  tick(g,3);assert.equal(g.stats.secretVisits,4);g.start();assert.deepEqual(g.roomQueue,[]);assert.equal(g.roomOccupant,null);
});
test('all real NPCs can receive a room event without duplicate tickets',()=>{
  for(const id of ['loik','samat','tema','vovan','katya','username','erbak','david']){const g=active();assert.ok(g.spawnEvent('comfort',id));assert.equal(g.spawnEvent('comfort',id),false);g.beginEscort(g.events[0]);g.beginEscort(g.events[0]);assert.equal(g.roomQueue.length,1);}
});
test('both guitar positions and six queue positions are reachable, banter varies',()=>{
  const g=active();assert.equal(INSTRUMENTS.filter(i=>i.pose==='guitar').length,2);
  for(const p of [...INSTRUMENTS,...Array.from({length:6},(_,i)=>g.queuePosition(i))]){assert.ok(canStand(p.x,p.y),JSON.stringify(p));assert.ok(findPath(WORLD.spawn,p).length);}
  assert.notEqual(g.pick('happy'),g.pick('happy'));
});

test('Sveta and Nikita never request or join the room; Samat stays in place',()=>{
 const g=active();g.settings.queueCompanions=20;
 for(const id of ['sveta','nikita'])assert.equal(g.spawnEvent('comfort',id),false);
 const samat=g.person('samat'),pos={x:samat.x,y:samat.y};g.spawnEvent('comfort','samat');tick(g,9);
 assert.equal(samat.x,pos.x);assert.equal(samat.y,pos.y);assert.equal(samat.moving,false);
 g.beginEscort(g.events[0]);assert.ok(g.roomQueue.every(t=>!['sveta','nikita'].includes(t.npcId)));
});
test('David repeatedly drinks at the table; Nikita carries whisky and stops to sip',()=>{
 const g=active(),seen=new Set();
 for(let i=0;i<3600;i++){
  g.update(.025);
  for(const id of ['david','nikita']){const n=g.person(id);if(n.state==='drinking'){seen.add(id);assert.equal(n.moving,false);if(id==='david')assert.ok(distance(n,{x:460,y:320})<8);}}
 }
 assert.equal(seen.size,2);for(const id of seen){assert.ok(g.person(id).drinkCount>=2,id);assert.equal(g.person(id).instrument,null);}
});
test('speech uses one shared slot with long silent intervals; arrivals and returns do not create popups',()=>{
 const g=active();assert.equal(g.toast,null);
 assert.ok(g.bubble(g.npc,'Привет!'));assert.equal(g.bubble(g.person('nikita'),'Ещё реплика'),false);
 tick(g,4);assert.ok(g.npcs.every(n=>!n.bubble||n.bubble.until<=g.elapsed));
 assert.equal(g.bubble(g.person('katya'),'Ещё реплика'),false);
 const emissions=[];let previous=null;
 for(let i=0;i<6400;i++){g.update(.025);const live=g.npcs.filter(n=>n.bubble?.until>g.elapsed);assert.ok(live.length<=1);const b=live[0]?.bubble;if(b&&b!==previous){emissions.push(g.elapsed);previous=b;}}
 assert.ok(emissions.length>=3&&emissions.length<=11);
 for(let i=1;i<emissions.length;i++)assert.ok(emissions[i]-emissions[i-1]>=15.95);
 const h=active();h.rewardVisit(h.npc);assert.equal(h.toast,null);
 const arriving=new Game({firstEventAt:999,firstSadAt:999});arriving.start();tick(arriving,10);assert.equal(arriving.toast,null);
});
test('portrait orientation freezes the shift and interactions without changing manual pause',()=>{
 const g=active();g.spawnEvent('comfort');Object.assign(g.player,{x:g.npc.x+10,y:g.npc.y});g.orientationBlocked=true;
 const before={...g.player};tick(g,5,{x:1});g.interact();assert.equal(g.elapsed,0);assert.equal(g.dialogue,null);assert.deepEqual(g.player,before);
 g.orientationBlocked=false;tick(g,.1,{x:1});assert.ok(g.elapsed>0);
 g.paused=true;g.orientationBlocked=true;g.orientationBlocked=false;tick(g,1);assert.equal(g.paused,true);
});

test('floating stick has a dead zone, analogue speed and normalized diagonals',async()=>{
 const {stickVector}=await import('../public/controls.js');assert.deepEqual(stickVector(2,2),{x:0,y:0});
 const half=stickVector(21,0),full=stickVector(42,0),diagonal=stickVector(100,100);
 assert.ok(half.x>0&&half.x<full.x);assert.equal(full.x,1);assert.ok(Math.abs(Math.hypot(diagonal.x,diagonal.y)-1)<.001);
});
test('camera fills wide screens, remains bounded and can show the whole studio',async()=>{
 const {cameraTarget}=await import('../public/camera.js');
 for(const [w,h] of [[568,320],[844,390],[1440,900]])for(const p of [{x:110,y:150},{x:1400,y:920}]){
  const v=cameraTarget(w,h,p);assert.ok(v.x<=0&&v.y<=0);assert.ok(v.x+WORLD.width*v.scale>=w-.01&&v.y+WORLD.height*v.scale>=h-.01);
  const all=cameraTarget(w,h,p,true);assert.ok(WORLD.width*all.scale<=w+.01&&WORLD.height*all.scale<=h+.01);
 }
});
test('drinking frames lift, sip and lower as one complete body pose',async()=>{
 const {drinkFrame}=await import('../public/camera.js'),n={state:'drinking',sipStarted:10,sipUntil:13};
 assert.deepEqual([10.1,10.4,11.4,12.5,12.9].map(t=>drinkFrame(n,t)),[0,1,2,1,0]);assert.equal(drinkFrame({state:'walking'},3),0);
});

test('Erbak declines only at his turn, walks away and allows the next visitor without a reward',()=>{
 const g=active();g.settings.secretSeconds=.5;
 g.spawnEvent('comfort','erbak');const event=g.events[0];g.beginEscort(event);
 const erbak=g.person('erbak');Object.assign(erbak,{x:195,y:747});Object.assign(g.player,WORLD.curtain);g.roomQueue[0].activated=true;
 g.spawnEvent('comfort','loik');g.beginEscort(g.events.find(e=>e.npcId==='loik'));g.roomQueue[1].activated=true;Object.assign(g.npc,{x:237,y:747});
 // An occupied room does not trigger an early refusal.
 g.roomOccupant={npcId:'vovan',enteredAt:0,returnAt:2,eventId:null};g.person('vovan').visible=false;
 tick(g,.5);assert.ok(g.roomQueue.some(t=>t.npcId==='erbak'));assert.notEqual(erbak.state,'leaving_queue');
 tick(g,2.5);assert.equal(erbak.state,'leaving_queue');assert.ok(erbak.visible);assert.match(erbak.bubble.text,/аскеза|искушать/);assert.equal(g.events.includes(event),false);assert.ok(!g.roomQueue.some(t=>t.npcId==='erbak'));
 const visited=g.stats.secretVisits;assert.equal(visited,1);tick(g,8);assert.equal(g.stats.secretVisits,2);assert.ok(erbak.x>300);assert.ok(erbak.visible);
});

test('Anfisa is available from start; escort is repeatable and independent of event capacity',()=>{
 const g=new Game();g.start();const a=g.person('anfisa');assert.ok(a.visible);g.events=Array.from({length:3},(_,id)=>({id,type:'microphone',phase:'checking',checked:[]}));
 Object.assign(g.player,{x:a.x+15,y:a.y});g.interact();assert.equal(g.dialogue.speaker,'Анфиса');g.closeDialogue();assert.equal(a.state,'following_pair');
 g.beginPair();assert.equal(g.roomQueue.length,0);assert.equal(g.spawnEvent('comfort','anfisa'),false);
 Object.assign(g.player,WORLD.curtain);for(let i=0;i<800&&!g.minigame;i++)g.update(.025);
 assert.ok(g.minigame);assert.equal(a.visible,false);assert.equal(g.player.visible,false);assert.equal(g.roomOccupant,null);
 g.leavePair();assert.ok(a.visible&&g.player.visible);assert.equal(g.stats.secretVisits,0);g.beginPair();assert.equal(a.state,'following_pair');
});
test('pair waits for existing visitor, enters together, and resumes queued visitors afterwards',()=>{
 const g=active();g.settings.secretSeconds=1;g.spawnEvent('comfort','loik');g.beginEscort(g.events[0]);Object.assign(g.npc,WORLD.curtain);g.roomQueue[0].activated=true;g.updateRoom();
 const a=g.person('anfisa');g.beginPair();Object.assign(g.player,WORLD.curtain);Object.assign(a,{x:220,y:747});tick(g,.4);assert.equal(g.minigame,null);assert.ok(g.player.visible&&a.visible);assert.equal(g.npc.visible,false);
 tick(g,1);assert.ok(g.minigame);assert.ok(g.npc.visible);assert.equal(g.stats.secretVisits,1);
 g.leavePair(true);assert.equal(g.stats.secretVisits,2);assert.equal(g.stats.pencilWins,1);assert.ok(a.dizzyUntil>g.elapsed&&a.state==='happy');assert.ok(g.player.happyUntil>g.elapsed);assert.ok(canStand(a.x,a.y)&&canStand(g.player.x,g.player.y));
 g.leavePair(true);assert.equal(g.stats.pencilWins,1);g.spawnEvent('comfort','vovan');g.beginEscort(g.events.find(e=>e.npcId==='vovan'));Object.assign(g.player,WORLD.curtain);tick(g,12);assert.equal(g.stats.secretVisits,3);
});
test('pencil game misses, scores three timed hits, freezes studio, supports pause and restart',async()=>{
 const {pencilTip}=await import('../public/minigame.js');const g=active();g.beginPair();Object.assign(g.player,WORLD.curtain);Object.assign(g.person('anfisa'),WORLD.curtain);g.updatePair();
 const elapsed=g.elapsed;g.minigame.anchor=105;g.dropPencil();g.dropPencil();assert.equal(g.minigame.attempts,1);tick(g,1.2);assert.equal(g.minigame.score,0);assert.match(g.minigame.feedback,/мимо/);assert.equal(g.elapsed,elapsed);
 g.togglePause();const time=g.minigame.time;tick(g,2);g.dropPencil();assert.equal(g.minigame.time,time);assert.equal(g.minigame.drop,null);g.togglePause();
 g.orientationBlocked=true;tick(g,1);assert.equal(g.minigame.time,time);g.orientationBlocked=false;
 for(let hit=0;hit<3;hit++){const m=g.minigame;m.anchor+=m.target-pencilTip(m).x;g.dropPencil();tick(g,1.2);}
 assert.equal(g.minigame,null);assert.equal(g.stats.pencilWins,1);assert.ok(g.player.visible&&g.person('anfisa').visible);
 g.beginPair();g.start();assert.equal(g.pair,null);assert.equal(g.minigame,null);assert.equal(g.stats.pencilWins,0);assert.ok(g.player.visible);
});
test('end of shift cannot strand Albert or Anfisa behind the curtain',()=>{
 const g=active();g.beginPair();Object.assign(g.player,WORLD.curtain);Object.assign(g.person('anfisa'),WORLD.curtain);g.updatePair();g.finish();assert.equal(g.mode,'finished');assert.ok(g.player.visible&&g.person('anfisa').visible);assert.equal(g.minigame,null);assert.equal(g.pair,null);
});
test('nearby characters speak without E, no rapid repeated speech, band members respond',()=>{
 const g=active();for(const n of g.npcs)Object.assign(n,{wanderAt:999,instrumentAt:999,drinkAt:999,danceAt:999});
 const alex=g.person('alex');Object.assign(g.player,{x:alex.x,y:alex.y+50});g.updateApproach();assert.ok(alex.bubble);assert.equal(g.dialogue,null);const first=alex.bubble;tick(g,6);assert.ok(!alex.bubble||alex.bubble===first);
 const band=g.guests[2];Object.assign(g.player,{x:470,y:270});g.interact();assert.equal(g.dialogue.speaker,band.name);g.closeDialogue();tick(g,4);assert.ok(band.bubble);assert.ok(g.speakers().filter(n=>n.bubble?.until>g.elapsed).length<=1);
});
test('Nikita stays cheerful, reacts to Albert, and never joins either curtain activity',()=>{
 const g=active(),n=g.person('nikita');assert.ok(n.cheerful);Object.assign(g.player,{x:n.x+15,y:n.y});g.interact();assert.ok(n.cheerUntil>g.elapsed);assert.match(g.dialogue.text,/вечер|радость|Улыбка|Жизнь/);g.closeDialogue();g.beginPair();assert.equal(g.person('anfisa').state,'following_pair');assert.notEqual(n.state,'following_pair');assert.equal(g.spawnEvent('comfort','nikita'),false);
});

test('Albert visibly finishes approaching the curtain before the pair disappears',()=>{
 const g=active();g.beginPair();Object.assign(g.player,{x:265,y:650});Object.assign(g.person('anfisa'),{x:220,y:735});g.updatePair();assert.equal(g.minigame,null);assert.ok(g.player.visible);
 tick(g,1);assert.ok(g.minigame);assert.ok(distance(g.player,WORLD.curtain)<38);assert.equal(g.person('anfisa').visible,false);
});

test('busy curtain refuses the pair, displays a message and keeps both visible',()=>{
 const g=active();g.spawnEvent('comfort','loik');g.beginEscort(g.events[0]);Object.assign(g.npc,WORLD.curtain);g.roomQueue[0].activated=true;g.updateRoom();g.roomOccupant.returnAt=999;
 g.beginPair();Object.assign(g.player,WORLD.curtain);Object.assign(g.person('anfisa'),{x:220,y:747});tick(g,.1);
 assert.equal(g.minigame,null);assert.ok(g.player.visible&&g.person('anfisa').visible);assert.match(g.toast.text,/Там сейчас занято/);assert.match(g.person('anfisa').bubble.text,/Там сейчас занято/);
 g.interact();assert.match(g.toast.text,/Там сейчас занято/);tick(g,15);assert.equal(g.minigame,null);assert.equal(g.stats.pencilWins,0);assert.ok(g.player.visible&&g.person('anfisa').visible);
});
test('all four band guests occupy the corner sofa and have a reachable approach',()=>{
 const g=active();assert.equal(g.guests.length,4);
 for(const n of g.guests){assert.ok(n.x>=130&&n.x<=474&&n.y<=363);assert.ok(canStand(n.approach.x,n.approach.y),n.name);assert.ok(findPath(WORLD.spawn,n.approach).length,n.name);}
});
