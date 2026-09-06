import {SETTINGS, WORLD, CHARACTERS, OBJECTS, DIALOGUES, EVENT_TYPES} from './content.js';
export const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
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
  constructor(settings={},random=Math.random) { this.settings={...SETTINGS,...settings};this.random=random;this.mode='start';this.signals=[]; }
  start() {
    const loik=CHARACTERS.find(n=>n.id==='loik');
    this.player={...WORLD.spawn,radius:12,direction:'up',moving:false,step:0,gesture:0};
    this.npc={...loik.spawn,id:loik.id,name:loik.name,radius:12,direction:'down',moving:false,step:0,state:'idle',visible:true,path:[],repath:0,wanderAt:10,wanderIndex:0};
    this.events=[];this.elapsed=0;this.mood=this.settings.initialMood;this.maxMood=this.mood;
    this.stats={repairs:0,people:0,rehearsals:0,secretVisits:0};this.dialogue=null;this.repair=null;this.item=null;
    this.nextTechnical=this.settings.firstEventAt;this.nextSocial=this.settings.firstSadAt;
    this.mode='playing';this.paused=false;this.toast={text:'Ты — Альберт. Осмотрись: первая проблема появится скоро.',until:6};this.signals=['start'];
  }
  say(speaker,text,after=null) { this.dialogue={speaker,text,after}; }
  closeDialogue() { const after=this.dialogue?.after;this.dialogue=null;after?.(); }
  notice(text) { this.toast={text,until:this.elapsed+4}; }
  spawnEvent(type) {
    if(this.events.length>=this.settings.maxEvents||this.events.some(e=>e.type===type))return false;
    if(type==='comfort'&&!['idle','walking'].includes(this.npc.state))return false;
    const spec=EVENT_TYPES[type];
    const event={type,kind:spec.kind,phase:'new',born:this.elapsed,checked:[]};
    if(type==='microphone')event.cause=spec.checks[Math.floor(this.random()*spec.checks.length)];
    else {this.npc.state='sad';this.npc.path=[];this.npc.moving=false;}
    this.events.push(event);this.signals.push('problem');return true;
  }
  targets() {
    const result=[];
    for(const e of this.events) {
      if(e.type==='microphone') {
        const ids=e.phase==='new'?['microphone']:EVENT_TYPES.microphone.checks.filter(id=>!e.checked.includes(id));
        for(const id of ids)result.push({...OBJECTS.find(o=>o.id===id),event:e,action:e.phase==='new'?'Проверить микрофон':'Проверить: '+OBJECTS.find(o=>o.id===id).name.toLowerCase()});
      } else if(e.phase==='new') result.push({id:'loik',...this.npc,event:e,action:'Поговорить с Лоиком'});
      else if(e.phase==='following')result.push({...OBJECTS.find(o=>o.id==='curtain'),event:e,action:distance(this.npc,WORLD.curtain)<125?'Проводить к шторке':'Подождать Лоика у шторки'});
    }
    return result;
  }
  nearestTarget() {
    const targets=this.targets().filter(t=>distance(t,this.player)<this.settings.interactionRadius);
    targets.sort((a,b)=>distance(a,this.player)-distance(b,this.player));
    if(targets.length)return targets[0];
    if(this.npc.visible&&distance(this.npc,this.player)<70)return {id:'loik',...this.npc,action:'Поговорить с Лоиком'};
    return null;
  }
  interact() {
    if(this.mode!=='playing'||this.paused)return;
    if(this.dialogue){this.closeDialogue();return;}
    if(this.repair)return;
    const t=this.nearestTarget();if(!t)return;
    this.player.gesture=0.45;
    const event=t.event;
    if(t.id==='loik') {
      if(event?.phase==='new')this.say('Лоик',DIALOGUES.sad,()=>{event.phase='following';this.npc.state='following_albert';this.npc.repath=0;this.notice('Доведи Лоика до шторки слева внизу и нажми E.');});
      else this.say('Лоик',this.npc.state==='happy'?DIALOGUES.happy:this.npc.state==='following_albert'?DIALOGUES.follow:DIALOGUES.greeting);
    } else if(t.id==='curtain') {
      if(distance(this.npc,WORLD.curtain)>125){this.notice('Лоик ещё подходит. Подожди рядом со шторкой.');return;}
      event.phase='waiting';this.npc.state='waiting';this.npc.visible=false;this.npc.moving=false;this.npc.path=[];
      event.returnAt=this.elapsed+this.settings.secretSeconds;this.notice('Скоро вернётся. Пока можно заняться аппаратурой.');
    } else if(t.id==='microphone'&&event.phase==='new') {
      this.say('Альберт',DIALOGUES.microphone,()=>{event.phase='checking';});
    } else if(event?.phase==='checking') {
      this.repair={event,objectId:t.id,elapsed:0,duration:this.settings.repairSeconds};
      this.player.direction=t.id==='amplifier'?'right':'up';
    }
  }
  solve(event) {
    this.events=this.events.filter(e=>e!==event);
    this.mood=clamp(this.mood+EVENT_TYPES[event.type].reward,0,100);this.maxMood=Math.max(this.maxMood,this.mood);
    if(event.kind==='technical'){this.stats.repairs++;this.stats.rehearsals++;this.notice(DIALOGUES.fixed);this.nextTechnical=Math.max(this.nextTechnical,this.elapsed+12);}
    else{this.stats.people++;this.stats.secretVisits++;this.notice('Лоик: «'+DIALOGUES.happy+'»');this.nextSocial=this.elapsed+36;}
    this.signals.push(event.kind==='technical'?'solved':'return');
  }
  togglePause() {if(this.mode==='playing')this.paused=!this.paused;}
  finish() {this.mode='finished';this.dialogue=null;this.repair=null;this.player.moving=false;this.npc.moving=false;}
  update(dt,input={x:0,y:0,run:false}) {
    if(this.mode!=='playing'||this.paused||this.dialogue)return;
    dt=Math.min(dt,0.05);this.elapsed+=dt;
    if(this.elapsed>=this.settings.sessionSeconds){this.elapsed=this.settings.sessionSeconds;this.finish();return;}
    if(this.elapsed>=this.nextTechnical){this.spawnEvent('microphone');this.nextTechnical=this.elapsed+Math.max(this.settings.minimumInterval,this.settings.eventInterval-this.elapsed/25);}
    if(this.elapsed>=this.nextSocial){this.spawnEvent('comfort');this.nextSocial=this.elapsed+20;}
    const unresolved=this.events.filter(e=>e.phase!=='waiting').length;
    this.mood=clamp(this.mood-unresolved*this.settings.decayPerProblem*dt,0,100);
    if(!unresolved)this.mood=clamp(this.mood+0.035*dt,0,100);
    this.maxMood=Math.max(this.maxMood,this.mood);
    this.player.gesture=Math.max(0,this.player.gesture-dt);
    if(this.repair) {
      this.player.moving=false;this.repair.elapsed+=dt;
      if(this.repair.elapsed>=this.repair.duration) {
        const {event,objectId}=this.repair;this.repair=null;event.checked.push(objectId);
        if(objectId===event.cause)this.solve(event);else this.notice(DIALOGUES.notHere);
      }
    } else {
      let dx=input.x||0,dy=input.y||0;const length=Math.hypot(dx,dy)||1;
      const speed=this.settings.walkSpeed*(input.run?this.settings.runMultiplier:1);
      dx=dx/Math.max(length,1)*speed*dt;dy=dy/Math.max(length,1)*speed*dt;
      const before={x:this.player.x,y:this.player.y};moveBody(this.player,dx,dy);
      this.player.moving=distance(before,this.player)>0.01;
      direction(this.player,dx,dy);if(this.player.moving)this.player.step+=dt*(input.run?15:11);
    }
    this.updateNpc(dt);
  }
  updateNpc(dt) {
    const npc=this.npc,event=this.events.find(e=>e.type==='comfort');
    if(event?.phase==='waiting'&&this.elapsed>=event.returnAt) {
      npc.visible=true;Object.assign(npc,WORLD.curtain.exit);npc.direction='right';npc.state='happy';npc.happyUntil=this.elapsed+this.settings.happySeconds;this.solve(event);
    }
    if(!npc.visible)return;
    if(npc.state==='happy'&&this.elapsed>=npc.happyUntil){npc.state='idle';npc.wanderAt=this.elapsed+4;}
    let target=null,speed=72;
    if(npc.state==='following_albert') {
      const d=distance(npc,this.player);speed=this.settings.followerSpeed;
      if(d>53)target=this.player;else{npc.path=[];npc.moving=false;return;}
    } else if(['idle','walking'].includes(npc.state)&&this.elapsed>=npc.wanderAt) {
      npc.state='walking';const spots=CHARACTERS.find(n=>n.id===npc.id).wander;target=spots[npc.wanderIndex%spots.length];
      if(distance(npc,target)<12){npc.wanderIndex++;npc.wanderAt=this.elapsed+8;npc.state='idle';npc.path=[];target=null;}
    }
    npc.moving=false;
    if(!target)return;
    npc.repath-=dt;
    if(npc.repath<=0||!npc.path.length){npc.path=findPath(npc,target,npc.radius);npc.repath=0.35;}
    while(npc.path.length&&distance(npc,npc.path[0])<3)npc.path.shift();
    const next=npc.path[0];if(!next)return;
    const d=distance(npc,next),step=Math.min(speed*dt,d),dx=(next.x-npc.x)/d*step,dy=(next.y-npc.y)/d*step;
    const before={x:npc.x,y:npc.y};moveBody(npc,dx,dy);npc.moving=distance(before,npc)>0.01;
    direction(npc,dx,dy);if(npc.moving)npc.step+=dt*10;
  }
  taskText() {
    if(this.repair)return 'Проверяю контакт…';
    const social=this.events.find(e=>e.type==='comfort');
    if(social?.phase==='following')return 'Доведи Лоика до шторки слева внизу · E у входа';
    const technical=this.events.find(e=>e.type==='microphone');
    if(technical?.phase==='checking')return 'Найди причину: кабель, усилитель или пульт';
    if(technical)return 'Микрофон молчит · подойди к значку !';
    if(social?.phase==='new')return 'Лоик загрустил · подойди и нажми E';
    if(social?.phase==='waiting')return 'Лоик скоро вернётся. Можно немного выдохнуть.';
    return 'Всё работает. Присматривай за студией.';
  }
}
