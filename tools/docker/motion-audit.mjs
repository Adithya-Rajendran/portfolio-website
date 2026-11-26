// Sample the running site without instrumenting its frame loop. Usage: node motion-audit.mjs URL
// Count local, not world, transform changes: 3 blades following one rotor are not 3 mechanisms.
import { chromium } from 'playwright';
import { ROOM_PATH } from './roompath.mjs';
import { streamAbort } from './reqfail.mjs';
const base = process.argv[2];
const browser = await chromium.launch({args:['--use-angle=gl-egl','--enable-gpu','--ignore-gpu-blocklist']});
try {
  const page = await browser.newPage({viewport:{width:960,height:540},reducedMotion:'no-preference'});
  const errors=[];
  page.on('console',m=>{if(m.type()==='error') errors.push(m.text());});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('requestfailed',r=>streamAbort(r) || errors.push(`${r.failure()?.errorText} ${r.url()}`));
  page.on('response',r=>{if(r.status()>=400) errors.push(`${r.status()} ${r.url()}`);});
  const sample = (delivery=false) => page.evaluate(async delivery => {
    const seen=new Map(), moved=new Set(), bent=new Set();
    let frames=0, elapsed=0; const start=performance.now();
    do {
      await new Promise(requestAnimationFrame);
      const {scene}=window.__lobby, nodes=new Set();
      scene.traverseVisible(o=>{
        if(!o.geometry || !o.material || !(Array.isArray(o.material)?o.material:[o.material]).some(m=>m.visible)) return;
        for(let n=o;n && n!==scene;n=n.parent) nodes.add(n);
      });
      for(const n of nodes){
        const tr=[...n.position,...n.quaternion,...n.scale], morph=[...(n.morphTargetInfluences||[])], prev=seen.get(n);
        if(prev && tr.some((v,i)=>Math.abs(v-prev.tr[i])>1e-7)) moved.add(n);
        if(prev && morph.some((v,i)=>Math.abs(v-prev.morph[i])>1e-7)) bent.add(n);
        seen.set(n,{tr,morph});
      }
      frames++; elapsed=performance.now()-start;
    } while(delivery ? bent.size===0 && elapsed<40000 : frames<30 && elapsed<10000);
    if(frames<2 || (delivery && !bent.size)) throw new Error('Expected multiple frames and, on delivery, an opening page');
    return {frames,elapsedMs:Math.round(elapsed),nodesSeen:seen.size,localTransforms:moved.size,morphing:bent.size};
  },delivery);
  for(const room of ['lobby','about','projects','experience','writing']){
    const u=new URL(base); u.pathname=ROOM_PATH[room];u.search=new URLSearchParams({shot:'hero',tier:1,scale:.7});
    await page.goto(u.href);
    await page.waitForFunction(id=>window.__lobby?.mode().room===id && document.querySelector('#loader.done'),room,{timeout:120000});
    await page.waitForTimeout(600);
    const idle=await sample(); console.log(JSON.stringify({room,phase:'idle',...idle}));
    if(room==='writing'){
      await page.evaluate(()=>{const l=window.__lobby;l.setFocus(l.picks.find(p=>p.options));});
      await page.click('#ways button[data-option="1"]');
      console.log(JSON.stringify({room,phase:'request to page opening',...await sample(true)}));
    }
  }
  if(errors.length) throw new Error(errors.join('\n'));
} finally { await browser.close(); }
