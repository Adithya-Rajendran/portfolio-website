// Check both eyes against the virtual image of a reflection-only lamp in EVERY room.
// In the three window rooms, also read their actual sun maps at both eyes, then after 18 s of roll.
// node floor-check.mjs URL
import {chromium} from 'playwright';import assert from 'node:assert/strict';
import { ROOM_PATH } from './roompath.mjs';
import { streamAbort } from './reqfail.mjs';
const base=process.argv[2],errors=[],rooms={lobby:[.42,2.65],about:[.35,2.45],projects:[.42,2.6],experience:[.1,4.45],writing:[3.1,2.25]}; // bare deck, not a rug or plinth
const browser=await chromium.launch({args:['--use-angle=gl-egl','--enable-gpu','--ignore-gpu-blocklist']});
try {
 const page=await browser.newPage({viewport:{width:960,height:540},reducedMotion:'no-preference'});
 page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>streamAbort(r) || errors.push(r.url()));
 page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 for(const [room,patch] of Object.entries(rooms)){
  const url=new URL(base);url.pathname=ROOM_PATH[room];url.search=new URLSearchParams({shot:'hero',scale:1,tier:1,roll:120,lightcheck:1,grain:0,chand:0,bloom:0,skip:'dust'});
  await page.goto(url.href);await page.waitForFunction(id=>window.__lobby?.mode().room===id&&document.querySelector('#loader.done'),room,{timeout:120000});
  const measure=await page.evaluate(async ([x,z])=>{
   const T=await import('three'),{uMirror}=await import('./js/kit.js'),l=window.__lobby,R=l.renderer,gl=R.getContext(),W=gl.drawingBufferWidth,H=gl.drawingBufferHeight;
   const pos=new T.Vector3(x,.34,z),virtual=new T.Vector3(x,-.34,z),target=[x,0,z+.2],eyes=[[x-1.05,1.4,z+2.2],[x+.95,1.55,z+2.3]];
   const mark=new T.Mesh(new T.SphereGeometry(.044,20,12),new T.ShaderMaterial({uniforms:{uMirror},vertexShader:'void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform float uMirror;void main(){if(uMirror<.5)discard; gl_FragColor=vec4(10.,0.,0.,1.);}'}));mark.position.copy(pos);l.scene.add(mark);
   const S=256,rt=new T.WebGLRenderTarget(S,S,{depthBuffer:false}),quadScene=new T.Scene(),cam=new T.Camera();let tShadow;
   l.scene.traverse(o=>{const u=o.material?.uniforms;if(o.userData.grp?.startsWith('floor')&&u?.tShadow)tShadow=u.tShadow;});
   const q=new T.Mesh(new T.PlaneGeometry(2,2),new T.ShaderMaterial({uniforms:{sh:tShadow||{value:null}},depthTest:false,depthWrite:false,vertexShader:'varying vec2 st;void main(){st=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:'uniform sampler2D sh;varying vec2 st;void main(){float z=floor(texture2D(sh,st).r*65535.+.5);gl_FragColor=vec4(floor(z/256.)/255.,mod(z,256.)/255.,0.,1.);}'}));q.frustumCulled=false;quadScene.add(q);
   function depth(){const a=new Uint8Array(S*S*4);R.setRenderTarget(rt);R.render(quadScene,cam);R.readRenderTargetPixels(rt,0,0,S,S,a);R.setRenderTarget(null);return a;}
   const maps=[],landmarks=eyes.map(eye=>{
    function read(on){mark.visible=on;l.lightFrame(eye,target,0);const a=new Uint8Array(W*H*4);gl.readPixels(0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,a);return a;}
    const lit=read(true),unlit=read(false);if(tShadow)maps.push(depth());const p=virtual.clone().project(l.camera),X=(1+p.x)*W/2,Y=(1+p.y)*H/2;
    let weight=0,sx=0,sy=0;for(let j=Math.max(0,Math.floor(Y)-32);j<Math.min(H,Y+32);j++)for(let i=Math.max(0,Math.floor(X)-32);i<Math.min(W,X+32);i++){
     const n=4*(W*j+i),v=Math.max(0,lit[n]-unlit[n]-3);weight+=v;sx+=v*(i+.5);sy+=v*(j+.5);}
    return {signal:weight,errorPx:weight?+Math.hypot(sx/weight-X,sy/weight-Y).toFixed(2):null};
   });
   let sun=null;if(tShadow){l.lightFrame(eyes[0],target,18);const last=depth(),diff=(a,b)=>{let n=0;for(let i=0;i<a.length;i+=4)n+=+(a[i]!==b[i]||a[i+1]!==b[i+1]);return n;};sun={samples:S*S,eyeChanges:diff(maps[0],maps[1]),rollChanges:diff(maps[0],last)};}
   l.scene.remove(mark);mark.geometry.dispose();mark.material.dispose();q.geometry.dispose();q.material.dispose();rt.dispose();return {landmarks,sun};
  },patch);
  console.log(JSON.stringify({room,...measure}));for(const k of measure.landmarks)assert(k.signal>200&&k.errorPx!==null&&k.errorPx<4,`${room}: misplaced or missing floor reflection`);
  if(['lobby','about','writing'].includes(room))assert(measure.sun?.eyeChanges===0&&measure.sun.rollChanges>100,`${room}: eye-dependent or static sun depth`);else assert.equal(measure.sun,null);
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
