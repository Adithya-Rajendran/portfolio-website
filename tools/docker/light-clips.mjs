// Short films of the packed renderer
import {chromium} from 'playwright';import {spawn} from 'node:child_process';import {once} from 'node:events';
import { ROOM_PATH } from './roompath.mjs';
import {mkdir,writeFile} from 'node:fs/promises';import assert from 'node:assert/strict';
import { streamAbort } from './reqfail.mjs';
const [base,out,ffmpeg,only]=process.argv.slice(2);await mkdir(out,{recursive:true});
const browser=await chromium.launch({args:['--use-angle=gl-egl','--enable-gpu','--ignore-gpu-blocklist']});
try {
  const p=await browser.newPage({viewport:{width:960,height:540},reducedMotion:'no-preference'});const errors=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});p.on('requestfailed',r=>streamAbort(r) || errors.push(r.url()));
  for(const [room,name] of [['experience','moving-eye'],['about','moving-sun']]){
    if(only && only!==room)continue;const u=new URL(base);u.pathname=ROOM_PATH[room];u.search=new URLSearchParams({shot:'hero',lightcheck:1,tier:0,scale:1,chand:0,roll:120,grain:0});await p.goto(u.href);
    await p.waitForFunction(r=>window.__lobby?.mode().room===r&&document.querySelector('#loader.done'),room,{timeout:150000});
    const frames=await p.evaluate(r=>{const l=window.__lobby,frames=[];for(let i=0;i<96;i++){
      const f=i/95,s=f*f*(3.-2.*f);if(r==='experience')l.lightFrame([-1.75+3.35*s,1.67-.16*s,4.93-.19*s],[0,1.10,1.03],6);
      else l.lightFrame([-.35,1.68,3.52],[0,.92,-2.25],s*18);
      frames.push(l.renderer.domElement.toDataURL('image/jpeg',.95).split(',')[1]);
    }return frames;},room);
    const bytes=frames.map(s=>Buffer.from(s,'base64'));await writeFile(`${out}/${name}.jpg`,bytes[0]);
    const enc=spawn(ffmpeg,['-loglevel','error','-y','-f','image2pipe','-c:v','mjpeg','-r','24','-i','pipe:0','-an','-c:v','libvpx-vp9','-b:v','0','-crf','28','-deadline','good','-cpu-used','5','-pix_fmt','yuv420p',`${out}/${name}.webm`],{stdio:['pipe','ignore','inherit']});
    const end=once(enc,'close');for(const f of bytes)if(!enc.stdin.write(f))await once(enc.stdin,'drain');enc.stdin.end();assert.equal((await end)[0],0);console.log(`${name}: 96 packed frames at 24 fps`);
  }
  assert.deepEqual(errors,[]);
} finally {await browser.close();}
