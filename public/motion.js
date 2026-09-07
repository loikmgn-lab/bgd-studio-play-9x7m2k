// Textured mesh animation in the renderer. Original reference pixels are preserved.
// Shoulder/hip weights bend limbs independently instead of sliding a rigid sprite.
const smooth=(a,b,t)=>{const x=Math.max(0,Math.min(1,(t-a)/(b-a)));return x*x*(3-2*x);};
function deformation(u,v,phase,pose,profile) {
  // Broad blend keeps mesh triangles from folding when the legs cross in profile.
  const wave=Math.sin(phase),side=Math.tanh((u-.5)*5);
  let x=0,y=0;
  const legs=smooth(.56,.95,v),knee=Math.sin(Math.max(0,(v-.56)/.44)*Math.PI);
  if(pose==='walk'){
    x+=legs*side*wave*(profile?.15:.062)+knee*side*wave*.027;
    y-=legs*Math.max(0,side*wave)*.051;
  }
  const outer=profile?1-smooth(.28,.43,Math.abs(u-.49)):smooth(.19,.28,Math.abs(u-.5));
  const arm=smooth(.27,.59,v)*(1-smooth(.65,.73,v))*outer;
  if(pose==='walk'){x-=arm*wave*(profile?.075:side*.105);y-=arm*Math.max(0,-side*wave)*.023;}
  if(pose==='headspin'){x+=legs*side*(.24+wave*.05);y-=arm*.16;x+=arm*side*.12;}
  if(pose==='keys'){x-=arm*side*(.065+Math.sin(phase+side)*.035);y-=arm*(.095+Math.sin(phase*2+side)*.023);}
  if(pose==='drums'){x+=arm*side*(.08+Math.sin(phase+side)*.055);y-=arm*(.12+Math.sin(phase+side)*.065);}
  if(pose==='guitar'){x-=arm*side*.18;y-=arm*(side>0?.10+Math.sin(phase*2)*.035:.17);}
  return {x,y};
}
function triangle(c,texture,s,d) {
  const u1=s[1].x-s[0].x,v1=s[1].y-s[0].y,u2=s[2].x-s[0].x,v2=s[2].y-s[0].y,det=u1*v2-u2*v1;
  const x1=d[1].x-d[0].x,y1=d[1].y-d[0].y,x2=d[2].x-d[0].x,y2=d[2].y-d[0].y;
  const a=(x1*v2-x2*v1)/det,b=(y1*v2-y2*v1)/det,cc=(x2*u1-x1*u2)/det,dd=(y2*u1-y1*u2)/det;
  c.save();c.beginPath();const center={x:(d[0].x+d[1].x+d[2].x)/3,y:(d[0].y+d[1].y+d[2].y)/3};
  d.forEach((p,i)=>{const len=Math.hypot(p.x-center.x,p.y-center.y)||1,x=p.x+(p.x-center.x)/len*.45,y=p.y+(p.y-center.y)/len*.45;i?c.lineTo(x,y):c.moveTo(x,y);});c.closePath();c.clip();
  c.transform(a,b,cc,dd,d[0].x-a*s[0].x-cc*s[0].y,d[0].y-b*s[0].x-dd*s[0].y);c.drawImage(texture,0,0);c.restore();
}
export class MotionAtlas {
  constructor(atlas,boxes){this.atlas=atlas;this.boxes=boxes;this.cache=new Map();this.sources=new Map();}
  frame(row,column,pose,phase) {
    const sample=((Math.floor(phase/(Math.PI*2)*16)%16)+16)%16,key=`${row}/${column}/${pose}/${sample}`;
    if(this.cache.has(key))return this.cache.get(key);
    const b=this.boxes[row][column],h=280,w=Math.ceil(h*b.w/b.h),padding=32,sourceKey=`${row}/${column}`;
    let texture=this.sources.get(sourceKey);
    if(!texture){texture=document.createElement('canvas');texture.width=w;texture.height=h;texture.getContext('2d').drawImage(this.atlas,b.x,b.y,b.w,b.h,0,0,w,h);this.sources.set(sourceKey,texture);}
    const canvas=document.createElement('canvas');canvas.width=w+padding*2;canvas.height=h+padding*2;const c=canvas.getContext('2d');
    const nx=12,ny=24,grid=[];
    for(let j=0;j<=ny;j++){grid[j]=[];for(let i=0;i<=nx;i++){const u=i/nx,v=j/ny,delta=deformation(u,v,sample/16*Math.PI*2,pose,column===1||column===3);grid[j][i]={s:{x:u*w,y:v*h},d:{x:padding+(u+delta.x)*w,y:padding+(v+delta.y)*h}};}}
    for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const a=grid[j][i],b=grid[j][i+1],cc=grid[j+1][i],d=grid[j+1][i+1];for(const t of [[a,b,cc],[b,d,cc]])triangle(c,texture,t.map(v=>v.s),t.map(v=>v.d));}
    const result={canvas,w,h,padding};if(this.cache.size>=192)this.cache.delete(this.cache.keys().next().value);this.cache.set(key,result);return result;
  }
  draw(c,row,column,pose,phase,height){const f=this.frame(row,column,pose,phase),scale=height/f.h;c.drawImage(f.canvas,(-f.w/2-f.padding)*scale,(-f.h-f.padding)*scale,f.canvas.width*scale,f.canvas.height*scale);}
}
