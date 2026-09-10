// Public access is paused until the owner explicitly reopens the game.
if(!['127.0.0.1','localhost','[::1]'].includes(location.hostname)){location.replace('./');await new Promise(()=>{});}
import {drawPencilGame} from './minigame.js?v=0.8.1';
import {floatingJoystick} from './controls.js?v=0.8.1';
import {Game} from './core.js?v=0.8.1';
import {SETTINGS,CHARACTERS} from './content.js?v=0.8.1';
import {Renderer,loadImage,keyedAtlas,drawFrame} from './renderer.js?v=0.8.1';
import {Sound} from './audio.js?v=0.8.1';
const $=id=>document.getElementById(id),game=new Game(),sound=new Sound(),keys=new Set();
let joystickController,miniAxis=0,miniActive=false;
let renderer,atlas,last=0,lastUi=0,shownMode='',dialogueRef=null,stick={x:0,y:0};
$('shell').append($('rotate-screen'));
let wasFullscreen=false;
const taskStrip=document.querySelector('.task-strip');taskStrip.append($('interaction'));
const touchDevice=matchMedia('(any-pointer:coarse)'),portraitDevice=matchMedia('(orientation:portrait)');
function updateOrientation(){
  const blocked=touchDevice.matches&&portraitDevice.matches&&innerWidth<=1024;
  game.orientationBlocked=blocked;$('rotate-screen').hidden=!blocked;
  $('shell').inert=blocked;joystickController?.reset();keys.clear();stick={x:0,y:0};$('stick').style.transform='';
  if(blocked)sound.stopSpeech();
}
window.addEventListener('resize',updateOrientation);touchDevice.addEventListener('change',updateOrientation);portraitDevice.addEventListener('change',updateOrientation);updateOrientation();
const formatTime=s=>`${Math.floor(s/60).toString().padStart(2,'0')}:${Math.ceil(s%60).toString().padStart(2,'0')}`;
document.title=`BGD — ${SETTINGS.title}`;
$('game-title').replaceChildren(document.createTextNode(SETTINGS.titleLines[0]),document.createElement('br'),Object.assign(document.createElement('em'),{textContent:SETTINGS.titleLines[1]}));
document.querySelector('.start-footnote').firstChild.textContent=`ПЕРВАЯ СМЕНА · ${Math.round(SETTINGS.sessionSeconds/60)} МИН. `;
async function enterFullscreen(){
  if(document.fullscreenElement)return true;
  if(!$('shell').requestFullscreen)return false;
  try{await $('shell').requestFullscreen({navigationUI:'hide'});return true;}catch{return false;}
}
function start(){if(!renderer||game.orientationBlocked)return;void enterFullscreen();joystickController?.reset();keys.clear();game.start();updateUI();$('world').focus({preventScroll:true});}
$('pencil-drop').addEventListener('pointerdown',e=>{e.preventDefault();game.dropPencil();updateUI();});
$('pencil-drop').onclick=e=>{if(e.detail===0){game.dropPencil();updateUI();}};
$('pencil-exit').onclick=()=>{if(!game.paused&&!game.orientationBlocked){game.leavePair();keys.clear();miniAxis=0;updateUI();$('world').focus({preventScroll:true});}};
for(const [id,axis] of [['pencil-left',-1],['pencil-right',1]]){
 const button=$(id);button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);miniAxis=axis;});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,()=>{miniAxis=0;});
}
$('start').onclick=start;$('restart').onclick=start;
$('pause').onclick=()=>{game.togglePause();keys.clear();updateUI();};$('resume').onclick=()=>{game.paused=false;updateUI();};
$('dialogue-next').onclick=()=>{game.interact();updateUI();};$('touch-e').addEventListener('pointerdown',e=>{e.preventDefault();game.interact();updateUI();});$('touch-e').onclick=e=>{if(e.detail===0){game.interact();updateUI();}};
$('sound').onclick=async()=>{try{const on=await sound.toggle();$('sound-label').textContent=on?'вкл':'выкл';$('sound').setAttribute('aria-pressed',String(on));$('sound').setAttribute('aria-label',on?'Выключить звук':'Включить звук');}catch{sound.enabled=false;$('sound-label').textContent='выкл';}};
$('fullscreen').onclick=async()=>{joystickController?.reset();if(document.fullscreenElement)await document.exitFullscreen();else{const ok=await enterFullscreen();if(!ok)game.notice('Игра уже занимает всё окно браузера.');}};
$('overview').onclick=()=>{const overview=renderer?.toggleOverview();$('overview').setAttribute('aria-pressed',String(overview));$('overview').title=overview?'Следовать за Альбертом':'Вся студия';};
document.addEventListener('fullscreenchange',()=>{if(wasFullscreen&&!document.fullscreenElement&&game.mode==='playing'&&!game.orientationBlocked)game.paused=true;wasFullscreen=!!document.fullscreenElement;joystickController?.reset();if(renderer)renderer.resize();$('fullscreen').setAttribute('aria-label',document.fullscreenElement?'Выйти из полного экрана':'На весь экран');});
window.addEventListener('keydown',e=>{
  if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyE','Space','Escape'].includes(e.code))e.preventDefault();
  if(e.repeat||game.orientationBlocked)return;
  keys.add(e.code);
  if(e.code==='KeyE')game.interact();
  if(e.code==='Space'&&game.minigame)game.dropPencil();
  if(e.code==='Escape'){game.togglePause();keys.clear();updateUI();}
  if((e.code==='Enter'||e.code==='Space')&&game.mode==='start')start();
});
window.addEventListener('keyup',e=>keys.delete(e.code));
function suspend(){miniAxis=0;joystickController?.reset();keys.clear();stick={x:0,y:0};$('stick').style.transform='';if(game.mode==='playing'){game.paused=true;updateUI();}}
window.addEventListener('blur',suspend);document.addEventListener('visibilitychange',()=>{if(document.hidden)suspend();});
joystickController=floatingJoystick({zone:$('move-zone'),base:$('joystick'),knob:$('stick'),enabled:()=>game.mode==='playing'&&!game.paused&&!game.dialogue&&!game.minigame&&!game.orientationBlocked,onChange:v=>{stick=v;}});
function portrait(canvas,row,headOnly=false){const c=canvas.getContext('2d');c.clearRect(0,0,canvas.width,canvas.height);if(headOnly){const sy=row?501:7;c.drawImage(atlas,143,sy,138,156,0,0,canvas.width,canvas.height);}else drawFrame(c,atlas,row,'down',192,507,494);}
function updateUI(){
  if(game.paused||game.dialogue||game.minigame||game.mode!=='playing'||game.orientationBlocked)joystickController?.reset();
  if(game.paused||game.mode==='finished')sound.stopSpeech();
  $('shell').classList.toggle('in-game',game.mode!=='start');
  if(shownMode!==game.mode){shownMode=game.mode;$('start-screen').hidden=game.mode!=='start';$('end-screen').hidden=game.mode!=='finished';$('hud').hidden=game.mode!=='playing';$('pause').hidden=game.mode!=='playing';$('touch-controls').hidden=game.mode!=='playing';
    if(game.mode==='finished'){
      $('rank').textContent=game.stats.repairs+game.stats.people>0?'Альберт всё разрулил':'Первая смена — знакомство с BGD';
      const rows=[['Устранено неполадок',game.stats.repairs],['Помогли людям',game.stats.people],['Спасено репетиций',game.stats.rehearsals],['Визитов в Тайную комнату',game.stats.secretVisits],['Максимальная обстановка BGD',Math.round(game.maxMood)+'%']];
      $('stats').replaceChildren(...rows.map(([name,value])=>{const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=name;dd.textContent=value;row.append(dt,dd);return row;}));
    }
  }
  const showMini=!!game.minigame&&!game.paused&&game.mode==='playing';
  $('pencil-screen').hidden=!showMini;
  if(!!game.minigame!==miniActive){miniActive=!!game.minigame;keys.clear();miniAxis=0;joystickController?.reset();if(showMini)$('pencil-drop').focus({preventScroll:true});}
  if(game.paused||game.orientationBlocked)miniAxis=0;
  if(showMini){$('pencil-feedback').textContent=game.minigame.feedback;$('pencil-score').textContent=game.minigame.score+' / 3';$('pencil-drop').disabled=!!game.minigame.drop;}
  $('pause-screen').hidden=!game.paused||game.mode!=='playing';
  $('dialogue').hidden=!game.dialogue||game.paused||game.mode!=='playing';
  if(game.dialogue&&game.dialogue!==dialogueRef){dialogueRef=game.dialogue;$('speaker').textContent=game.dialogue.speaker;$('line').textContent=game.dialogue.text;renderer.portrait($('dialogue-portrait'),[...CHARACTERS,...(game.guests||[])].find(n=>n.name===game.dialogue.speaker));}
  if(game.mode!=='playing')return;
  const mood=Math.round(game.mood);$('mood-number').replaceChildren(document.createTextNode(mood),Object.assign(document.createElement('span'),{textContent:'%'}));$('mood-fill').style.width=mood+'%';$('mood-fill').style.background=mood<30?'#dc8f76':mood<60?'#d9af73':'#efb764';
  $('move-hint').hidden=game.elapsed>8;
  $('time').textContent=formatTime(Math.max(0,Math.ceil(game.settings.sessionSeconds-game.elapsed)));
  const statusText=game.toast&&game.elapsed<game.toast.until?game.toast.text:game.taskText();
  $('task').textContent=statusText;$('event-count').textContent=game.events.length>1?`${game.events.length} дела`:'';
  $('toast').hidden=true;
  taskStrip.hidden=!!game.dialogue||game.paused||!!game.minigame;
  const target=game.nearestTarget();$('interaction').hidden=!target||!!game.dialogue||game.paused||!!game.repair;
  if(target){$('interaction').querySelector('span').textContent=target.id==='play-instrument'?'Играть':target.id==='anfisa'?'Пригласить':game.speakers().find(n=>n.id===target.id)?target.name:target.id==='curtain'?'Проводить':'Проверить';}
  $('repair-progress').hidden=!game.repair;if(game.repair)$('repair-progress').querySelector('.meter>div').style.width=Math.round(game.repair.elapsed/game.repair.duration*100)+'%';
  $('touch-controls').hidden=game.paused||!!game.dialogue||!!game.minigame;
  const canvasRect=$('world').getBoundingClientRect();
  renderer.textExclusions=[...document.querySelectorAll('.mood-card,.shift-clock,.task-strip,#toast,#interaction,#repair-progress,#dialogue,.top-actions,#joystick,#touch-e')].filter(el=>el.getClientRects().length).map(el=>{const r=el.getBoundingClientRect();return {x:r.x-canvasRect.x,y:r.y-canvasRect.y,w:r.width,h:r.height};});
}
function frame(t){const dt=last?Math.min((t-last)/1000,.05):0;last=t;
  const input={x:(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+stick.x+miniAxis,y:(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0)+stick.y,run:keys.has('ShiftLeft')||keys.has('ShiftRight')};
  game.update(dt,input);renderer.render(game,t/1000);if(game.minigame)drawPencilGame($('pencil-canvas'),game.minigame);while(game.signals.length)sound.play(game.signals.shift());
  if(t-lastUi>70){updateUI();lastUi=t;}requestAnimationFrame(frame);
}
try {
  const [background,characters,crew,friends,nikitaDrink,davidDrink,newcomers,band,dance,nikitaCheer]=await Promise.all([loadImage('./assets/studio.webp'),loadImage('./assets/characters-key.webp'),loadImage('./assets/crew-key.webp'),loadImage('./assets/friends-realistic-key.webp'),loadImage('./assets/nikita-drink-key.webp'),loadImage('./assets/david-drink-key.webp'),loadImage('./assets/newcomers-key.webp'),loadImage('./assets/metallica-drink-key.webp'),loadImage('./assets/tema-break-key.webp'),loadImage('./assets/nikita-cheer-key.webp')]);
  atlas=keyedAtlas(characters);renderer=new Renderer($('world'),background,atlas);renderer.addCrew(keyedAtlas(crew));new ResizeObserver(()=>renderer.resize()).observe($('world'));renderer.resize();portrait($('portrait'),0);
  renderer.addFriends(keyedAtlas(friends,'magenta'));renderer.addDrink('nikita',keyedAtlas(nikitaDrink,'magenta'));renderer.addDrink('david',keyedAtlas(davidDrink,'magenta'));
  renderer.addCheer(keyedAtlas(nikitaCheer,'magenta'));renderer.addNewcomers(keyedAtlas(newcomers,'magenta'));renderer.addBand(keyedAtlas(band,'magenta'));renderer.addDance(keyedAtlas(dance,'magenta'));
  $('start').disabled=false;$('start').querySelector('span').textContent='НАЧАТЬ СМЕНУ';requestAnimationFrame(frame);
  // Opt-in diagnostics only. Normal players cannot accidentally teleport or shorten a shift.
  if(new URLSearchParams(location.search).get('debug')==='1')window.__bgd={game,renderer,updateUI,joystickController,getInput:()=>({...stick})};
}catch(error){$('load-error').hidden=false;$('load-error').textContent='Не удалось загрузить рисунки. Обнови страницу, чтобы попробовать ещё раз.';console.error(error);}
