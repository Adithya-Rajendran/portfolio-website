import test from 'node:test';
import assert from 'node:assert/strict';
import { Governor, loadRoomMode, saveRoomMode, storageKey } from '../public/js/governor.js';

function simulateTrace(gov, frames) {
  let elapsed = 0;
  const changes = [];
  for (const f of frames) {
    const dtMs = typeof f === 'number' ? f : f.dtMs;
    const gpuMs = typeof f === 'number' ? null : (f.gpuMs ?? null);
    elapsed += dtMs;
    if (gov.update(dtMs, gpuMs)) {
      changes.push({ t: elapsed, tier: gov.tier, scale: gov.scale });
    }
  }
  return { elapsed, changes };
}

test('steady fast 60fps stream stays at tier 0, scale 1 in both GPU and dt modes', () => {
  for (const hasGpuTimer of [true, false]) {
    const gov = new Governor({ min: 0.5, max: 1, hasGpuTimer });
    gov.rest(400);
    const frames = Array.from({ length: 1800 }, () => ({
      dtMs: 16.67,
      gpuMs: hasGpuTimer ? 9.5 : null,
    }));
    const { changes } = simulateTrace(gov, frames);
    assert.equal(changes.length, 0);
    assert.equal(gov.tier, 0);
    assert.equal(gov.scale, 1);
  }
});

test('steady slow HD 630 GPU traces for all 6 rooms settle <= 6s and hold >= 20s', () => {
  // HD 630 room profiles from docs/program-plan.md §2.2-2.3 (with O4a on projects & experience).
  // Model: fixed vertex/shadow/cube overhead ~4 ms + pixel-bound portion scaling with scale^2.
  const rooms = [
    { id: 'lobby', t0: 42.5, t1: 31.6, fixed: 4.5 },
    { id: 'about', t0: 30.8, t1: 25.4, fixed: 4.0 },
    { id: 'projects', t0: 36.0, t1: 26.8, fixed: 4.0 },
    { id: 'experience', t0: 26.0, t1: 19.5, fixed: 3.5 },
    { id: 'writing', t0: 64.4, t1: 51.4, fixed: 5.0 },
    { id: 'comms', t0: 22.1, t1: 20.6, fixed: 3.5 },
  ];

  for (const r of rooms) {
    const gov = new Governor({ min: 0.5, max: 1, hasGpuTimer: true });
    gov.rest(400);
    let t = 0;
    let lastChangeT = 0;
    const changes = [];
    const gpuFor = (tier, scale) => {
      const base = tier === 0 ? r.t0 : r.t1;
      return r.fixed + (base - r.fixed) * (scale * scale);
    };

    while (t < 27000) {
      const gpu = gpuFor(gov.tier, gov.scale);
      const dtMs = Math.max(16.67, Math.ceil(gpu / 16.67) * 16.67);
      t += dtMs;
      if (gov.update(dtMs, gpu)) {
        lastChangeT = t;
        changes.push({ t, tier: gov.tier, scale: gov.scale, gpu });
      }
    }

    const finalGpu = gpuFor(gov.tier, gov.scale);
    assert.ok(changes.length > 0, `${r.id}: expected adaptation`);
    assert.ok(lastChangeT <= 6000, `${r.id}: settled at ${lastChangeT} ms (> 6000 ms)`);
    const changesInHold = changes.filter((c) => c.t > 6000 && c.t <= 26000);
    assert.equal(changesInHold.length, 0, `${r.id}: changed in [6s, 26s]: ${JSON.stringify(changesInHold)}`);
    assert.ok(
      finalGpu <= 15.5 || gov.scale <= gov.min + 1e-6,
      `${r.id}: finalGpu=${finalGpu.toFixed(2)} ms at tier=${gov.tier} scale=${gov.scale}`,
    );
  }
});

test('dt fallback adapts smoothly when GPU timer is absent on steady slow frames', () => {
  const gov = new Governor({ min: 0.5, max: 1, hasGpuTimer: false });
  gov.rest(400);
  let t = 0;
  let lastChangeT = 0;
  const changes = [];
  // Simulated un-vsynced slow frames where frame time scales down with resolution
  while (t < 27000) {
    const base = gov.tier === 0 ? 48 : 34;
    const dtMs = 5 + (base - 5) * (gov.scale * gov.scale);
    t += dtMs;
    if (gov.update(dtMs, null)) {
      lastChangeT = t;
      changes.push({ t, tier: gov.tier, scale: gov.scale });
    }
  }
  assert.ok(changes.length > 0);
  assert.ok(lastChangeT <= 6000, `dt fallback settled at ${lastChangeT} ms`);
  assert.equal(changes.filter((c) => c.t > 6000 && c.t <= 26000).length, 0);
});

test('bursty overload (C.jsonl 16.7ms x 10 + 400..683ms stalls) triggers adaptation in dt mode', () => {
  const gov = new Governor({ min: 0.5, max: 1, hasGpuTimer: false });
  gov.rest(400);
  const frames = [];
  for (let i = 0; i < 60; i++) {
    for (let j = 0; j < 10; j++) frames.push(16.7);
    frames.push(i % 2 === 0 ? 400 : 683.3);
  }
  const { changes } = simulateTrace(gov, frames);
  assert.ok(changes.length >= 1, 'expected adaptation on sustained bursty stalls');
  assert.ok(gov.tier === 1 || gov.scale < 1);
  assert.ok(changes[0].t <= 4000, `bursty first reaction at ${changes[0].t} ms`);
});

test('fast bursty pacing ([4, 4, 4, 40] ms) does not downgrade needlessly', () => {
  const gov = new Governor({ min: 0.5, max: 1, hasGpuTimer: true });
  gov.rest(400);
  const frames = [];
  for (let i = 0; i < 300; i++) {
    frames.push({ dtMs: 4, gpuMs: 8 }, { dtMs: 4, gpuMs: 8 }, { dtMs: 4, gpuMs: 8 }, { dtMs: 40, gpuMs: 8 });
  }
  const { changes } = simulateTrace(gov, frames);
  assert.equal(changes.length, 0);
  assert.equal(gov.tier, 0);
  assert.equal(gov.scale, 1);
});

test('isolated hitch (single 180-900 ms spike) and single GPU spike are ignored', () => {
  for (const spike of [180, 350, 900]) {
    const gov = new Governor({ min: 0.5, max: 1, hasGpuTimer: false });
    gov.rest(400);
    const frames = [
      ...Array(80).fill(16.67),
      spike,
      ...Array(120).fill(16.67),
    ];
    const { changes } = simulateTrace(gov, frames);
    assert.equal(changes.length, 0, `isolated ${spike} ms hitch must not change mode`);
  }

  // Single GPU spike amidst fast frames is ignored by median filter
  const govGpu = new Governor({ min: 0.5, max: 1, hasGpuTimer: true });
  govGpu.rest(400);
  const gpuFrames = [
    ...Array(40).fill({ dtMs: 16.67, gpuMs: 10 }),
    { dtMs: 16.67, gpuMs: 80 },
    ...Array(40).fill({ dtMs: 16.67, gpuMs: 10 }),
  ];
  const { changes } = simulateTrace(govGpu, gpuFrames);
  assert.equal(changes.length, 0);
});

test('tab switch (> 1000 ms pause) is ignored and does not burn warm rest or trigger downgrade', () => {
  const gov = new Governor({ min: 0.5, max: 1, hasGpuTimer: false });
  gov.rest(400);
  // Tab switch during warm rest must not consume warm
  assert.equal(gov.update(5000), false);
  assert.equal(gov.warm, 400);

  // Burn warm normally, then inject tab switches mid-stream
  const frames = [
    ...Array(60).fill(16.67),
    3500,
    ...Array(60).fill(16.67),
    15000,
    ...Array(60).fill(16.67),
  ];
  const { changes } = simulateTrace(gov, frames);
  assert.equal(changes.length, 0);
  assert.equal(gov.tier, 0);
  assert.equal(gov.scale, 1);
});

test('upgrade backoff doubles on rapid re-downgrade up to 120000 ms', () => {
  const gov = new Governor({ min: 0.5, max: 1, hasGpuTimer: true });
  gov.rest(0);

  // Initial downgrade
  for (let i = 0; i < 30 && gov.scale === 1 && gov.tier === 0; i++) gov.update(16.67, 25);
  assert.equal(gov.tier, 1);
  assert.equal(gov.backoffMs, 28000);
  assert.equal(gov.upgradeCool, 28000);

  // Scale down once and let window settle
  for (let i = 0; i < 60; i++) gov.update(16.67, 25);
  assert.ok(gov.scale < 1);
  // Wait out initial upgradeCool (28s) with fast GPU, triggering an upgrade
  let upgraded = false;
  for (let i = 0; i < 2000; i++) {
    const prev = gov.scale;
    if (gov.update(16.67, 8) && gov.scale > prev) {
      upgraded = true;
      break;
    }
  }
  assert.ok(upgraded, 'expected scale upgrade after upgradeCool');

  // Immediate overload after upgrade -> backoff doubles to 56000 ms
  let redowngraded = false;
  for (let i = 0; i < 60; i++) {
    if (gov.update(16.67, 25)) {
      redowngraded = true;
      break;
    }
  }
  assert.ok(redowngraded);
  assert.equal(gov.backoffMs, 56000);
  assert.equal(gov.upgradeCool, 56000);
});

test('URL query pins (?scale=, ?tier=) stay exact individually and together', () => {
  // Only scale pinned: tier can adapt, scale never moves
  const scaleOnly = new Governor({ min: 0.5, max: 1, pinned: 0.83, tierPinned: false, tier: 0 });
  scaleOnly.reset({ tier: 0, scale: 0.6, warm: 0 });
  assert.equal(scaleOnly.scale, 0.83);
  for (let i = 0; i < 60; i++) scaleOnly.update(16.67, 40);
  assert.equal(scaleOnly.tier, 1);
  assert.equal(scaleOnly.scale, 0.83);

  // Only tier pinned: scale can adapt, tier never moves
  const tierOnly = new Governor({ min: 0.5, max: 1, pinned: null, tierPinned: true, tier: 0 });
  tierOnly.reset({ tier: 1, scale: 1, warm: 0 });
  assert.equal(tierOnly.tier, 0);
  for (let i = 0; i < 60; i++) tierOnly.update(16.67, 40);
  assert.equal(tierOnly.tier, 0);
  assert.ok(tierOnly.scale < 1);

  // Both pinned: neither changes
  const both = new Governor({ min: 0.5, max: 1, pinned: 0.9, tierPinned: true, tier: 0 });
  assert.equal(both.allPinned, true);
  for (let i = 0; i < 60; i++) assert.equal(both.update(50, 50), false);
  assert.equal(both.tier, 0);
  assert.equal(both.scale, 0.9);
});

test('localStorage helpers handle valid data, corrupt JSON, out-of-range values, and SecurityError/quota', () => {
  const map = new Map();
  const memStorage = {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => map.set(k, String(v)),
  };

  assert.equal(saveRoomMode(memStorage, 'lobby', { tier: 1, scale: 0.675 }), true);
  assert.deepEqual(loadRoomMode(memStorage, 'lobby'), { tier: 1, scale: 0.675 });

  // Corrupt JSON
  map.set(storageKey('about'), '{not-json');
  assert.equal(loadRoomMode(memStorage, 'about'), null);

  // Wrong schema version / tier / out-of-range scale
  map.set(storageKey('projects'), JSON.stringify({ v: 2, tier: 1, scale: 0.7 }));
  assert.equal(loadRoomMode(memStorage, 'projects'), null);
  map.set(storageKey('projects'), JSON.stringify({ v: 1, tier: 2, scale: 0.7 }));
  assert.equal(loadRoomMode(memStorage, 'projects'), null);
  map.set(storageKey('projects'), JSON.stringify({ v: 1, tier: 1, scale: 0.2 }));
  assert.equal(loadRoomMode(memStorage, 'projects'), null);
  map.set(storageKey('projects'), JSON.stringify({ v: 1, tier: 1, scale: 1.5 }));
  assert.equal(loadRoomMode(memStorage, 'projects'), null);

  // SecurityError / QuotaExceededError
  const throwingStorage = {
    getItem() { throw new Error('SecurityError'); },
    setItem() { throw new Error('QuotaExceededError'); },
  };
  assert.equal(loadRoomMode(throwingStorage, 'lobby'), null);
  assert.equal(saveRoomMode(throwingStorage, 'lobby', { tier: 1, scale: 0.7 }), false);
  assert.equal(loadRoomMode(null, 'lobby'), null);
  assert.equal(saveRoomMode(null, 'lobby', { tier: 1, scale: 0.7 }), false);
});

test('D10 invariant: Governor only tracks and mutates tier and scale (never reflection or mirror flags)', () => {
  const gov = new Governor({ min: 0.5, max: 1, hasGpuTimer: true });
  const keys = Object.keys(gov);
  for (const forbidden of ['mirror', 'reflection', 'reflScale', 'skipMirror', 'noMirror']) {
    assert.equal(keys.includes(forbidden), false);
    assert.equal(gov[forbidden], undefined);
  }
});
