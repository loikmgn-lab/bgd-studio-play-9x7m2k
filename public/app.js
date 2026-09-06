import {Game} from './core.js';
import {SETTINGS} from './content.js';
import {Renderer,loadImage,keyedAtlas,drawFrame} from './renderer.js';
import {Sound} from './audio.js';
const $=id=>document.getElementById(id),game=new Game(),sound=new Sound(),keys=new Set();
let renderer,atlas,last=0,lastUi=0,shownMode='',dialogueRef=null,stick={x:0,y:0};
const formatTime=s=>`${Math.floor(s/60).toString().padStart(2,'0')}:${Math.ceil(s%60).toString().padStart(2,'0')}`;
document.title=`BGD — ${SETTINGS.title}`;
$('game-title').replaceChildren(document.createTextNode(SETTINGS.titleLines[0]),document.createElement('br'),Object.assign(document.createElement('em'),{textContent:SETTINGS.titleLines[1]}));
document.querySelector('.start-footnote').firstChild.textContent=`ПЕРВАЯ СМЕНА · ${Math.round(SETTINGS.sessionSeconds/60)} МИН. `;
function start(){if(!renderer)return;keys.clear();stick={x:0,y:0};game.start();updateUI();$('world').focus();}
$('start').onclick=start;$('restart').onclick=start;
$('pause').onclick=()=>{game.togglePause();keys.clear();updateUI();};$('resume').onclick=()=>{game.paused=false;updateUI();};
$('dialogue-next').onclick=()=>{game.interact();updateUI();};$('touch-e').onclick=()=>{game.interact();updateUI();};
$('sound').onclick=async()=>{try{const on=await sound.toggle();$('sound-label').textContent=on?'вкл':'выкл';$('sound').setAttribute('aria-pressed',String(on));$('sound').setAttribute('aria-label',on?'Выключить звук':'Включить звук');}catch{sound.enabled=false;$('sound-label').textContent='выкл';}};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('shell').requestFullscreen();}catch{game.notice?.('Полноэкранный режим недоступен в этом браузере.');}};
window.addEventListener('keydown',e=>{
  if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyE','Space','Escape'].includes(e.code))e.preventDefault();
  if(e.repeat)return;
  keys.add(e.code);
  if(e.code==='KeyE')game.interact();
  if(e.code==='Escape'){game.togglePause();keys.clear();updateUI();}
  if((e.code==='Enter'||e.code==='Space')&&game.mode==='start')start();
});
window.addEventListener('keyup',e=>keys.delete(e.code));
function suspend(){keys.clear();stick={x:0,y:0};$('stick').style.transform='';if(game.mode==='playing'){game.paused=true;updateUI();}}
window.addEventListener('blur',suspend);document.addEventListener('visibilitychange',()=>{if(document.hidden)suspend();});
const joy=$('joystick');let pointer=null;
function drag(e){const r=joy.getBoundingClientRect(),dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2,length=Math.max(34,Math.hypot(dx,dy));stick={x:dx/length,y:dy/length};$('stick').style.transform=`translate(${stick.x*28}px,${stick.y*28}px)`;}
joy.addEventListener('pointerdown',e=>{pointer=e.pointerId;joy.setPointerCapture(pointer);drag(e);});
joy.addEventListener('pointermove',e=>{if(e.pointerId===pointer)drag(e);});
for(const name of ['pointerup','pointercancel','lostpointercapture'])joy.addEventListener(name,()=>{pointer=null;stick={x:0,y:0};$('stick').style.transform='';});
function portrait(canvas,row,headOnly=false){const c=canvas.getContext('2d');c.clearRect(0,0,canvas.width,canvas.height);if(headOnly){const sy=row?501:7;c.drawImage(atlas,143,sy,138,156,0,0,canvas.width,canvas.height);}else drawFrame(c,atlas,row,'down',192,507,494);}
function updateUI(){
  if(shownMode!==game.mode){shownMode=game.mode;$('start-screen').hidden=game.mode!=='start';$('end-screen').hidden=game.mode!=='finished';$('hud').hidden=game.mode!=='playing';$('pause').hidden=game.mode!=='playing';$('touch-controls').hidden=game.mode!=='playing';
    if(game.mode==='finished'){
      $('rank').textContent=game.stats.repairs+game.stats.people>0?'Альберт всё разрулил':'Первая смена — знакомство с BGD';
      const rows=[['Устранено неполадок',game.stats.repairs],['Помогли людям',game.stats.people],['Спасено репетиций',game.stats.rehearsals],['Отведено за шторку',game.stats.secretVisits],['Максимальная обстановка BGD',Math.round(game.maxMood)+'%']];
      $('stats').replaceChildren(...rows.map(([name,value])=>{const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=name;dd.textContent=value;row.append(dt,dd);return row;}));
    }
  }
  $('pause-screen').hidden=!game.paused||game.mode!=='playing';
  $('dialogue').hidden=!game.dialogue||game.paused||game.mode!=='playing';
  if(game.dialogue&&game.dialogue!==dialogueRef){dialogueRef=game.dialogue;$('speaker').textContent=game.dialogue.speaker;$('line').textContent=game.dialogue.text;portrait($('dialogue-portrait'),game.dialogue.speaker==='Альберт'?0:1,true);}
  if(game.mode!=='playing')return;
  const mood=Math.round(game.mood);$('mood-number').replaceChildren(document.createTextNode(mood),Object.assign(document.createElement('span'),{textContent:'%'}));$('mood-fill').style.width=mood+'%';$('mood-fill').style.background=mood<30?'#dc8f76':mood<60?'#d9af73':'#efb764';
  $('time').textContent=formatTime(Math.max(0,Math.ceil(game.settings.sessionSeconds-game.elapsed)));
  $('task').textContent=game.taskText();$('event-count').textContent=game.events.length>1?`${game.events.length} дела`:'';
  const showToast=game.toast&&game.elapsed<game.toast.until&&!game.dialogue;$('toast').hidden=!showToast;if(showToast)$('toast').textContent=game.toast.text;
  const target=game.nearestTarget();$('interaction').hidden=!target||!!game.dialogue||game.paused||!!game.repair;
  if(target){$('interaction').querySelector('span').textContent=target.action;const at=renderer.screen({x:game.player.x,y:game.player.y-147});$('interaction').style.left=Math.max(110,Math.min(renderer.width-110,at.x))+'px';$('interaction').style.top=Math.max(115,at.y)+'px';}
  $('repair-progress').hidden=!game.repair;if(game.repair)$('repair-progress').querySelector('.meter>div').style.width=Math.round(game.repair.elapsed/game.repair.duration*100)+'%';
  $('touch-controls').hidden=game.paused||!!game.dialogue;
}
function frame(t){const dt=last?Math.min((t-last)/1000,.05):0;last=t;
  const input={x:(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+stick.x,y:(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0)+stick.y,run:keys.has('ShiftLeft')||keys.has('ShiftRight')};
  game.update(dt,input);renderer.render(game,t/1000);while(game.signals.length)sound.play(game.signals.shift());
  if(t-lastUi>70){updateUI();lastUi=t;}requestAnimationFrame(frame);
}
try {
  const [background,characters]=await Promise.all([loadImage('./assets/studio.png'),loadImage('./assets/characters-key.png')]);
  atlas=keyedAtlas(characters);renderer=new Renderer($('world'),background,atlas);new ResizeObserver(()=>renderer.resize()).observe($('stage'));renderer.resize();portrait($('portrait'),0);
  $('start').disabled=false;$('start').querySelector('span').textContent='НАЧАТЬ СМЕНУ';requestAnimationFrame(frame);
  // Opt-in diagnostics only. Normal players cannot accidentally teleport or shorten a shift.
  if(new URLSearchParams(location.search).get('debug')==='1')window.__bgd={game,renderer,updateUI};
}catch(error){$('load-error').hidden=false;$('load-error').textContent='Не удалось загрузить рисунки. Обнови страницу, чтобы попробовать ещё раз.';console.error(error);}
