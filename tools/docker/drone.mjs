// Library end to end: the two actual requested volumes open, then Escape sends the empty drone home.
// node drone.mjs 'http://HOST/?room=writing' /out
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const [url, out] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=gl-egl', '--enable-gpu', '--ignore-gpu-blocklist'] });
try {
const p = await b.newPage({ viewport: { width: 1600, height: 900 } }), errors=[];
p.on('pageerror', e=>errors.push(e.message)); p.on('console', m=>{if(m.type()==='error')errors.push(m.text());});
p.on('requestfailed', r=>errors.push(r.url())); p.on('response', r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
await p.goto(url); await p.waitForFunction(() => window.__lobby?.ready() >= 1, null, { timeout: 120000 }); await p.waitForTimeout(1500);
const i = await p.evaluate(() => { const L = window.__lobby, i = L.picks.findIndex((q) => q.options); L.setFocus(L.picks[i]); return i; });
console.log('terminal is pick', i, 'buttons', await p.$$eval('#ways button', (bs) => bs.map((x) => x.textContent)));
assert.equal(await p.locator('#ways button[data-option]').count(),5);
await p.evaluate(()=>{const root=window.__lobby.scene.getObjectByName('Catalogue drone'), dock=root.position.clone(),books=[];
  root.traverse(o=>{if(typeof o.userData.open==='function')books.push(o);}); if(books.length!==5)throw new Error(`Expected five bound volumes, found ${books.length}`);
  window.__volumeState=()=>{const visible=books.filter(o=>o.visible);let pages=0;root.traverseVisible(o=>{if(o.morphTargetInfluences?.[0]>.97)pages++;});
    return {volume:visible.length===1?books.indexOf(visible[0]):-1,count:visible.length,pages,dockError:root.position.distanceTo(dock)};};});
const delivered=k=>p.waitForFunction(which=>{const s=window.__volumeState();return s.volume===which&&s.count===1&&s.pages===2;},k,{timeout:90000});
await p.waitForTimeout(2500); await p.screenshot({ path: `${out}/drone0.png` });
await p.click('#ways button[data-option="1"]');
for (const [k, ms] of [[1,1500],[2,2500]]) { await p.waitForTimeout(ms); await p.screenshot({path:`${out}/drone${k}.png`}); }
await delivered(1); console.log('Presented 02',await p.evaluate(()=>window.__volumeState())); await p.screenshot({path:`${out}/drone3.png`});
await p.click('#ways button[data-option="3"]'); await delivered(3); console.log('Replaced with 04',await p.evaluate(()=>window.__volumeState())); await p.screenshot({path:`${out}/drone4.png`});
await p.keyboard.press('Escape'); await p.waitForFunction(()=>{const s=window.__volumeState();return s.count===0&&s.dockError<.006&&document.querySelector('#inspectbar').hidden;},null,{timeout:90000});
console.log('Back at cradle',await p.evaluate(()=>window.__volumeState())); await p.screenshot({path:`${out}/drone5.png`}); assert.deepEqual(errors,[]);
} finally { await b.close(); }
