// Paired warm browser timings of surface finishes on the same real GPU
import {chromium} from 'playwright';import assert from 'node:assert/strict';
import { ROOM_PATH } from './roompath.mjs';
import { streamAbort } from './reqfail.mjs';
const [old,now,frames=180]=process.argv.slice(2);const b=await chromium.launch({args:['--use-angle=gl-egl','--enable-gpu','--ignore-gpu-blocklist','--disable-gpu-vsync','--disable-frame-rate-limit']});
try{
 for(const state of ['lobby','about','projects','experience','writing','open-book'])for(const version of ['before','after','after','before']){
  const room=state==='open-book'?'writing':state,ctx=await b.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1,reducedMotion:'no-preference'}),p=await ctx.newPage(),errors=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});p.on('requestfailed',r=>streamAbort(r) || errors.push(r.url()));
  const url=new URL(version==='before'?old:now);url.pathname=ROOM_PATH[room];url.search=new URLSearchParams({shot:'hero',tier:1,scale:1,rollat:0,chand:0});await p.goto(url.href);
  await p.waitForFunction(r=>window.__lobby?.mode().room===r&&document.querySelector('#loader.done'),room,{timeout:150000});
  if(state==='open-book'){await p.evaluate(()=>{const l=window.__lobby;l.setFocus(l.picks.find(x=>x.options));});await p.locator('button[data-option="1"]').click();
   await p.waitForFunction(()=>{let n=0;window.__lobby.scene.traverseVisible(o=>{if(o.morphTargetInfluences?.[0]>.97)n++;});return n===2;},null,{timeout:90000});}
  const r=await p.evaluate(async n=>{const l=window.__lobby,R=l.renderer,gl=R.getContext(),px=new Uint8Array(4),dt=[],ext=gl.getExtension('WEBGL_debug_renderer_info');
   let last=0;for(let i=0;i<n+90;i++){await new Promise(requestAnimationFrame);gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);const t=performance.now();if(i>=90)dt.push(t-last);last=t;}
   dt.sort((a,b)=>a-b);const f=k=>+dt[Math.floor(k*dt.length)].toFixed(2);return {frames:n,medianMs:f(.5),p95Ms:f(.95),calls:R.info.render.calls,drawnTriangles:R.info.render.triangles,textureCount:R.info.memory.textures,gpu:ext&&gl.getParameter(ext.UNMASKED_RENDERER_WEBGL),mode:l.mode()};},+frames);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({state,version,...r}));await ctx.close();
 }
}finally{await b.close();}
