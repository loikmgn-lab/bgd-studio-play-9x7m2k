// Standalone party-game simulation; the studio clock pauses while this is active.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function createPencilGame(){return {time:0,anchor:300,target:300,score:0,attempts:0,drop:null,feedback:'Поймай момент и опусти карандаш',complete:false};}
export function pencilTip(m){const angle=Math.sin(m.time*2.15)*.46;return {x:m.anchor+Math.sin(angle)*165,y:46+Math.cos(angle)*165,angle};}
export function dropPencil(m){if(m.drop||m.complete)return false;const tip=pencilTip(m);m.drop={x:tip.x,y:tip.y,age:0,hit:Math.abs(tip.x-m.target)<=13};m.attempts++;return true;}
export function updatePencilGame(m,dt,axis=0){
 if(m.complete)return;m.time+=dt;
 if(!m.drop){m.anchor=clamp(m.anchor+clamp(axis,-1,1)*190*dt,105,495);return;}
 m.drop.age+=dt;
 if(m.drop.age>=.46&&!m.drop.resolved){
  m.drop.resolved=true;
  if(m.drop.hit){m.score++;m.feedback=m.score===3?'Три из трёх! Вот это точность!':'Есть! Ещё '+(3-m.score)+' попадания.';}
  else m.feedback='Чуть мимо. Поймай момент ещё раз!';
 }
 if(m.drop.age>=1.05){if(m.score>=3)m.complete=true;else {if(m.drop.hit)m.target=[300,245,350][m.score];m.drop=null;}}
}
export function drawPencilGame(canvas,m){
 const c=canvas.getContext('2d');c.clearRect(0,0,600,320);
 const g=c.createLinearGradient(0,0,0,320);g.addColorStop(0,'#24212b');g.addColorStop(1,'#141419');c.fillStyle=g;c.fillRect(0,0,600,320);
 c.strokeStyle='#ffffff0a';c.lineWidth=1;for(let x=20;x<600;x+=40){c.beginPath();c.moveTo(x,0);c.lineTo(x,320);c.stroke();}
 c.fillStyle='#efb764';c.font='bold 12px Arial';c.textAlign='left';c.fillText('BGD / ПРОВЕРКА МЕТКОСТИ',22,27);
 for(let i=0;i<3;i++){c.beginPath();c.arc(520+i*25,23,6,0,7);c.fillStyle=i<m.score?'#bedd92':'#ffffff26';c.fill();}
 const x=m.target;
 c.fillStyle='#64b9a92a';c.strokeStyle='#82c8b8';c.lineWidth=2;
 c.beginPath();c.moveTo(x-14,243);c.lineTo(x-14,262);c.bezierCurveTo(x-14,274,x-35,274,x-35,287);c.lineTo(x-35,307);c.quadraticCurveTo(x,318,x+35,307);c.lineTo(x+35,287);c.bezierCurveTo(x+35,274,x+14,274,x+14,262);c.lineTo(x+14,243);c.closePath();c.fill();c.stroke();
 c.fillStyle='#10191c';c.beginPath();c.ellipse(x,243,14,4,0,0,7);c.fill();c.stroke();c.strokeStyle='#ffffff36';c.beginPath();c.moveTo(x-23,286);c.lineTo(x-23,304);c.stroke();
 const tip=pencilTip(m),drop=m.drop;
 const px=drop?drop.x:tip.x,py=drop?drop.y+(drop.hit?272-drop.y:240-drop.y)*Math.min(drop.age/.46,1):tip.y;
 c.strokeStyle='#d9cebe';c.lineWidth=1.5;c.beginPath();c.moveTo(m.anchor,46);c.lineTo(px,py-47);c.stroke();
 c.fillStyle='#eee1c8';c.beginPath();c.arc(m.anchor,46,4,0,7);c.fill();
 c.save();c.translate(px,py);c.fillStyle='#efb764';c.fillRect(-4,-49,8,39);c.fillStyle='#c78347';c.fillRect(1,-49,3,39);c.fillStyle='#ebd5b0';c.beginPath();c.moveTo(-4,-10);c.lineTo(0,0);c.lineTo(4,-10);c.fill();c.fillStyle='#292428';c.beginPath();c.moveTo(-1.6,-4);c.lineTo(0,0);c.lineTo(1.6,-4);c.fill();c.fillStyle='#d98c8c';c.fillRect(-4,-54,8,5);c.restore();
 if(drop?.resolved){c.textAlign='center';c.font='bold 26px Arial';c.fillStyle=drop.hit?'#c1df98':'#e9ad94';c.fillText(drop.hit?'✓':'Мимо',x,225);}
}
