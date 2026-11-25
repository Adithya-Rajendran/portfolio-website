// Headless browser spot check, not a claim about Safari hardware. Reduced motion must hold the
// default roll and skip the pullback, while opaque Cycles textures must contribute to real pixels.
// node light-compat.mjs URL chromium|webkit width height [rooms...] (LIGHT_DEFAULT=1: use the visitor's adaptive quality)
import {chromium,webkit} from 'playwright'; import assert from 'node:assert/strict';
import { ROOM_PATH } from './roompath.mjs';
import { streamAbort } from './reqfail.mjs';
const [base,engine='chromium',width=960,height=540,...rooms]=process.argv.slice(2);
const b=await ({chromium,webkit})[engine].launch(engine==='chromium'?{args:['--use-angle=gl-egl','--enable-gpu','--ignore-gpu-blocklist']}:{});
try {
  const p=await b.newPage({viewport:{width:+width,height:+height},reducedMotion:'reduce'}), errors=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  p.on('requestfailed',r=>streamAbort(r) || errors.push(r.url()));p.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  for(const room of rooms.length?rooms:['lobby','about','projects','experience','writing']){
    const u=new URL(base);u.pathname=ROOM_PATH[room];u.search=new URLSearchParams({...(process.env.LIGHT_DEFAULT==='1'?{}:{tier:1,scale:1}),lightcheck:1,grain:0});await p.goto(u.href);
    await p.waitForFunction(r=>document.querySelector('#loader.done')&&window.__lobby?.mode().room===r,room,{timeout:120000});
    const s=await p.evaluate(async r=>{const l=window.__lobby,gl=l.renderer.getContext(),info=await (await fetch(`assets/${r}/scene.json`)).json(),B=a=>[a[0],a[2],-a[1]];
      await new Promise(q=>requestAnimationFrame(()=>requestAnimationFrame(q)));const cam=B(info.cam),tgt=B(info.tgt),zError=Math.abs(l.camera.position.z-cam[2]),done=l.ready(),gains=new Set();let sun;
      l.scene.traverse(o=>{const u=o.material?.uniforms;if(o.userData.grp&&u?.uGain&&!u.tRoomSpec)gains.add(u.uGain);if(u?.uSunDir)sun=u.uSunDir;});
      l.lightFrame(cam,tgt,0);const a=sun?.value.toArray();l.lightFrame(cam,tgt,46);const d=sun?.value.toArray().map((v,i)=>v-a[i]);
      const W=gl.drawingBufferWidth,H=gl.drawingBufferHeight,read=()=>{l.lightFrame(cam,tgt,0);const px=new Uint8Array(W*H*4);gl.readPixels(0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,px);return px;};
      const lit=read();for(const u of gains)u.value=0;const off=read();for(const u of gains)u.value=1;
      let n=0,mean=0;for(let i=0;i<lit.length;i+=4){const q=Math.max(...[0,1,2].map(k=>lit[i+k]-off[i+k]));if(q>=5)n++;mean+=q;}
      return {room:r,tier:l.mode().tier,scale:l.mode().scale,heroZError:zError,intro:done,rollChange:d?Math.max(...d.map(Math.abs)):null,bakeVisibleFraction:+(n/W/H).toFixed(4),meanBakeSignal:+(mean/W/H).toFixed(2),glError:gl.getError(),lost:gl.isContextLost()};},room);
    console.log(JSON.stringify({engine,width:+width,height:+height,...s}));assert(s.heroZError<.002&&s.intro===1,'Opening pullback ran under reduced motion');assert(!s.rollChange,'Default roll moved under reduced motion');assert(!s.lost&&s.glError===0,'GPU context or GL error');assert(s.bakeVisibleFraction>.05&&s.meanBakeSignal>1,'Opaque baked surfaces made no measurable contribution');
  }
  assert.deepEqual(errors,[]);
} finally {await b.close();}
