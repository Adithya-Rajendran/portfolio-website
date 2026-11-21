// Photograph the same lit tabletop in two REAL releases. No lighting uniforms are overridden.
// node grazing.mjs BEFORE_ORIGIN AFTER_ORIGIN shots/diagnostics
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const [before,after,out]=process.argv.slice(2),errors=[];
await mkdir(out,{recursive:true});
const browser=await chromium.launch({args:['--use-angle=gl-egl','--enable-gpu','--ignore-gpu-blocklist']});
try {
  const p=await browser.newPage({viewport:{width:1100,height:740}});
  p.on('pageerror',e=>errors.push(e.message)); p.on('requestfailed',r=>errors.push(r.url()));
  p.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);}); p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  for(const [name,base] of [['before',before],['after',after]]){
    const url=new URL(base);url.search=new URLSearchParams({room:'about',lightcheck:1,rollat:0,tier:1,scale:1,shot:'hero',grain:0});
    await p.goto(url.href);await p.waitForFunction(()=>window.__lobby?.mode().room==='about'&&document.querySelector('#loader.done'),null,{timeout:120000});
    const pixels=await p.evaluate(()=>{const l=window.__lobby,pose=l.picks.find(q=>!q.door&&q.mesh.geometry.type==='SphereGeometry').pose();
      l.lightFrame(pose.pos.clone().lerp(pose.tgt,.48).toArray(),pose.tgt.toArray(),0);return l.renderer.domElement.toDataURL().split(',')[1];});
    await writeFile(`${out}/grazing-${name}.png`,Buffer.from(pixels,'base64'));
  }
  assert.deepEqual(errors,[]);
} finally { await browser.close(); }
