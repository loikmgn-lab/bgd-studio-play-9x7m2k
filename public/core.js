import {SETTINGS, WORLD, CHARACTERS, OBJECTS, DIALOGUES, EVENT_TYPES, INSTRUMENTS, SOCIAL_ORDER, BAND_GUESTS} from './content.js?v=0.8.0';
import {createPencilGame,updatePencilGame,dropPencil} from './minigame.js?v=0.8.0';
import {BANTER} from './banter.js?v=0.8.0';
export const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
export function atCurtain(body) {const z=WORLD.curtain.zone;return body.x>=z.x&&body.x<=z.x+z.w&&body.y>=z.y&&body.y<=z.y+z.h;}
export function pointInPolygon(p, polygon) {
  let inside=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const a=polygon[i],b=polygon[j];
    if(((a.y>p.y)!==(b.y>p.y)) && p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x) inside=!inside;
  }
  return inside;
}
function segmentDistance(p,a,b) {
  const t=clamp(((p.x-a.x)*(b.x-a.x)+(p.y-a.y)*(b.y-a.y))/((b.x-a.x)**2+(b.y-a.y)**2||1),0,1);
  return Math.hypot(p.x-a.x-t*(b.x-a.x),p.y-a.y-t*(b.y-a.y));
}
export function canStand(x,y,radius=12) {
  const p={x,y};
  if(!pointInPolygon(p,WORLD.floor)) return false;
  for(let i=0;i<WORLD.floor.length;i++) if(segmentDistance(p,WORLD.floor[i],WORLD.floor[(i+1)%WORLD.floor.length])<radius) return false;
  return !WORLD.obstacles.some(o=>{
    if(o.points) return pointInPolygon(p,o.points)||o.points.some((v,i)=>segmentDistance(p,v,o.points[(i+1)%o.points.length])<radius);
    if(o.rx) return ((x-o.x)/(o.rx+radius))**2+((y-o.y)/(o.ry+radius))**2<1;
    return Math.hypot(x-clamp(x,o.x,o.x+o.w),y-clamp(y,o.y,o.y+o.h))<radius;
  });
}
export function moveBody(body,dx,dy) {
  const count=Math.max(1,Math.ceil(Math.hypot(dx,dy)/5));
  for(let i=0;i<count;i++) {
    if(canStand(body.x+dx/count,body.y,body.radius)) body.x+=dx/count;
    if(canStand(body.x,body.y+dy/count,body.radius)) body.y+=dy/count;
  }
}
export function lineClear(a,b,radius=12) {
  const n=Math.ceil(distance(a,b)/7);
  for(let i=0;i<=n;i++) if(!canStand(a.x+(b.x-a.x)*i/(n||1),a.y+(b.y-a.y)*i/(n||1),radius)) return false;
  return true;
}
// Grid routing is shared by wandering and escorting NPCs; it never includes a hidden room.
export function findPath(start,end,radius=12,smoothRoute=true) {
  if(smoothRoute&&lineClear(start,end,radius)) return [{...end}];
  const step=24, cols=Math.ceil(WORLD.width/step),rows=Math.ceil(WORLD.height/step);
  const cell=p=>({x:Math.round(p.x/step),y:Math.round(p.y/step)});
  const key=p=>p.y*cols+p.x;
  const s=cell(start), e=cell(end), queue=[],visited=new Map();
  // A body can stand between grid cells near a corner. Seed only cells it can actually reach.
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const n={x:s.x+dx,y:s.y+dy};if(lineClear(start,{x:n.x*step,y:n.y*step},radius)){queue.push(n);visited.set(key(n),null);}
  }
  queue.sort((a,b)=>distance(start,{x:a.x*step,y:a.y*step})-distance(start,{x:b.x*step,y:b.y*step}));
  let reached=null;
  for(let i=0;i<queue.length;i++) {
    const q=queue[i],point={x:q.x*step,y:q.y*step};
    if(Math.abs(q.x-e.x)<=1&&Math.abs(q.y-e.y)<=1&&lineClear(point,end,radius)){reached=q;break;}
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const n={x:q.x+dx,y:q.y+dy},k=key(n);
      if(n.x<0||n.y<0||n.x>=cols||n.y>=rows||visited.has(k))continue;
      if(!lineClear(point,{x:n.x*step,y:n.y*step},radius))continue;
      visited.set(k,q);queue.push(n);
    }
  }
  if(!reached)return [];
  const path=[{...end}];
  while(reached){path.unshift({x:reached.x*step,y:reached.y*step});reached=visited.get(key(reached));}
  if(!smoothRoute)return path;
  const smooth=[];let anchor=start;
  while(path.length){let last=0;for(let i=1;i<path.length;i++){if(lineClear(anchor,path[i],radius))last=i;else break;}anchor=path[last];smooth.push(anchor);path.splice(0,last+1);}
  return smooth;
}
function direction(body,dx,dy) {
  if(Math.hypot(dx,dy)<0.01)return;
  body.direction=Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up');
}
export class Game {
  constructor(settings={},random=Math.random){this.settings={...SETTINGS,...settings};this.random=random;this.mode='start';this.signals=[];}
  start(){
    this.player={...WORLD.spawn,radius:12,direction:'up',moving:false,step:0,gesture:0,instrument:null,visible:true,happyUntil:0};
    this.npcs=CHARACTERS.filter(n=>n.active).map((n,i)=>({
      roomAllowed:n.roomAllowed!==false,drink:n.drink,drinkAt:8+i,sipUntil:0,sipStarted:0,drinkCount:0,...n.spawn,id:n.id,name:n.name,home:{...n.spawn},atlasKey:n.atlasKey||'original',atlasRow:n.atlasRow,
      radius:12,direction:'down',moving:false,step:0,state:this.settings.staggerArrivals&&!n.alwaysPresent?'dormant':'idle',
      visible:!this.settings.staggerArrivals||!!n.alwaysPresent,path:[],repath:0,wanderAt:10+i*3,wanderIndex:i,
      instrument:null,instrumentIndex:i,instrumentAt:this.settings.firstInstrumentAt+i*2,
      arrivalAt:this.settings.firstArrivalAt+i*this.settings.arrivalInterval,
      cheerful:n.id==='nikita',cheerAt:6+i,cheerUntil:0,approachAfter:0,approachNear:false,danceAt:24,danceUntil:0,socialAfter:0,bubble:null,shoutAt:0,
    }));
    this.guests=BAND_GUESTS.map(n=>({...n,atlasKey:'band',visible:true,state:'seated',bubble:null,approachAfter:0,approachNear:false}));
    this.pair=null;this.minigame=null;this.approachAvailableAt=0;
    this.npc=this.npcs.find(n=>n.id==='loik');
    this.events=[];this.eventSerial=0;this.roomQueue=[];this.roomOccupant=null;this.roomNextAt=0;this.groupSerial=0;
    this.elapsed=0;this.mood=this.settings.initialMood;this.maxMood=this.mood;
    this.stats={repairs:0,people:0,rehearsals:0,secretVisits:0,pencilWins:0};this.dialogue=null;this.repair=null;this.item=null;
    this.nextTechnical=this.settings.firstEventAt;this.nextSocial=this.settings.firstSadAt;this.socialCursor=0;
    this.nextAmbient=this.settings.ambientInterval;this.nextSpeech=12;this.speechCursor=0;this.speechAvailableAt=0;this.lastLines=new Map();
    this.mode='playing';this.paused=false;this.toast=null;this.signals=['start'];
  }
  speakers(){return [...(this.npcs||[]),...(this.guests||[])];}
  person(id){return this.npcs.find(n=>n.id===id);}
  pick(key,id){
    const list=['greeting','short'].includes(key)?(BANTER[key][id]||BANTER.arrival):BANTER[key];
    if(!list?.length)return DIALOGUES[key]||'Всё будет норм.';
    const token=key+'/'+(id||''),last=this.lastLines.get(token);let index=Math.floor(this.random()*list.length);
    if(index===last&&list.length>1)index=(index+1)%list.length;
    this.lastLines.set(token,index);return list[index];
  }
  bubble(npc,text,duration=3.2,priority=false){
    if(this.dialogue||(!priority&&(this.elapsed<this.speechAvailableAt||this.toast?.until>this.elapsed)))return false;
    for(const n of this.speakers())n.bubble=null;
    npc.bubble={text,until:this.elapsed+Math.min(duration,3.2)};this.speechAvailableAt=this.elapsed+16;return true;
  }
  say(speaker,text,after=null){this.dialogue={speaker,text,after};}
  closeDialogue(){const after=this.dialogue?.after;this.dialogue=null;after?.();}
  notice(text){this.toast={text,until:this.elapsed+3};for(const n of this.speakers())n.bubble=null;}
  socialEvent(id){return this.events.find(e=>e.type==='comfort'&&e.npcId===id);}
  canNeedRoom(npc){
    return npc?.roomAllowed&&npc.visible&&['idle','walking','going_to_instrument','playing_instrument','dancing','going_to_table','drinking'].includes(npc.state)
      &&this.elapsed>=npc.socialAfter&&!this.socialEvent(npc.id)&&!this.roomQueue.some(t=>t.npcId===npc.id)&&this.roomOccupant?.npcId!==npc.id;
  }
  spawnEvent(type,npcId=EVENT_TYPES.comfort.npcId){
    if(this.events.length>=this.settings.maxEvents)return false;
    if(type==='microphone'&&this.events.some(e=>e.type===type))return false;
    if(type==='comfort'&&(this.events.filter(e=>e.type===type).length>=2||!this.canNeedRoom(this.person(npcId))))return false;
    const spec=EVENT_TYPES[type],event={id:++this.eventSerial,type,kind:spec.kind,phase:'new',born:this.elapsed,checked:[]};
    if(type==='microphone')event.cause=spec.checks[Math.floor(this.random()*spec.checks.length)];
    else{
      event.npcId=npcId;const npc=this.person(npcId);
      Object.assign(npc,{state:npcId==='samat'?'hysterical':'sad',path:[],moving:false,instrument:null,shoutAt:this.elapsed});
      if(npcId!=='samat')this.bubble(npc,'Альберт, проводишь?');
    }
    this.events.push(event);this.signals.push('problem');return true;
  }
  spawnNextSocial(){
    for(let i=0;i<SOCIAL_ORDER.length;i++){
      const index=(this.socialCursor+i)%SOCIAL_ORDER.length,id=SOCIAL_ORDER[index];
      if(this.spawnEvent('comfort',id)){this.socialCursor=(index+1)%SOCIAL_ORDER.length;return true;}
    }return false;
  }
  targets(){
    const result=[];
    for(const e of this.events){
      if(e.type==='microphone'){
        const ids=e.phase==='new'?['microphone']:EVENT_TYPES.microphone.checks.filter(id=>!e.checked.includes(id));
        for(const id of ids)result.push({...OBJECTS.find(o=>o.id===id),event:e,action:e.phase==='new'?'Проверить микрофон':'Проверить: '+OBJECTS.find(o=>o.id===id).name.toLowerCase()});
      }else if(e.phase==='new'){
        const npc=this.person(e.npcId);result.push({...npc,event:e,action:npc.id==='samat'?'Помочь Самату':'Поговорить · '+npc.name});
      }else if(e.phase==='following')result.push({...OBJECTS.find(o=>o.id==='curtain'),event:e,action:'Проводить очередь за шторку'});
    }return result;
  }
  nearestTarget(){
    if(this.minigame||this.player?.visible===false)return null;
    if(this.pair&&atCurtain(this.player))return {...OBJECTS.find(o=>o.id==='curtain'),action:'Зайти вместе с Анфисой'};
    const escort=this.events.find(e=>e.type==='comfort'&&e.phase==='following');
    if(escort&&atCurtain(this.player))return {...OBJECTS.find(o=>o.id==='curtain'),event:escort,action:'Проводить очередь за шторку'};
    const targets=this.targets().filter(t=>distance(t,this.player)<this.settings.interactionRadius).sort((a,b)=>distance(a,this.player)-distance(b,this.player));
    if(targets.length)return targets[0];
    const nearby=this.speakers().filter(n=>n.visible&&!['arriving','dormant'].includes(n.state)&&distance(n,this.player)<70).sort((a,b)=>distance(a,this.player)-distance(b,this.player))[0];
    if(nearby)return {...nearby,action:nearby.id==='anfisa'?(this.pair?'Анфиса идёт с тобой':'Пригласить Анфису'):nearby.id==='nikita'?'Дать пять Никите':'Поговорить · '+nearby.name};
    const instrument=INSTRUMENTS.find(i=>distance(i,this.player)<65&&!this.npcs.some(n=>n.instrument?.id===i.id)&&lineClear(this.player,i));
    if(instrument)return {...instrument,id:'play-instrument',instrument,action:'Сыграть на '+instrument.name};
    return null;
  }
  beginEscort(event){
    if(event.phase!=='new'||!this.person(event.npcId)?.roomAllowed)return;
    const npc=this.person(event.npcId),companions=this.npcs.filter(n=>n!==npc&&this.canNeedRoom(n)&&n.state!=='dancing').slice(0,this.settings.queueCompanions);
    const groupId=++this.groupSerial;event.phase='following';event.groupId=groupId;this.player.instrument=null;
    [npc,...companions].forEach((n,index)=>{
      Object.assign(n,{state:index?'following_queue':'following_albert',moving:false,instrument:null,path:[],repath:0,groupId,bubble:null});
      this.roomQueue.push({npcId:n.id,eventId:index?null:event.id,groupId,activated:false});
      // Joining the group is visible in the queue; no announcement needed.
    });
    this.signals.push({type:'stop-speech'});
    this.notice('Веди компанию к Тайной комнате слева внизу.');
  }
  interact(){
    if(this.mode!=='playing'||this.paused||this.orientationBlocked)return;
    if(this.dialogue){this.closeDialogue();return;}
    if(this.minigame){this.dropPencil();return;}
    if(this.repair)return;
    if(this.player.instrument){this.player.instrument=null;return;}
    const target=this.nearestTarget();if(!target)return;this.player.gesture=.45;const event=target.event;
    const npc=this.speakers().find(n=>n.id===target.id);
    if(npc){
      if(npc.id==='anfisa'){if(!this.pair)this.say(npc.name,'Пойдём! Посмотрим, кто здесь самый меткий.',()=>this.beginPair());else this.notice('Анфиса с тобой. Веди её к шторке.');return;}
      if(npc.id==='nikita'){npc.cheerUntil=this.elapsed+5;npc.cheerAt=this.elapsed+12;this.player.happyUntil=this.elapsed+4;this.say(npc.name,this.pick('greeting','nikita'));return;}
      if(event?.phase==='new')this.say(npc.name,this.pick(npc.id==='samat'?'samatSad':'sad'),()=>this.beginEscort(event));
      else{
        const category=npc.state==='happy'?'happy':npc.state==='waiting_in_line'?'queue':['following_queue','following_albert'].includes(npc.state)?'follow':npc.state==='playing_instrument'?'playing':npc.state==='dancing'?'dance':'greeting';
        this.say(npc.name,this.pick(category,npc.id));
      }
    }else if(target.id==='curtain'){
      if(this.pair){this.notice(this.roomOccupant?'Сейчас освободится — зайдёте вдвоём.':'Подожди Анфису у шторки.');return;}
      for(const ticket of this.roomQueue)if(ticket.groupId===event.groupId)ticket.activated=true;
      this.notice('Все зайдут по очереди.');
    }else if(target.id==='play-instrument'){
      this.player.instrument=target.instrument;Object.assign(this.player,{x:target.x,y:target.y,direction:target.instrument.direction,moving:false});
    }else if(target.id==='microphone'&&event.phase==='new'){
      this.say('Альберт',this.pick('microphone'),()=>{event.phase='checking';});
    }else if(event?.phase==='checking'){
      this.repair={event,objectId:target.id,elapsed:0,duration:this.settings.repairSeconds};this.player.instrument=null;this.player.direction=target.id==='amplifier'?'right':'up';
    }
  }
  queuePosition(index){return {x:195+Math.min(index,5)*42,y:747+Math.max(0,index-1)*21};}
  enterCurtain(event){
    // Compatibility entry point: enqueue once; the global room controller enforces exclusivity.
    if(event.phase==='new')this.beginEscort(event);
    for(const ticket of this.roomQueue)if(ticket.groupId===event.groupId)ticket.activated=true;
    this.updateRoom();
  }
  rewardVisit(npc){
    this.stats.people++;this.stats.secretVisits++;
    this.mood=clamp(this.mood+EVENT_TYPES.comfort.reward,0,100);this.maxMood=Math.max(this.maxMood,this.mood);
    this.bubble(npc,'Теперь всё отлично!');
    this.signals.push('return');
  }
  solve(event){
    if(!this.events.includes(event))return;
    this.events=this.events.filter(e=>e!==event);
    if(event.kind==='technical'){
      this.stats.repairs++;this.stats.rehearsals++;this.mood=clamp(this.mood+EVENT_TYPES[event.type].reward,0,100);this.maxMood=Math.max(this.maxMood,this.mood);
      this.notice('Микрофон снова работает.');this.nextTechnical=Math.max(this.nextTechnical,this.elapsed+12);this.signals.push('solved');
    }else this.rewardVisit(this.person(event.npcId));
  }
  updateRoom(){
    if(this.roomOccupant&&this.elapsed>=this.roomOccupant.returnAt){
      const ticket=this.roomOccupant,npc=this.person(ticket.npcId);
      Object.assign(npc,{...WORLD.curtain.exit,visible:true,state:'happy',direction:'right',moving:false,path:[],instrument:null,happyUntil:this.elapsed+this.settings.happySeconds,socialAfter:this.elapsed+this.settings.socialCooldown,bubble:null});
      const event=this.events.find(e=>e.id===ticket.eventId);if(event)this.solve(event);else this.rewardVisit(npc);
      this.roomOccupant=null;this.roomNextAt=this.elapsed+.75;
    }
    if(this.roomOccupant||this.elapsed<this.roomNextAt)return;
    if(this.pair&&atCurtain(this.player))return;
    const ticket=this.roomQueue[0];if(!ticket?.activated)return;
    const npc=this.person(ticket.npcId);if(distance(npc,WORLD.curtain)>60)return;
    if(npc.id==='erbak'){
      this.roomQueue.shift();this.events=this.events.filter(e=>e.id!==ticket.eventId);
      Object.assign(npc,{state:'leaving_queue',path:[],instrument:null,moving:false,direction:'right',socialAfter:this.elapsed+this.settings.socialCooldown});
      this.bubble(npc,this.pick('ascetic'),3.2,true);this.roomNextAt=this.elapsed+.75;return;
    }
    this.roomQueue.shift();this.roomOccupant={...ticket,enteredAt:this.elapsed,returnAt:this.elapsed+this.settings.secretSeconds};
    Object.assign(npc,{state:'waiting',visible:false,moving:false,path:[],instrument:null,bubble:null});
    const event=this.events.find(e=>e.id===ticket.eventId);if(event){event.phase='waiting';event.returnAt=this.roomOccupant.returnAt;}
  }
  beginPair(){
    const npc=this.person('anfisa');if(this.pair||!npc?.visible)return;
    this.pair={phase:'following'};this.player.instrument=null;
    Object.assign(npc,{state:'following_pair',instrument:null,path:[],repath:0,moving:false,bubble:null});
    this.notice('Анфиса идёт за тобой. Шторка — слева внизу.');
  }
  updatePair(dt=0){
    if(!this.pair||this.minigame)return;
    const npc=this.person('anfisa');
    if(atCurtain(this.player)&&distance(npc,WORLD.curtain)<50&&!this.roomOccupant){
      // Finish the short approach visibly before both bodies disappear at the fabric.
      if(distance(this.player,WORLD.curtain)>=38){
        const next=findPath(this.player,WORLD.curtain)[0];
        if(next&&dt>0){const d=distance(this.player,next),step=Math.min(d,this.settings.walkSpeed*dt);if(d){const dx=(next.x-this.player.x)/d*step,dy=(next.y-this.player.y)/d*step;moveBody(this.player,dx,dy);direction(this.player,dx,dy);this.player.moving=true;this.player.step+=dt*11;}}
        return;
      }
      this.pair.phase='inside';this.minigame=createPencilGame();this.player.visible=false;this.player.moving=false;
      Object.assign(npc,{visible:false,moving:false,path:[],bubble:null});
      for(const n of this.speakers())n.bubble=null;
    }
  }
  dropPencil(){if(this.mode==='playing'&&!this.paused&&!this.orientationBlocked&&this.minigame)dropPencil(this.minigame);}
  leavePair(won=false){
    if(!this.pair)return;
    const npc=this.person('anfisa');
    Object.assign(this.player,{...WORLD.curtain.exit,visible:true,direction:'right',moving:false,happyUntil:this.elapsed+10});
    Object.assign(npc,{x:270,y:710,visible:true,state:'happy',direction:'right',path:[],instrument:null,happyUntil:this.elapsed+10,dizzyUntil:this.elapsed+6});
    this.pair=null;this.minigame=null;this.roomNextAt=this.elapsed+.75;
    if(won){this.stats.pencilWins++;this.stats.people++;this.stats.secretVisits++;this.mood=clamp(this.mood+14,0,100);this.maxMood=Math.max(this.maxMood,this.mood);this.signals.push('return');}
    this.notice(won?'Три попадания! Альберт и Анфиса возвращаются довольные.':'Хорошо поиграли! Можно попробовать ещё раз.');
  }
  updateApproach(){
    const nearby=this.speakers().filter(n=>n.visible&&!['arriving','dormant','hysterical','following_pair'].includes(n.state));
    for(const n of nearby)if(distance(n,this.player)>135)n.approachNear=false;
    if(this.elapsed<this.approachAvailableAt||this.speakers().some(n=>n.bubble?.until>this.elapsed))return;
    const npc=nearby.filter(n=>!n.approachNear&&this.elapsed>=n.approachAfter&&distance(n,this.player)<105&&lineClear(this.player,{x:n.x,y:n.atlasKey==='band'?300:n.y})).sort((a,b)=>distance(a,this.player)-distance(b,this.player))[0];
    if(!npc)return;
    if(this.bubble(npc,this.pick('short',npc.id),3.2,true)){
      npc.approachNear=true;npc.approachAfter=this.elapsed+20;this.approachAvailableAt=this.elapsed+4;
      if(npc.id==='nikita')npc.cheerUntil=this.elapsed+4;
    }
  }
  togglePause(){if(this.mode==='playing')this.paused=!this.paused;}
  finish(){if(this.pair)this.leavePair(false);this.mode='finished';this.dialogue=null;this.repair=null;this.player.moving=false;for(const npc of this.npcs)npc.moving=false;}
  update(dt,input={x:0,y:0,run:false}){
    if(this.mode!=='playing'||this.paused||this.orientationBlocked||this.dialogue)return;
    dt=Math.min(dt,.05);
    if(this.minigame){updatePencilGame(this.minigame,dt,input.x||0);if(this.minigame.complete)this.leavePair(true);return;}
    this.elapsed+=dt;
    if(this.elapsed>=this.settings.sessionSeconds){this.elapsed=this.settings.sessionSeconds;this.finish();return;}
    if(this.elapsed>=this.nextTechnical){this.spawnEvent('microphone');this.nextTechnical=this.elapsed+Math.max(this.settings.minimumInterval,this.settings.eventInterval-this.elapsed/25);}
    if(this.elapsed>=this.nextSocial){this.spawnNextSocial();this.nextSocial=this.elapsed+this.settings.socialInterval;}
    const unresolved=this.events.filter(e=>['new','checking'].includes(e.phase)).length;
    this.mood=clamp(this.mood-unresolved*this.settings.decayPerProblem*dt,0,100);
    if(!unresolved)this.mood=clamp(this.mood+.035*dt,0,100);
    this.maxMood=Math.max(this.maxMood,this.mood);this.player.gesture=Math.max(0,this.player.gesture-dt);
    if(this.repair){
      this.player.moving=false;this.repair.elapsed+=dt;
      if(this.repair.elapsed>=this.repair.duration){const {event,objectId}=this.repair;this.repair=null;event.checked.push(objectId);if(objectId===event.cause)this.solve(event);else this.notice('Контакт исправен. Проверь дальше.');}
    }else{
      let dx=input.x||0,dy=input.y||0;const length=Math.hypot(dx,dy)||1;
      if(dx||dy)this.player.instrument=null;
      const speed=this.settings.walkSpeed*(input.run?this.settings.runMultiplier:1);
      dx=dx/Math.max(length,1)*speed*dt;dy=dy/Math.max(length,1)*speed*dt;
      const before={x:this.player.x,y:this.player.y};moveBody(this.player,dx,dy);
      this.player.moving=distance(before,this.player)>.01;direction(this.player,dx,dy);if(this.player.moving)this.player.step+=dt*(input.run?15:11);
    }
    if(atCurtain(this.player))for(const ticket of this.roomQueue)ticket.activated=true;
    for(const npc of this.npcs)this.updateNpc(dt,npc);
    this.updateRoom();this.updatePair(dt);
    if(this.minigame)return;
    this.updateApproach();
    for(const npc of this.npcs){
      if(!npc.visible||!['idle','walking','going_to_instrument','arriving'].includes(npc.state))continue;
      for(const other of this.npcs){const d=distance(npc,other);if(other!==npc&&other.visible&&d>0&&d<35)moveBody(npc,(npc.x-other.x)/d*dt*24,(npc.y-other.y)/d*dt*24);}
    }
    if(this.elapsed>=this.nextSpeech){
      this.nextSpeech=this.elapsed+16;
      const available=this.npcs.filter(n=>n.visible&&!['hysterical','sad','waiting_in_line'].includes(n.state));
      if(available.length){const n=available[this.speechCursor++%available.length];this.bubble(n,this.pick('short',n.id));}
    }
    if(this.elapsed>=this.nextAmbient){
      this.nextAmbient=this.elapsed+this.settings.ambientInterval;
      // Ambient jokes are spoken occasionally by characters, never as pop-ups.
    }
  }
  updateNpc(dt,npc=this.npc){
    if(npc.state==='dormant'){
      if(this.elapsed<npc.arrivalAt)return;
      // Do not materialize on top of someone still standing in the entrance.
      if(this.npcs.some(n=>n!==npc&&n.visible&&distance(n,{x:1100,y:950})<38))return;
      Object.assign(npc,{x:1100,y:950,visible:true,state:'arriving',direction:'up',path:[],repath:0});
      // Friends enter naturally without covering the room with arrival messages.
    }
    if(!npc.visible)return;
    if(npc.cheerful&&this.elapsed>=npc.cheerAt){npc.cheerUntil=this.elapsed+3.5;npc.cheerAt=this.elapsed+13;}
    if(npc.state==='hysterical'){
      npc.moving=false;
      if(this.elapsed>=npc.shoutAt){const line='Мне нужно в реанимационную!';if(this.bubble(npc,line))this.signals.push({type:'shout',text:line.toUpperCase()});npc.shoutAt=this.elapsed+16;}
      return;
    }
    if(npc.state==='sad'){npc.moving=false;return;}
    if(npc.state==='happy'){
      if(this.elapsed>=npc.happyUntil){npc.state='idle';npc.wanderAt=this.elapsed;npc.instrumentAt=this.elapsed+3;}
    }
    const ticket=this.roomQueue.find(t=>t.npcId===npc.id);
    let target=null,speed=85;
    if(npc.state==='following_pair'){
      target=atCurtain(this.player)?WORLD.curtain:this.player;speed=this.settings.followerSpeed;
      if(distance(npc,target)<(atCurtain(this.player)?12:52)){npc.moving=false;npc.path=[];return;}
    }else if(ticket){
      const index=this.roomQueue.indexOf(ticket);speed=this.settings.followerSpeed;
      if(ticket.activated){
        target=this.queuePosition(index);npc.state='waiting_in_line';
        const event=this.events.find(e=>e.id===ticket.eventId);if(event)event.phase='queued';
        if(distance(npc,target)<9){npc.moving=false;npc.direction='left';if(!npc.bubble||this.elapsed>npc.bubble.until+7)this.bubble(npc,'Я за вами.');return;}
      }else{
        npc.state=ticket.eventId?'following_albert':'following_queue';
        const ahead=this.roomQueue.slice(0,index).reverse().find(t=>t.groupId===ticket.groupId);
        target=ahead?this.person(ahead.npcId):this.player;
        if(distance(npc,target)<53){npc.moving=false;npc.path=[];return;}
      }
    }else if(npc.state==='leaving_queue'){
      target=npc.home;speed=125;
      if(distance(npc,target)<12){npc.state='idle';npc.moving=false;npc.wanderAt=this.elapsed+5;npc.instrumentAt=this.elapsed+3;return;}
    }else if(npc.state==='happy'){
      target=npc.home;speed=125;if(distance(npc,target)<12){npc.moving=false;return;}
    }else if(npc.state==='arriving'){
      target=npc.home;speed=140;
      if(distance(npc,target)<10){npc.state='idle';npc.moving=false;npc.wanderAt=this.elapsed+4;npc.instrumentAt=this.elapsed+this.settings.firstInstrumentAt;npc.danceAt=this.elapsed+6;return;}
    }else if(npc.drink==='table'&&['idle','walking','going_to_table','drinking'].includes(npc.state)&&this.elapsed>=npc.drinkAt){
      target={x:460,y:320};speed=110;npc.instrument=null;
      if(npc.state==='drinking'){
        npc.moving=false;if(this.elapsed<npc.sipUntil)return;
        npc.drinkCount++;npc.state='idle';npc.drinkAt=this.elapsed+12;npc.wanderAt=this.elapsed;return;
      }
      npc.state='going_to_table';
      if(distance(npc,target)<8){npc.state='drinking';npc.direction='left';npc.moving=false;npc.sipStarted=this.elapsed;npc.sipUntil=this.elapsed+3.5;this.bubble(npc,'За хороший вечер!',3.5);return;}
    }else{
      if(npc.drink==='whisky'&&['idle','walking','drinking'].includes(npc.state)&&this.elapsed>=npc.drinkAt){
        if(npc.state!=='drinking'){npc.state='drinking';npc.sipStarted=this.elapsed;npc.sipUntil=this.elapsed+3;npc.path=[];}
        npc.moving=false;if(this.elapsed<npc.sipUntil)return;
        npc.drinkCount++;npc.state='idle';npc.drinkAt=this.elapsed+9;npc.wanderAt=this.elapsed;
      }
      if(npc.state==='dancing'){
        npc.moving=false;if(this.elapsed<npc.danceUntil)return;
        npc.state='idle';npc.danceAt=this.elapsed+this.settings.danceInterval;npc.instrumentAt=this.elapsed+4;
      }
      if(npc.id==='tema'&&this.elapsed>=npc.danceAt&&['idle','walking','playing_instrument','going_to_instrument'].includes(npc.state)){
        if(distance(npc,{x:1080,y:480})>12){npc.state='going_to_dance';npc.instrument=null;target={x:1080,y:480};}
        else{npc.state='dancing';npc.danceStarted=this.elapsed;npc.danceUntil=this.elapsed+this.settings.danceSeconds;npc.instrument=null;this.bubble(npc,'Ловите вращение!');return;}
      }
      if(npc.state==='going_to_dance'){
        target={x:1080,y:480};speed=125;
        if(distance(npc,target)<12){npc.state='dancing';npc.danceStarted=this.elapsed;npc.danceUntil=this.elapsed+this.settings.danceSeconds;npc.moving=false;this.bubble(npc,'Ловите вращение!');return;}
      }else{
        if(npc.state==='playing_instrument'){
          npc.moving=false;if(this.elapsed<npc.playUntil)return;
          npc.state='idle';npc.instrument=null;npc.instrumentAt=this.elapsed+this.settings.instrumentBreak;npc.wanderAt=this.elapsed+1;
        }
        if(npc.id!=='anfisa'&&!npc.drink&&['idle','walking'].includes(npc.state)&&this.elapsed>=npc.instrumentAt){
          const available=INSTRUMENTS.filter(i=>i.id!==this.player.instrument?.id&&!this.npcs.some(n=>n!==npc&&n.instrument?.id===i.id));
          if(available.length){npc.instrument=available[npc.instrumentIndex++%available.length];npc.state='going_to_instrument';npc.path=[];npc.repath=0;}
          else npc.instrumentAt=this.elapsed+3;
        }
        if(npc.state==='going_to_instrument'){
          target=npc.instrument;speed=115;
          if(distance(npc,target)<7){Object.assign(npc,{x:target.x,y:target.y,direction:target.direction,state:'playing_instrument',moving:false,path:[],playUntil:this.elapsed+this.settings.instrumentSeconds});return;}
        }else if(['idle','walking'].includes(npc.state)&&this.elapsed>=npc.wanderAt){
          npc.state='walking';const character=CHARACTERS.find(n=>n.id===npc.id),spots=character.wander||[character.spawn,{x:850,y:460},{x:990,y:700},{x:380,y:490},{x:1150,y:390}];target=spots[npc.wanderIndex%spots.length];
          if(distance(npc,target)<12){npc.wanderIndex++;npc.wanderAt=this.elapsed+8;npc.state='idle';npc.path=[];target=null;}
        }
      }
    }
    npc.moving=false;if(!target)return;npc.repath-=dt;
    if(!npc.path.length||(npc.repath<=0&&(!npc.routeTarget||distance(npc.routeTarget,target)>20))){npc.path=findPath(npc,target,npc.radius);npc.routeTarget={x:target.x,y:target.y};npc.repath=.35;}
    while(npc.path.length&&distance(npc,npc.path[0])<3)npc.path.shift();
    const next=npc.path[0];if(!next)return;
    const d=distance(npc,next),step=Math.min(speed*dt,d),dx=(next.x-npc.x)/d*step,dy=(next.y-npc.y)/d*step;
    const before={x:npc.x,y:npc.y};moveBody(npc,dx,dy);npc.moving=distance(before,npc)>.01;direction(npc,dx,dy);if(npc.moving)npc.step+=dt*10;
  }
  taskText(){
    if(this.pair)return this.roomOccupant&&atCurtain(this.player)?'Подождите у шторки — скоро освободится.':'Анфиса с тобой · веди её к шторке слева внизу';
    if(this.repair)return 'Проверяю контакт…';
    const social=this.events.find(e=>e.type==='comfort'&&e.phase==='following');
    if(social)return 'Тайная комната — слева внизу. Веди компанию к шторке';
    if(this.player.instrument)return 'Играешь на '+this.player.instrument.name+' · E или движение — закончить';
    const technical=this.events.find(e=>e.type==='microphone');
    if(technical?.phase==='checking')return 'Найди причину: кабель, усилитель или пульт';
    const urgent=this.events.find(e=>e.type==='comfort'&&e.phase==='new'&&e.npcId==='samat');
    if(urgent)return 'Самату срочно в «реанимационную» · подойди и нажми E';
    if(technical)return 'Микрофон молчит · подойди к значку !';
    const pending=this.events.find(e=>e.type==='comfort'&&e.phase==='new');
    if(pending)return this.person(pending.npcId).name+' просит в Тайную комнату · E';
    if(this.roomOccupant||this.roomQueue.length)return 'Очередь движется сама. Можно заняться студией.';
    return 'Всё работает. Присматривай за студией.';
  }
}
