import {WORLD} from './content.js?v=0.8.1';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function cameraTarget(width,height,body,overview=false){
  const scale=(overview?Math.min:Math.max)(width/WORLD.width,height/WORLD.height);
  if(overview||!body)return {scale,x:(width-WORLD.width*scale)/2,y:(height-WORLD.height*scale)/2};
  return {scale,x:clamp(width/2-body.x*scale,width-WORLD.width*scale,0),y:clamp(height/2-(body.y-55)*scale,height-WORLD.height*scale,0)};
}
export function drinkFrame(body,time){
  if(body.state!=='drinking')return 0;
  const age=time-body.sipStarted,remaining=body.sipUntil-time;
  if(age<.2||remaining<.25)return 0;
  if(age<.65||remaining<.65)return 1;
  return 2;
}
