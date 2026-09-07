// Pure radial response: dead zone, analogue speed, normalized diagonals.
export function stickVector(dx,dy,radius=42,deadZone=.14){
  const distance=Math.hypot(dx,dy),amount=Math.min(1,distance/radius);
  if(amount<=deadZone)return {x:0,y:0};
  const speed=(amount-deadZone)/(1-deadZone);return {x:dx/distance*speed,y:dy/distance*speed};
}
export function floatingJoystick({zone,base,knob,enabled,onChange}){
  let pointer=null,origin=null;
  function reset(){const previous=pointer;pointer=null;origin=null;base.hidden=true;knob.style.transform='';onChange({x:0,y:0});if(previous!==null&&zone.hasPointerCapture(previous))zone.releasePointerCapture(previous);}
  zone.addEventListener('pointerdown',e=>{
    if(pointer!==null||!enabled()||e.button>0)return;e.preventDefault();pointer=e.pointerId;origin={x:e.clientX,y:e.clientY};
    const r=base.parentElement.getBoundingClientRect();base.style.left=(e.clientX-r.left)+'px';base.style.top=(e.clientY-r.top)+'px';base.hidden=false;
    base.parentElement.classList.add('has-moved');zone.setPointerCapture(pointer);onChange({x:0,y:0});
  });
  zone.addEventListener('pointermove',e=>{
    if(e.pointerId!==pointer||!origin)return;e.preventDefault();
    if(!enabled()){reset();return;}
    const dx=e.clientX-origin.x,dy=e.clientY-origin.y,v=stickVector(dx,dy),d=Math.max(42,Math.hypot(dx,dy));
    knob.style.transform=`translate(${dx/d*28}px,${dy/d*28}px)`;onChange(v);
  });
  for(const event of ['pointerup','pointercancel','lostpointercapture'])zone.addEventListener(event,e=>{if(e.pointerId===pointer)reset();});
  return {reset,get active(){return pointer!==null;}};
}
