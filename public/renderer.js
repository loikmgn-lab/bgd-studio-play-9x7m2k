import { WORLD } from './content.js';
import { MotionAtlas } from './motion.js';
const frames={down:0,right:1,up:2,left:3};
const boxes=[
  [{x:108,y:7,w:211,h:476},{x:522,y:7,w:151,h:477},{x:858,y:7,w:190,h:477},{x:1214,y:7,w:164,h:477}],
  [{x:105,y:500,w:216,h:492},{x:514,y:500,w:163,h:492},{x:864,y:500,w:190,h:492},{x:1215,y:500,w:160,h:492}],
];
export function loadImage(url) {return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('Не удалось загрузить '+url));image.src=url;});}
export function keyedAtlas(image) {
  // Chroma-key is a rendering material: source artwork remains unchanged.
  const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
  const c=canvas.getContext('2d',{willReadFrequently:true});c.drawImage(image,0,0);
  const pixels=c.getImageData(0,0,canvas.width,canvas.height),data=pixels.data;
  for(let i=0;i<data.length;i+=4){const r=data[i],g=data[i+1],b=data[i+2];const green=g-Math.max(r,b);if(green>65&&g>110)data[i+3]=0;else if(green>20&&g>90){data[i+3]=Math.round(255*(1-(green-20)/45));data[i+1]=Math.max(r,b);}}
  c.putImageData(pixels,0,0);return canvas;
}
export function drawFrame(context,atlas,row,direction,x,y,height,frameBoxes=boxes) {
  const b=frameBoxes[row][frames[direction]??0],width=b.w/b.h*height;
  context.drawImage(atlas,b.x,b.y,b.w,b.h,x-width/2,y-height,width,height);
}
export function detectFrames(atlas,rows){
  const c=atlas.getContext('2d'),w=atlas.width,h=atlas.height,data=c.getImageData(0,0,w,h).data,result=[];
  for(let row=0;row<rows;row++){result[row]=[];for(let col=0;col<4;col++){
    const x0=Math.floor(col*w/4),x1=Math.floor((col+1)*w/4),margin=Math.ceil(h/rows*.08),y0=Math.max(0,Math.floor(row*h/rows)-margin),y1=Math.min(h,Math.floor((row+1)*h/rows)+margin);
    // Generated rows have slightly different baselines. Ignore a neighbouring row's
    // shoe tips by selecting the largest continuous opaque vertical band per cell.
    let band=null,best=null;
    for(let y=y0;y<=y1;y++){
      let count=0;if(y<y1)for(let x=x0;x<x1;x++)if(data[(y*w+x)*4+3]>180)count++;
      if(count){band??={top:y,bottom:y,score:0};band.bottom=y;band.score+=count;}
      else if(band){if(!best||band.score>best.score)best=band;band=null;}
    }
    let left=x1,right=x0,top=best?.top??y1,bottom=best?.bottom??y0;
    for(let y=top;y<=bottom;y++)for(let x=x0;x<x1;x++)if(data[(y*w+x)*4+3]>180){left=Math.min(left,x);right=Math.max(right,x);}
    if(right<=left||bottom<=top)throw new Error(`Missing crew sprite ${row}/${col}`);
    result[row][col]={x:left,y:top,w:right-left+1,h:bottom-top+1};
  }}return result;
}
export class Renderer {
  constructor(canvas,background,atlas){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.background=background;this.atlas=atlas;this.motion=new MotionAtlas(atlas,boxes);this.view={scale:1,x:0,y:0};this.debug=false;}
  addCrew(atlas){const frameBoxes=detectFrames(atlas,5);this.crew={atlas,boxes:frameBoxes,motion:new MotionAtlas(atlas,frameBoxes)};}
  portrait(canvas,person){
    const source=person?.atlasKey==='crew'?this.crew:{atlas:this.atlas,boxes},row=person?.atlasRow||0,b=source.boxes[row][0],c=canvas.getContext('2d');
    c.clearRect(0,0,canvas.width,canvas.height);c.drawImage(source.atlas,b.x+b.w*.15,b.y,b.w*.7,b.h*.31,0,0,canvas.width,canvas.height);
  }
  resize(){const r=this.canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);this.width=r.width;this.height=r.height;this.canvas.width=Math.round(r.width*dpr);this.canvas.height=Math.round(r.height*dpr);this.dpr=dpr;this.view.scale=Math.min(r.width/WORLD.width,r.height/WORLD.height);this.view.x=(r.width-WORLD.width*this.view.scale)/2;this.view.y=(r.height-WORLD.height*this.view.scale)/2;}
  screen(p){return {x:this.view.x+p.x*this.view.scale,y:this.view.y+p.y*this.view.scale};}
  render(game,time) {
    if(game.player)time=game.elapsed;
    const c=this.ctx,v=this.view;c.setTransform(this.dpr,0,0,this.dpr,0,0);c.fillStyle='#090b0d';c.fillRect(0,0,this.width,this.height);
    c.translate(v.x,v.y);c.scale(v.scale,v.scale);c.drawImage(this.background,0,0,WORLD.width,WORLD.height);
    // Warm practical lights and BGD's blue neon breathe very subtly.
    const pulse=.025+Math.sin(time*.9)*.008;c.globalCompositeOperation='screen';
    for(const [x,y,r,color] of [[1430,510,180,'75,90,245'],[195,112,130,'255,164,51'],[510,104,115,'255,145,35']]){
      const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,`rgba(${color},${pulse})`);g.addColorStop(1,`rgba(${color},0)`);c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);
    }c.globalCompositeOperation='source-over';
    if(game.player) {
      const entities=[{body:game.player,row:0,player:true},...game.npcs.filter(n=>n.visible).map(n=>({body:n,row:n.atlasRow,player:false}))];
      entities.sort((a,b)=>a.body.y-b.body.y);for(const item of entities)this.character(item,time,game);
      for(const target of game.targets()){
        if(target.id==='loik')this.marker(game.npc.x,game.npc.y-140,'sad',time);
        else{const point=target.marker||target;this.marker(point.x,point.y,target.id==='curtain'?'arrow':target.icon,time);}
      }
      const social=game.events.find(e=>e.type==='comfort');
      if(social?.phase==='waiting'){this.smoke(time,game.settings.secretSeconds-(social.returnAt-game.elapsed));this.marker(146,715,'wait',time,(social.returnAt-game.elapsed)/game.settings.secretSeconds);}
      if(game.npc.state==='happy')this.marker(game.npc.x,game.npc.y-140,'happy',time);
      if(game.npc.state==='following_albert')this.marker(game.npc.x,game.npc.y-140,'follow',time);
    }
    if(this.debug)this.drawDebug();
  }
  character({body,row,player},time,game) {
    const c=this.ctx,p=WORLD.platform;const raised=body.x>p.x&&body.x<p.x+p.w&&body.y>p.y&&body.y<p.y+p.h?p.elevation:0;
    c.save();c.translate(body.x,body.y-raised);
    c.fillStyle='#0007';c.beginPath();c.ellipse(0,0,23,9,0,0,Math.PI*2);c.fill();
    if(player){c.strokeStyle='#efbf7ba0';c.lineWidth=1.5;c.beginPath();c.ellipse(0,1,25,10,0,0,Math.PI*2);c.stroke();}
    const bob=body.moving?Math.abs(Math.sin(body.step))*3.2:Math.sin(time*2)*.45;
    const lean=body.moving?Math.sin(body.step)*.014:0;const sad=body.state==='sad';
    c.translate(0,-bob);c.rotate(lean+(sad?.018:0));
    const instrument=body.instrument&&(player||body.state==='playing_instrument')?body.instrument:null;
    const height=instrument?.pose==='drums'?119:player?134:131;
    if(player&&game.repair){c.translate(Math.sin(time*22)*1.5,0);c.rotate(Math.sin(time*9)*.016);}
    const pose=body.moving?'walk':instrument?.pose||(player&&game.repair?'keys':null);
    const source=body.atlasKey==='crew'?this.crew:{atlas:this.atlas,boxes,motion:this.motion};
    if(pose)source.motion.draw(c,row,frames[body.direction],pose,body.moving?body.step:time*9,height);
    else drawFrame(c,source.atlas,row,body.direction,0,0,height,source.boxes);
    if(instrument)this.playing(instrument,time);
    if(player&&body.gesture>0){c.globalAlpha=body.gesture/.45;c.strokeStyle='#f3c27e';c.lineWidth=2;c.beginPath();c.arc(0,-57,32,-.5,.7);c.stroke();}
    c.restore();
  }
  playing(instrument,time){
    const c=this.ctx,beat=Math.sin(time*9);
    if(instrument.pose==='guitar'){
      c.save();c.translate(3,-65);c.rotate(-.55+beat*.025);
      c.strokeStyle='#d7b67a';c.lineWidth=1.4;c.fillStyle='#252632';
      c.beginPath();c.moveTo(-9,-14);c.bezierCurveTo(-26,-15,-24,13,-7,17);c.bezierCurveTo(9,23,20,5,9,-6);c.lineTo(5,-15);c.closePath();c.fill();c.stroke();
      c.fillStyle='#b38b54';c.fillRect(-3,-48,6,39);c.fillStyle='#dacda8';c.fillRect(-4,-56,8,12);
      c.strokeStyle='#aaa7a0';c.lineWidth=.6;for(let i=-2;i<=2;i+=2){c.beginPath();c.moveTo(i,-49);c.lineTo(i,9);c.stroke();}
      c.fillStyle='#ddac88';c.beginPath();c.ellipse(-1,beat*4,7,3,.3,0,7);c.fill();c.restore();
    }else if(instrument.pose==='drums'){
      c.strokeStyle='#f3d6a0';c.lineWidth=2.5;c.lineCap='round';
      for(const side of [-1,1]){const stroke=Math.sin(time*12+side*Math.PI/2);c.beginPath();c.moveTo(side*20,-57-stroke*5);c.lineTo(side*(29+stroke*5),-95-stroke*15);c.stroke();}
    }else{
      c.fillStyle='#f4d49a';for(let i=0;i<3;i++){c.globalAlpha=.3+Math.max(0,Math.sin(time*8+i))* .45;c.fillRect(-17+i*12,-75+(i%2)*2,6,3);}c.globalAlpha=1;
    }
    c.font='18px Arial';c.textAlign='center';c.fillStyle='#efd18e';
    for(let i=0;i<3;i++){const t=(time*.65+i/3)%1;c.globalAlpha=Math.sin(t*Math.PI)*.8;c.fillText(i%2?'♫':'♪',27+Math.sin(t*5+i)*12,-128-t*39);}
    c.globalAlpha=1;
  }
  smoke(time,age){
    const c=this.ctx;c.save();
    for(let i=0;i<22;i++){
      const life=2.8,birth=i*.127,elapsed=(age-birth)%life;if(age<birth||elapsed<0)continue;
      const t=elapsed/life,x=154+t*49+Math.sin(time*1.5+i*2)*13*t,y=760-t*141+Math.sin(i*3)*9;
      const r=8+t*29,g=c.createRadialGradient(x-r*.2,y-r*.2,0,x,y,r);
      const alpha=Math.sin(t*Math.PI)*.23;g.addColorStop(0,`rgba(217,203,235,${alpha})`);g.addColorStop(.55,`rgba(182,162,215,${alpha*.7})`);g.addColorStop(1,'rgba(152,133,190,0)');
      c.fillStyle=g;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();
    }c.restore();
  }
  marker(x,y,type,time,progress=1) {
    const c=this.ctx,bob=Math.sin(time*3+x)*3,r=16;c.save();c.translate(x,y+bob);
    c.shadowColor='#0009';c.shadowBlur=10;c.fillStyle=['sad','follow'].includes(type)?'#afc7e8':type==='happy'?'#bed18d':'#efbc70';
    c.beginPath();c.arc(0,0,r,0,Math.PI*2);c.fill();c.shadowBlur=0;c.strokeStyle='#19171d';c.fillStyle='#19171d';c.lineWidth=1.8;c.lineCap='round';
    if(type==='sad'||type==='happy') {
      c.beginPath();c.arc(-5,-3,1.5,0,7);c.arc(5,-3,1.5,0,7);c.fill();c.beginPath();
      if(type==='sad'){c.arc(0,9,5,Math.PI,Math.PI*2);c.moveTo(9,-1);c.lineTo(9,5);}else c.arc(0,1,6,.15,Math.PI-.15);c.stroke();
    }else if(type==='wait'){c.beginPath();c.arc(0,0,9,-Math.PI/2,Math.PI*2*progress-Math.PI/2);c.stroke();c.beginPath();c.moveTo(0,-5);c.lineTo(0,0);c.lineTo(4,2);c.stroke();}
    else {c.textAlign='center';c.textBaseline='middle';c.font='bold 22px Arial';c.fillText(type==='arrow'?'←':type==='follow'?'↗':type,0,1);}
    c.restore();
  }
  drawDebug(){const c=this.ctx;c.strokeStyle='#ff6666';c.lineWidth=2;for(const o of WORLD.obstacles){c.beginPath();if(o.points){o.points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();}else if(o.rx)c.ellipse(o.x,o.y,o.rx,o.ry,0,0,7);else c.rect(o.x,o.y,o.w,o.h);c.stroke();}}
}
