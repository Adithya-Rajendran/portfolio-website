// Self-test of passes.mjs and bench.mjs: a plain page fails at once with the switches named, the pinned hero page gives GPU ms
import { spawnSync } from 'node:child_process';

const origin = (process.env.ORIGIN || 'http://127.0.0.1:8080').replace(/\/$/, '');
const PINNED = '/?shot=hero&tier=0&scale=1';
let bad = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok' : 'FAIL'} [${name}] ${extra}`); if (!ok) bad = 1; };
const run = (script, args, limit, kill = limit) => {
  const t = Date.now();
  const r = spawnSync('node', [script, ...args], { encoding: 'utf8', timeout: kill * 1000, env: { ...process.env, MEASURE_TIMEOUT_S: String(limit) } });
  return { ...r, s: (Date.now() - t) / 1000, text: `${r.stdout}${r.stderr}` };
};
const json = (r) => { try { return JSON.parse(r.stdout.trim().split('\n').filter((l) => l.startsWith('{')).pop()); } catch { return null; } };

for (const [script, args] of [['passes.mjs', [origin + '/', 2]], ['bench.mjs', [origin + '/', 1920, 1080, 2, 1]]]) {
  const r = run(script, args, 90);
  check(`${script} plain page fails`, r.status === 1, `exit ${r.status} in ${r.s.toFixed(1)} s`);
  check(`${script} plain page names the switches`, /tier=0/.test(r.text) && /scale=1/.test(r.text) && /not pinned/.test(r.text), r.text.trim().split('\n').pop().slice(0, 160));
  check(`${script} plain page is quick`, r.s < 60, `${r.s.toFixed(1)} s`);
}

const p = run('passes.mjs', [origin + PINNED, 4], 150), pj = json(p);
check('passes.mjs pinned hero gives GPU ms', p.status === 0 && pj?.gpu_sum > 0.1, `gpu_sum ${pj?.gpu_sum} frame_med ${pj?.frame_med}`);
const b = run('bench.mjs', [origin + PINNED, 1920, 1080, 4, 1], 150), bj = json(b);
check('bench.mjs pinned hero gives GPU ms', b.status === 0 && bj?.gpu > 0, `gpu ${bj?.gpu} med ${bj?.med}`);

const h = run('measure-hang.mjs', [], 3, 30);
check('the deadline stops a hung run', h.status === 3 && h.s < 30, `exit ${h.status} in ${h.s.toFixed(1)} s`);
process.exit(bad);
