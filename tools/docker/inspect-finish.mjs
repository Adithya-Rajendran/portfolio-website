// Captures of bookshelf and table interaction poses in the packed site, without the HTML overlay
import {chromium} from 'playwright';
import { ROOM_PATH } from './roompath.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import { streamAbort } from './reqfail.mjs';
const [base,out,...selected]=process.argv.slice(2), errors=[];
await mkdir(out,{recursive:true});
const b=await chromium.launch({args:['--use-angle=gl-egl','--enable-gpu','--ignore-gpu-blocklist']});
try {
  const p=await b.newPage({viewport:{width:1440,height:900},reducedMotion:'no-preference'});
  p.on('pageerror',e=>errors.push(e.message));p.on('requestfailed',r=>streamAbort(r) || errors.push(r.url()));
  p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});p.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  for(const room of selected.length?selected:['about','projects','writing']){
    const u=new URL(base);u.pathname=ROOM_PATH[room];u.search=new URLSearchParams({shot:'hero',scale:1,tier:0,lightcheck:1,grain:0,rollat:0,chand:0});await p.goto(u.href);
    await p.waitForFunction(r=>window.__lobby?.mode().room===r&&document.querySelector('#loader.done'),room,{timeout:150000});
    const count=await p.evaluate(r=>{const l=window.__lobby, choice=r==='writing'?l.picks.find(q=>q.options?.length):l.picks.filter(q=>!q.door&&q.mesh.geometry.type==='SphereGeometry').at(-1);
      if(!choice)throw new Error(`Missing actual inspect target in ${r}`);l.setFocus(choice);window.__reviewPick=choice;return choice.options?.length;
    },room);
    if(room==='writing'){
      assert.equal(count,5);await p.locator('#ways button[data-option="1"]').click();
      await p.waitForFunction(()=>{let n=0;window.__lobby.scene.traverseVisible(o=>{if(o.morphTargetInfluences?.[0]>.96)n++;});return n===2;},null,{timeout:90000});
    }
    const result=await p.evaluate(r=>{const l=window.__lobby,pose=window.__reviewPick.pose(),t=18,save=eye=>{l.lightFrame(eye.toArray(),pose.tgt.toArray(),t);return l.renderer.domElement.toDataURL('image/png').split(',')[1];};
      const captures={[r+'-inspect']:save(pose.pos)};
      if(r==='about')captures['about-detail']=save(pose.pos.clone().lerp(pose.tgt,.48));
      return captures;},room);
    for(const [name,buffer] of Object.entries(result)){await writeFile(`${out}/${name}.png`,Buffer.from(buffer,'base64'));console.log('captured',name);}
  }
  assert.deepEqual(errors,[]);
} finally {await b.close();}
