// Unit tests for the adaptive quality governor and its per-room mode storage (node --test).
import test from 'node:test';
import assert from 'node:assert/strict';
import { Governor, loadRoomMode, saveRoomMode, storageKey } from '../src/engine/governor.js';

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
  assert.equal(gov.update(5000), false);
  assert.equal(gov.warm, 400);

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

test('dt fallback: upgrade backoff doubles on rapid re-downgrade up to 120000 ms', () => {
  const gov = new Governor({ min: 0.5, max: 1, hasGpuTimer: false });
  gov.rest(0);

  for (let i = 0; i < 30 && gov.scale === 1 && gov.tier === 0; i++) gov.update(30);
  assert.equal(gov.tier, 1);
  assert.equal(gov.backoffMs, 28000);
  assert.equal(gov.upgradeCool, 28000);

  let upgraded = false;
  for (let i = 0; i < 2000; i++) {
    const prev = gov.scale;
    if (gov.update(16.67) && gov.scale > prev) {
      upgraded = true;
      break;
    }
  }
  assert.ok(upgraded, 'expected scale upgrade after upgradeCool');

  let redowngraded = false;
  for (let i = 0; i < 60; i++) {
    if (gov.update(30)) {
      redowngraded = true;
      break;
    }
  }
  assert.ok(redowngraded);
  assert.equal(gov.backoffMs, 56000);
  assert.equal(gov.upgradeCool, 56000);
});

test('GPU timer: re-overload right after an upgrade caps the scale below it and doubles the backoff', () => {
  const gov = new Governor({ min: 0.5, max: 1, hasGpuTimer: true });
  gov.rest(0);

  for (let i = 0; i < 30 && gov.tier === 0; i++) gov.update(16.67, 25);
  assert.equal(gov.tier, 1);
  assert.equal(gov.scale, 1);
  for (let i = 0; i < 60 && gov.scale === 1; i++) gov.update(16.67, 25);
  assert.ok(gov.scale < 1);
  assert.equal(gov.capScale, null, 'a first overload sets no cap');

  let upgradedAt = null;
  for (let i = 0; i < 600; i++) {
    const prev = gov.scale;
    if (gov.update(16.67, 8) && gov.scale > prev) {
      upgradedAt = i * 16.67;
      break;
    }
  }
  assert.ok(upgradedAt !== null && upgradedAt <= 3000, `upgrade after ${upgradedAt} ms`);
  const upgradedTo = gov.scale;

  let redowngraded = false;
  for (let i = 0; i < 60; i++) {
    if (gov.update(16.67, 25)) {
      redowngraded = true;
      break;
    }
  }
  assert.ok(redowngraded);
  assert.equal(gov.backoffMs, 56000);
  assert.equal(gov.capScale, upgradedTo);
  assert.equal(gov.capMs, 56000);

  for (let i = 0; i < 1200; i++) gov.update(16.67, 8);
  assert.ok(gov.scale <= upgradedTo * 0.97 + 1e-9, `scale ${gov.scale} passed the cap ${upgradedTo}`);
});

test('URL query pins (?scale=, ?tier=) stay exact individually and together', () => {
  const scaleOnly = new Governor({ min: 0.5, max: 1, pinned: 0.83, tierPinned: false, tier: 0 });
  scaleOnly.reset({ tier: 0, scale: 0.6, warm: 0 });
  assert.equal(scaleOnly.scale, 0.83);
  for (let i = 0; i < 60; i++) scaleOnly.update(16.67, 40);
  assert.equal(scaleOnly.tier, 1);
  assert.equal(scaleOnly.scale, 0.83);

  const tierOnly = new Governor({ min: 0.5, max: 1, pinned: null, tierPinned: true, tier: 0 });
  tierOnly.reset({ tier: 1, scale: 1, warm: 0 });
  assert.equal(tierOnly.tier, 0);
  for (let i = 0; i < 60; i++) tierOnly.update(16.67, 40);
  assert.equal(tierOnly.tier, 0);
  assert.ok(tierOnly.scale < 1);

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
  assert.deepEqual(loadRoomMode(memStorage, 'lobby'), { tier: 0, scale: 0.675 });

  map.set(storageKey('about'), '{not-json');
  assert.equal(loadRoomMode(memStorage, 'about'), null);

  map.set(storageKey('projects'), JSON.stringify({ v: 2, tier: 1, scale: 0.7 }));
  assert.equal(loadRoomMode(memStorage, 'projects'), null);
  map.set(storageKey('projects'), JSON.stringify({ v: 1, tier: 2, scale: 0.7 }));
  assert.equal(loadRoomMode(memStorage, 'projects'), null);
  map.set(storageKey('projects'), JSON.stringify({ v: 1, tier: 1, scale: 0.2 }));
  assert.equal(loadRoomMode(memStorage, 'projects'), null);
  map.set(storageKey('projects'), JSON.stringify({ v: 1, tier: 1, scale: 1.5 }));
  assert.equal(loadRoomMode(memStorage, 'projects'), null);

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

test('delayed-load about-like pullback trace (3s cheap close -> heavy hero) settles <= 6s with 0 changes in [6s, 26s]', () => {
  const gov = new Governor({ min: 0.5, max: 1, hasGpuTimer: true });
  gov.reset({ tier: 0, scale: 1, warm: 600 });
  let t = 0;
  let lastChangeT = 0;
  const changes = [];

  while (t < 27000) {
    const u = Math.max(0, Math.min(1, (t - 1200) / 5500));
    const view = 1 - u;
    const e = view * view * view * (view * (view * 6 - 15) + 10);
    const closeGpu = gov.tier === 0 ? 11.2 : 10.6;
    const heroGpu = gov.tier === 0 ? 30.8 : 25.4;
    const heroScaled = 8.4 + (heroGpu - 8.4) * (gov.scale * gov.scale);
    const gpu = closeGpu * e + heroScaled * (1 - e);
    const dtMs = Math.max(16.67, Math.ceil(gpu / 16.67) * 16.67);
    t += dtMs;
    if (gov.update(dtMs, gpu)) {
      lastChangeT = t;
      changes.push({ t, tier: gov.tier, scale: gov.scale, gpu });
    }
  }

  assert.ok(changes.length > 0, 'expected adaptation during delayed pullback');
  assert.ok(lastChangeT <= 6000, `delayed-load settled at ${lastChangeT} ms (> 6000 ms)`);
  const changesInHold = changes.filter((c) => c.t > 6000 && c.t <= 26000);
  assert.equal(changesInHold.length, 0, `changed in [6s, 26s]: ${JSON.stringify(changesInHold)}`);
});

test('comms-like dt-fallback periodic queue-stall trace converges <= 6s with 0 changes in [6s, 26s]', () => {
  const gov = new Governor({ min: 0.5, max: 1, hasGpuTimer: false });
  gov.reset({ tier: 0, scale: 1, warm: 600 });
  let t = 0;
  let lastChangeT = 0;
  const changes = [];
  let sinceStall = 0;

  while (t < 27000) {
    let dtMs = 16.67;
    const overloaded = t >= 2500 && (gov.tier === 0 || gov.scale >= 0.8);
    if (overloaded) {
      sinceStall += dtMs;
      if (sinceStall >= 850) {
        dtMs = 225;
        sinceStall = 0;
      }
    } else {
      sinceStall = 0;
    }
    t += dtMs;
    if (gov.update(dtMs, null)) {
      lastChangeT = t;
      changes.push({ t, tier: gov.tier, scale: gov.scale });
    }
  }

  assert.ok(changes.length >= 1, `expected tier and scale adaptation, got ${JSON.stringify(changes)}`);
  assert.ok(lastChangeT <= 6000, `comms dt fallback settled at ${lastChangeT} ms (> 6000 ms)`);
  assert.equal(changes.filter((c) => c.t > 6000 && c.t <= 26000).length, 0);
  assert.equal(gov.tier, 1);
  assert.ok(gov.scale < 0.8, `expected scale < 0.8, got ${gov.scale}`);
});

test('settled mode does not reset settledMs or cascade on 14.8ms post-downgrade load', () => {
  const gov = new Governor({ min: 0.5, max: 1, hasGpuTimer: true });
  gov.reset({ tier: 1, scale: 0.85, warm: 0 });
  for (let i = 0; i < 360; i++) assert.equal(gov.update(16.67, 12), false);
  assert.ok(gov.settledMs >= 4900);

  let changes = 0;
  for (let i = 0; i < 45; i++) {
    if (gov.update(16.67, 15.8)) changes++;
  }
  assert.equal(changes, 1);
  assert.ok(gov.settledMs >= 4900, 'settledMs must remain monotonic across mode adjustments');

  let postChanges = 0;
  for (let i = 0; i < 1200; i++) {
    if (gov.update(16.67, 14.8)) postChanges++;
  }
  assert.equal(postChanges, 0, 'settled hysteresis must remain active after a downgrade');
});

test('comms late tier 0->1 + 1600ms queue-stall period in dt fallback converges <= 6s', () => {
  const gov = new Governor({ min: 0.5, max: 1, hasGpuTimer: false });
  gov.reset({ tier: 0, scale: 1, warm: 600 });
  let t = 0;
  let lastChangeT = 0;
  const changes = [];
  let sinceStall = 0;

  while (t < 27000) {
    let dtMs = 16.67;
    if (t >= 3100) {
      if (gov.tier === 0) {
        sinceStall += dtMs;
        if (sinceStall >= 800) {
          dtMs = 240;
          sinceStall = 0;
        }
      } else if (gov.scale >= 0.8) {
        sinceStall += dtMs;
        if (sinceStall >= 1600) {
          dtMs = 240;
          sinceStall = 0;
        }
      } else {
        sinceStall = 0;
      }
    }
    t += dtMs;
    if (gov.update(dtMs, null)) {
      lastChangeT = t;
      changes.push({ t, tier: gov.tier, scale: gov.scale });
      sinceStall = 0;
    }
  }

  assert.ok(changes.length >= 1, `expected adaptation, got ${JSON.stringify(changes)}`);
  assert.ok(lastChangeT <= 6000, `comms late dt fallback settled at ${lastChangeT} ms (> 6000 ms)`);
  assert.equal(changes.filter((c) => c.t > 6000 && c.t <= 26000).length, 0);
  assert.equal(gov.tier, 1);
  assert.ok(gov.scale < 0.8, `expected scale < 0.8, got ${gov.scale}`);
});

test('1000ms dt-stall cadence converges <= 6s with 0 changes in [6s, 26s]', () => {
  const gov = new Governor({ min: 0.5, max: 1, hasGpuTimer: false });
  gov.reset({ tier: 0, scale: 1, warm: 600 });
  let t = 0;
  let lastChangeT = 0;
  const changes = [];
  let sinceStall = 0;

  while (t < 27000) {
    let dtMs = 16.67;
    if (t >= 2500 && (gov.tier === 0 || gov.scale >= 0.8)) {
      sinceStall += dtMs;
      if (sinceStall >= 1000) {
        dtMs = 225;
        sinceStall = 0;
      }
    } else {
      sinceStall = 0;
    }
    t += dtMs;
    if (gov.update(dtMs, null)) {
      lastChangeT = t;
      changes.push({ t, tier: gov.tier, scale: gov.scale });
    }
  }

  assert.ok(changes.length >= 1);
  assert.ok(lastChangeT <= 6000, `1000ms dt-stall cadence settled at ${lastChangeT} ms (> 6000 ms)`);
  assert.equal(changes.filter((c) => c.t > 6000 && c.t <= 26000).length, 0);
  assert.equal(gov.tier, 1);
  assert.ok(gov.scale < 0.8, `expected scale < 0.8, got ${gov.scale}`);
});

test('dt-fallback slow-room sweep (lobby, about, experience, projects, writing) settles <= 6s', () => {
  const rooms = [
    { id: 'lobby', t0: 42.5, t1: 31.6, fixed: 4.5, closeRatio: 0.65 },
    { id: 'about', t0: 30.8, t1: 25.4, fixed: 4.0, closeRatio: 0.36 },
    { id: 'projects', t0: 36.0, t1: 26.8, fixed: 4.0, closeRatio: 0.60 },
    { id: 'experience', t0: 26.0, t1: 19.5, fixed: 3.5, closeRatio: 0.65 },
    { id: 'writing', t0: 64.4, t1: 51.4, fixed: 5.0, closeRatio: 0.70 },
  ];

  for (const r of rooms) {
    const gov = new Governor({ min: 0.5, max: 1, hasGpuTimer: false });
    gov.reset({ tier: 0, scale: 1, warm: 600 });
    let t = 0;
    let lastChangeT = 0;
    let overrun = 0;
    const changes = [];
    const gpuFor = (tier, scale, timeMs) => {
      const u = Math.max(0, Math.min(1, (timeMs - 1200) / 5500));
      const view = 1 - u;
      const e = view * view * view * (view * (view * 6 - 15) + 10);
      const base = tier === 0 ? r.t0 : r.t1;
      const heroScaled = r.fixed + (base - r.fixed) * (scale * scale);
      const closeScaled = r.fixed + (base * r.closeRatio - r.fixed) * (scale * scale);
      return closeScaled * e + heroScaled * (1 - e);
    };

    while (t < 27000) {
      const gpu = gpuFor(gov.tier, gov.scale, t);
      let dtMs = 16.67;
      if (gpu > 33.34) {
        dtMs = Math.ceil(gpu / 16.67) * 16.67;
        overrun = 0;
      } else if (gpu > 16.67) {
        overrun += gpu - 16.67;
        if (overrun >= 210) {
          dtMs = 226.67;
          overrun = 0;
        }
      } else {
        overrun = Math.max(0, overrun - (16.67 - gpu));
      }
      t += dtMs;
      if (gov.update(dtMs, null)) {
        lastChangeT = t;
        changes.push({ t, tier: gov.tier, scale: gov.scale });
      }
    }

    const finalHeroGpu = r.fixed + ((gov.tier === 0 ? r.t0 : r.t1) - r.fixed) * (gov.scale * gov.scale);
    assert.ok(changes.length >= 1, `${r.id}: expected adaptation in dt-fallback mode`);
    assert.ok(lastChangeT <= 6000, `${r.id}: dt-fallback settled at ${lastChangeT} ms (> 6000 ms)`);
    assert.equal(changes.filter((c) => c.t > 6000 && c.t <= 26000).length, 0, `${r.id}: changed in [6s, 26s]`);
    assert.ok(
      finalHeroGpu <= 16.67 || gov.scale <= gov.min + 1e-6,
      `${r.id}: finalHeroGpu=${finalHeroGpu.toFixed(2)} ms at tier=${gov.tier} scale=${gov.scale}`,
    );
  }
});

test('tier 1 fast-GPU guard (20ms tier 0 -> 14ms tier 1) keeps scale at 1.0', () => {
  const gov = new Governor({ min: 0.5, max: 1, hasGpuTimer: true });
  gov.reset({ tier: 0, scale: 1, warm: 600 });
  let t = 0;
  const changes = [];

  while (t < 27000) {
    const base = gov.tier === 0 ? 20 : 14;
    const gpu = 4 + (base - 4) * gov.scale * gov.scale;
    const dtMs = Math.max(16.67, Math.ceil(gpu / 16.67) * 16.67);
    t += dtMs;
    if (gov.update(dtMs, gpu)) {
      changes.push({ t, tier: gov.tier, scale: gov.scale, gpu });
    }
  }

  assert.equal(changes.length, 1, `expected single tier 0->1 drop, got ${JSON.stringify(changes)}`);
  assert.equal(gov.tier, 1);
  assert.equal(gov.scale, 1);
});

test('pre-settled and post-settled 180-999ms hitches and >1000ms tab switches do not downgrade', () => {
  for (const spike of [180, 251, 500, 999]) {
    const gov = new Governor({ min: 0.5, max: 1, hasGpuTimer: false });
    gov.reset({ tier: 0, scale: 1, warm: 600 });
    const frames = [
      ...Array(38).fill(16.67),
      spike,
      ...Array(560).fill(16.67),
      spike,
      ...Array(180).fill(16.67),
    ];
    const { changes } = simulateTrace(gov, frames);
    assert.equal(changes.length, 0, `isolated ${spike} ms hitch triggered downgrade: ${JSON.stringify(changes)}`);
    assert.equal(gov.tier, 0);
    assert.equal(gov.scale, 1);
  }

  const govTab = new Governor({ min: 0.5, max: 1, hasGpuTimer: false });
  govTab.reset({ tier: 0, scale: 1, warm: 600 });
  const tabFrames = [
    ...Array(40).fill(16.67),
    251,
    ...Array(15).fill(16.67),
    3500,
    ...Array(15).fill(16.67),
    251,
    ...Array(120).fill(16.67),
  ];
  const { changes: tabChanges } = simulateTrace(govTab, tabFrames);
  assert.equal(tabChanges.length, 0, `tab switch did not clear streak: ${JSON.stringify(tabChanges)}`);
  assert.equal(govTab.tier, 0);
  assert.equal(govTab.scale, 1);
});

function libraryLoadTrace(gpuFor) {
  const frames = [];
  let t = 0;
  while (t < 30000) {
    let dtMs = 16.67;
    if (t < 2600) {
      const k = Math.floor(t / 16.67);
      if (k % 23 === 7) dtMs = 64;
      else if (k % 41 === 19) dtMs = 120;
    }
    t += dtMs;
    frames.push({ t, dtMs, gpuMs: gpuFor ? gpuFor(t) : null });
  }
  return frames;
}

function run(gov, frames, model) {
  const changes = [];
  for (const f of frames) {
    const gpu = model ? model(gov, f.t) : f.gpuMs;
    if (gov.update(f.dtMs, gpu)) changes.push({ t: f.t, tier: gov.tier, scale: gov.scale });
  }
  return changes;
}

test('loading hitches (64-120 ms frames) with GPU headroom do not downgrade', () => {
  const gov = new Governor({ min: 0.5, max: 1, hasGpuTimer: true });
  gov.reset({ tier: 0, scale: 1, warm: 600 });
  const frames = libraryLoadTrace((t) => (t < 1000 ? 12.4 : t < 2000 ? 7.3 : 8.4 + 2.1 * ((Math.floor(t / 700) * 7) % 10) / 10));
  const changes = run(gov, frames);
  assert.equal(changes.length, 0, `changed: ${JSON.stringify(changes)}`);
  assert.equal(gov.tier, 0);
  assert.equal(gov.scale, 1);
});

test('the same loading hitches without a GPU timer still downgrade through the dt fallback', () => {
  const gov = new Governor({ min: 0.5, max: 1, hasGpuTimer: false });
  gov.reset({ tier: 0, scale: 1, warm: 600 });
  const changes = run(gov, libraryLoadTrace(null));
  assert.ok(changes.length >= 1, 'expected the dt fallback to react');
  assert.ok(changes[0].t <= 2000, `first dt reaction at ${changes[0].t} ms`);
});

test('a GPU timer that never delivers samples falls back to dt after one second', () => {
  const gov = new Governor({ min: 0.5, max: 1, hasGpuTimer: true });
  gov.reset({ tier: 0, scale: 1, warm: 600 });
  const frames = [...Array(120).fill(16.67), ...Array(60).fill(30)];
  const { changes } = simulateTrace(gov, frames);
  assert.ok(changes.length >= 1, 'expected dt fallback once no GPU samples arrive');
  assert.equal(gov.gpuTimed, false);
});

test('sustained GPU overload downgrades as before (tier first, then scale, settled within 6 s)', () => {
  const gov = new Governor({ min: 0.5, max: 1, hasGpuTimer: true });
  gov.reset({ tier: 0, scale: 1, warm: 600 });
  const frames = libraryLoadTrace(null);
  const cost = (g) => 4 + ((g.tier === 0 ? 26 : 19.5) - 4) * g.scale * g.scale;
  const changes = run(gov, frames, (g) => cost(g));
  assert.ok(changes.length >= 2, `expected tier and scale drops: ${JSON.stringify(changes)}`);
  assert.equal(changes[0].tier, 1);
  assert.ok(changes[0].t <= 1250, `first drop at ${changes[0].t} ms`);
  const last = changes[changes.length - 1].t;
  assert.ok(last <= 6000, `settled at ${last} ms`);
  assert.ok(cost(gov) <= 14.33 && cost(gov) >= 9.33, `final GPU ${cost(gov).toFixed(2)} ms at ${gov.scale}`);
});

test('dt overload with GPU headroom only downgrades once it lasts 3 s and the first seconds after the cover lift have passed', () => {
  const gov = new Governor({ min: 0.5, max: 1, hasGpuTimer: true });
  gov.reset({ tier: 0, scale: 1, warm: 600 });
  const frames = [...Array(40).fill({ dtMs: 16.67, gpuMs: 8 }), ...Array(200).fill({ dtMs: 33.3, gpuMs: 8 })];
  const { changes } = simulateTrace(gov, frames);
  assert.ok(changes.length >= 1, 'expected a downgrade on sustained dt overload');
  const startMs = 40 * 16.67;
  assert.ok(changes[0].t >= startMs + 3000, `dt downgrade after ${changes[0].t - startMs} ms of overload`);
  assert.ok(changes[0].t >= 600 + 4900 && changes[0].t <= 6000, `dt downgrade at ${changes[0].t} ms`);
});

test('recovery: a room that fits the budget returns to full scale within a few seconds of a GPU spike', () => {
  const gov = new Governor({ min: 0.5, max: 1, hasGpuTimer: true });
  gov.reset({ tier: 1, scale: 1, warm: 600 });
  const frames = Array.from({ length: 1800 }, (_, i) => ({ t: 600 + (i + 1) * 16.67, dtMs: 16.67 }));
  const spikeEnd = 600 + 1500;
  const changes = run(gov, frames, (g, t) => (t < spikeEnd ? 4 + 18 * g.scale * g.scale : 4 + 4.5 * g.scale * g.scale));
  assert.ok(changes.some((c) => c.scale < 1), 'expected the spike to downgrade');
  const back = changes.find((c) => c.t > spikeEnd && c.scale === 1);
  assert.ok(back, `never returned to full scale: ${JSON.stringify(changes)}`);
  assert.ok(back.t - spikeEnd <= 5000, `returned to full scale ${(back.t - spikeEnd).toFixed(0)} ms after the spike`);
  assert.equal(changes.filter((c) => c.t > back.t && c.scale !== 1).length, 0, JSON.stringify(changes));
});

test('recovery: a room between the thresholds climbs to the scale its GPU time allows and holds it', () => {
  const gov = new Governor({ min: 0.5, max: 1, hasGpuTimer: true });
  gov.reset({ tier: 1, scale: 0.57, warm: 600 });
  const frames = Array.from({ length: 3600 }, (_, i) => ({ t: 600 + (i + 1) * 16.67, dtMs: 16.67 }));
  const cost = (g) => 4.17 + (9.4 - 4.17) * (g.scale / 0.57) ** 2;
  const changes = run(gov, frames, (g) => cost(g));
  assert.ok(changes.length >= 1 && changes.length <= 3, `changes: ${JSON.stringify(changes)}`);
  assert.ok(changes[changes.length - 1].t <= 6000, `settled at ${changes[changes.length - 1].t} ms`);
  assert.ok(cost(gov) >= 9.33 && cost(gov) <= 14.33, `final GPU ${cost(gov).toFixed(2)} ms at ${gov.scale}`);
});

test('recovery: a room slightly over budget at full scale does not oscillate', () => {
  const gov = new Governor({ min: 0.5, max: 1, hasGpuTimer: true });
  gov.reset({ tier: 1, scale: 1, warm: 600 });
  const frames = Array.from({ length: 3600 }, (_, i) => ({ t: 600 + (i + 1) * 16.67, dtMs: 16.67 }));
  const cost = (g) => 1.5 + 15 * g.scale * g.scale;
  const changes = run(gov, frames, (g) => cost(g));
  assert.ok(changes.length <= 4, `too many changes in 60 s: ${JSON.stringify(changes)}`);
  assert.equal(changes.filter((c) => c.t > 20000).length, 0, `changed after 20 s: ${JSON.stringify(changes)}`);
  assert.ok(cost(gov) <= 15.67, `final GPU ${cost(gov).toFixed(2)} ms`);
});

test('a remembered tier 1 is tried at tier 0 only when the estimated MSAA cost fits, and a failed try is remembered', () => {
  const frames = Array.from({ length: 1800 }, (_, i) => ({ t: 600 + (i + 1) * 16.67, dtMs: 16.67 }));

  const cheap = new Governor({ min: 0.5, max: 1, hasGpuTimer: true });
  cheap.reset({ tier: 1, scale: 1, warm: 600 });
  const cheapChanges = run(cheap, frames, (g) => (g.tier === 0 ? 8 : 5.5));
  assert.equal(cheapChanges.length, 1, JSON.stringify(cheapChanges));
  assert.equal(cheap.tier, 0);
  assert.ok(cheapChanges[0].t <= 6000, `tier 0 at ${cheapChanges[0].t} ms`);
  assert.equal(cheap.tierHeld, false);

  const tight = new Governor({ min: 0.5, max: 1, hasGpuTimer: true });
  tight.reset({ tier: 1, scale: 1, warm: 600 });
  assert.equal(run(tight, frames, (g) => (g.tier === 0 ? 18 : 9)).length, 0, 'no try when 1.5x the tier 1 time is over 9.33 ms');

  const map = new Map();
  const storage = { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, String(v)) };
  const heavy = new Governor({ min: 0.5, max: 1, hasGpuTimer: true });
  heavy.reset({ tier: 1, scale: 1, warm: 600 });
  const heavyChanges = [];
  for (const f of frames) {
    if (heavy.update(f.dtMs, heavy.tier === 0 ? 20 : 5.5)) {
      heavyChanges.push({ t: f.t, tier: heavy.tier, scale: heavy.scale });
      saveRoomMode(storage, 'writing', { ...heavy.savedMode(1000), bake: 7 });
    }
  }
  assert.equal(heavyChanges.length, 2, JSON.stringify(heavyChanges));
  assert.equal(heavy.tier, 1);
  assert.equal(heavy.scale, 1);
  const saved = loadRoomMode(storage, 'writing', { bake: 7, now: 2000 });
  assert.deepEqual(saved, { tier: 1, scale: 1, held: true, at: 1000 });

  const again = new Governor({ min: 0.5, max: 1, hasGpuTimer: true });
  again.reset({ ...saved, heldAt: saved.at, warm: 600 });
  assert.equal(run(again, frames, (g) => (g.tier === 0 ? 20 : 5.5)).length, 0, 'a remembered failed try is not repeated');
});

test('intermittent frame-interval overload (2 of 3 windows at 26 ms) downgrades in GPU-timer mode', () => {
  const gov = new Governor({ min: 0.5, max: 1, hasGpuTimer: true });
  gov.reset({ tier: 0, scale: 1, warm: 600 });
  const frames = [...Array(40).fill({ dtMs: 16.67, gpuMs: 5 })];
  for (let w = 0; w < 120; w++) {
    if (w % 3 === 2) frames.push(...Array(15).fill({ dtMs: 16.67, gpuMs: 5 }));
    else frames.push(...Array(10).fill({ dtMs: 26, gpuMs: 5 }));
  }
  const { changes } = simulateTrace(gov, frames);
  assert.ok(changes.length >= 1, 'expected a downgrade on intermittent overload');
  assert.ok(changes[0].t <= 6000, `first downgrade at ${changes[0].t} ms`);
});

test('the GPU-timer upgrade does not raise the scale while frame intervals are slow', () => {
  const gov = new Governor({ min: 0.5, max: 1, hasGpuTimer: true });
  gov.reset({ tier: 1, scale: 0.6, warm: 600 });
  let maxScale = gov.scale;
  for (let i = 0; i < 900; i++) {
    gov.update(33.3, 5);
    maxScale = Math.max(maxScale, gov.scale);
  }
  assert.equal(maxScale, 0.6);
});

test('ten minutes with a cost step above the scale-squared estimate settle without oscillating', () => {
  const gov = new Governor({ min: 0.5, max: 1, hasGpuTimer: true });
  gov.reset({ tier: 1, scale: 1, warm: 600 });
  const cost = (g) => (g.scale <= 0.8 ? 4 + 9 * g.scale * g.scale : 18);
  const changes = [];
  let slowMs = 0;
  for (let t = 0; t < 600000;) {
    const gpu = cost(gov);
    const dtMs = gpu > 16.67 ? 33.33 : 16.67;
    t += dtMs;
    if (t > 60000 && dtMs > 17) slowMs += dtMs;
    if (gov.update(dtMs, gpu)) changes.push({ t: Math.round(t), scale: gov.scale });
  }
  assert.ok(changes.length <= 8, `${changes.length} changes: ${JSON.stringify(changes)}`);
  assert.equal(changes.filter((c) => c.t > 120000).length, 0, `changed after 2 min: ${JSON.stringify(changes)}`);
  assert.ok(gov.scale <= 0.8, `final scale ${gov.scale}`);
  assert.equal(slowMs, 0);
});

test('GPU samples stopping mid-visit hand over to the frame-interval fallback', () => {
  const slow = new Governor({ min: 0.5, max: 1, hasGpuTimer: true });
  slow.reset({ tier: 0, scale: 1, warm: 600 });
  const head = [...Array(36).fill({ dtMs: 16.67, gpuMs: null }), ...Array(300).fill({ dtMs: 16.67, gpuMs: 8 })];
  const stopAt = head.reduce((a, f) => a + f.dtMs, 0);
  const { changes } = simulateTrace(slow, [...head, ...Array(120).fill({ dtMs: 30, gpuMs: null })]);
  assert.equal(slow.gpuTimed, false);
  assert.ok(changes.length >= 1, 'expected the dt fallback to downgrade once samples stop');
  assert.ok(changes[0].t > stopAt && changes[0].t <= stopAt + 2000, `downgrade ${(changes[0].t - stopAt).toFixed(0)} ms after the stop`);

  const calm = new Governor({ min: 0.5, max: 1, hasGpuTimer: true });
  calm.reset({ tier: 0, scale: 1, warm: 600 });
  const { changes: calmChanges } = simulateTrace(calm, [...head, ...Array(600).fill({ dtMs: 16.67, gpuMs: null })]);
  assert.equal(calmChanges.length, 0);
});

test('a tier drop caused by slow frames during a load is undone once the GPU shows headroom', () => {
  const gov = new Governor({ min: 0.5, max: 1, hasGpuTimer: true });
  gov.reset({ tier: 0, scale: 1, warm: 600 });
  const changes = [];
  let t = 0;
  const loadEnd = 600 + 6500;
  while (t < 20000) {
    const dtMs = t > 600 && t < loadEnd ? 30 : 16.67;
    t += dtMs;
    const gpu = 4 + (gov.tier === 0 ? 8 : 1.5) * gov.scale * gov.scale;
    if (gov.update(dtMs, gpu)) changes.push({ t: Math.round(t), tier: gov.tier, scale: gov.scale });
  }
  assert.equal(changes[0]?.tier, 1, JSON.stringify(changes));
  assert.ok(changes[0].t >= 600 + 3000, `dt drop at ${changes[0].t} ms`);
  const back = changes.find((c) => c.tier === 0 && c.t > loadEnd);
  assert.ok(back && back.t - loadEnd <= 8000, JSON.stringify(changes));
  assert.equal(gov.tier, 0);
  assert.equal(gov.scale, 1);
  assert.equal(gov.tierHeld, false);
});

test('one GPU window over the limit while textures upload after the cover lift does not drop the tier', () => {
  const gov = new Governor({ min: 0.5, max: 1, hasGpuTimer: true });
  gov.reset({ tier: 0, scale: 1, warm: 600 });
  const frames = [
    ...Array(60).fill({ dtMs: 16.67, gpuMs: 10 }),
    ...Array(16).fill({ dtMs: 16.67, gpuMs: 18 }),
    ...Array(600).fill({ dtMs: 16.67, gpuMs: 10 }),
  ];
  const { changes } = simulateTrace(gov, frames);
  assert.equal(changes.length, 0, JSON.stringify(changes));
  assert.equal(gov.tierHeld, false);
});

test('frames that upload textures are left out: over-limit upload frames do not downgrade, sustained overload without uploads still does', () => {
  const uploadTrace = (gpuOn) => {
    const frames = [];
    for (let i = 0; i < 900; i++) {
      const upload = i >= 40 && i < 400 && i % 12 < 2;
      frames.push({ dtMs: upload ? 60 : 16.67, gpuMs: gpuOn ? (upload ? 22 : 9) : null, upload });
    }
    return frames;
  };
  const feed = (gov, frames) => {
    const changes = [];
    for (const f of frames) if (gov.update(f.dtMs, f.upload ? null : f.gpuMs, f.upload)) changes.push({ tier: gov.tier, scale: gov.scale });
    return changes;
  };
  for (const hasGpuTimer of [true, false]) {
    const gov = new Governor({ min: 0.5, max: 1, hasGpuTimer });
    gov.reset({ tier: 0, scale: 1, warm: 600 });
    assert.equal(feed(gov, uploadTrace(hasGpuTimer)).length, 0, `hasGpuTimer=${hasGpuTimer}`);
    assert.equal(gov.tier, 0);
    assert.equal(gov.scale, 1);

    const same = new Governor({ min: 0.5, max: 1, hasGpuTimer });
    same.reset({ tier: 0, scale: 1, warm: 600 });
    const unflagged = uploadTrace(hasGpuTimer).map((f) => ({ ...f, upload: false }));
    assert.ok(feed(same, unflagged).length >= 1, `the same frames without the upload flag must downgrade (hasGpuTimer=${hasGpuTimer})`);
  }
  const busy = new Governor({ min: 0.5, max: 1, hasGpuTimer: true });
  busy.reset({ tier: 0, scale: 1, warm: 600 });
  const sustained = Array.from({ length: 300 }, (_, i) => ({ dtMs: 33.3, gpuMs: 25, upload: i % 10 === 0 }));
  assert.ok(feed(busy, sustained).length >= 1, 'sustained GPU overload between uploads must still downgrade');
});

test('a long texture stream cannot blind the governor: over half the last 3 s in upload frames stops the exclusion', () => {
  const gov = new Governor({ min: 0.5, max: 1, hasGpuTimer: true });
  gov.reset({ tier: 0, scale: 1, warm: 600 });
  const frames = [];
  let t = 0;
  let next = 0;
  let uploads = 0;
  while (t < 20000) {
    const dtMs = 33.3;
    t += dtMs;
    const upload = uploads < 400 && t >= next;
    if (upload) { uploads++; next += 50; }
    frames.push({ dtMs, gpuMs: 4 + 21 * gov.scale * gov.scale, upload: upload || (frames.length > 0 && frames[frames.length - 1].fresh), fresh: upload });
  }
  const changes = [];
  let pending = null;
  t = 0;
  for (const f of frames) {
    t += f.dtMs;
    if (gov.update(f.dtMs, pending, f.upload)) changes.push({ t, tier: gov.tier, scale: gov.scale });
    pending = gov.excluded ? null : 4 + 21 * gov.scale * gov.scale;
  }
  assert.ok(changes.length >= 1, 'expected a downgrade while uploads keep streaming');
  assert.ok(changes[0].t <= 4000, `first downgrade at ${changes[0].t.toFixed(0)} ms`);
});

test('a CPU-bound room (GPU timer low, frames slow) is not lowered below scale 0.75', () => {
  const gov = new Governor({ min: 0.5, max: 1, hasGpuTimer: true });
  gov.reset({ tier: 0, scale: 1, warm: 600 });
  const changes = [];
  for (let i = 0; i < 18000; i++) if (gov.update(33.3, 5)) changes.push({ tier: gov.tier, scale: gov.scale });
  assert.ok(changes.length >= 1, 'expected the frame-interval fallback to react');
  assert.ok(gov.scale >= 0.75, `scale ${gov.scale}`);
});

test('the stored mode keeps the remembered tier for unheld drops, and held expires after 7 days or a new bake', () => {
  const gov = new Governor({ min: 0.5, max: 1, hasGpuTimer: true });
  gov.reset({ tier: 0, scale: 1, warm: 600 });
  for (let i = 0; i < 120 && gov.tier === 0; i++) gov.update(16.67, 25);
  assert.equal(gov.tier, 1);
  assert.equal(gov.tierHeld, false, 'a GPU drop before the mode settles is not held');
  assert.deepEqual(gov.savedMode(5), { tier: 0, scale: gov.scale });

  const map = new Map();
  const storage = { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, String(v)) };
  const day = 24 * 3600 * 1000;
  saveRoomMode(storage, 'lobby', { tier: 1, scale: 0.8, held: true, at: 10 * day, bake: 3 });
  assert.deepEqual(loadRoomMode(storage, 'lobby', { bake: 3, now: 16 * day }), { tier: 1, scale: 0.8, held: true, at: 10 * day });
  assert.deepEqual(loadRoomMode(storage, 'lobby', { bake: 3, now: 18 * day }), { tier: 0, scale: 0.8 });
  assert.deepEqual(loadRoomMode(storage, 'lobby', { bake: 4, now: 11 * day }), { tier: 0, scale: 0.8 });
  saveRoomMode(storage, 'lobby', { tier: 1, scale: 0.8, held: true });
  assert.deepEqual(loadRoomMode(storage, 'lobby', { now: 11 * day }), { tier: 0, scale: 0.8 }, 'held without a time is not stored');

  const kept = new Governor({ min: 0.5, max: 1, hasGpuTimer: true });
  kept.reset({ tier: 1, scale: 1, held: true, heldAt: 10 * day, warm: 0 });
  assert.deepEqual(kept.savedMode(12 * day), { tier: 1, scale: 1, held: true, at: 10 * day }, 'a later visit keeps the first time');
});

test('an old tier 1 record without a valid hold loads as tier 0 with its scale', () => {
  const map = new Map([[storageKey('writing'), JSON.stringify({ v: 1, tier: 1, scale: 0.5 })]]);
  const storage = { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, String(v)) };
  assert.deepEqual(loadRoomMode(storage, 'writing', { bake: 2 }), { tier: 0, scale: 0.5 });
});

test('the time of a hold is set when it is first saved and does not move later in the visit', () => {
  const gov = new Governor({ min: 0.5, max: 1, hasGpuTimer: true });
  gov.reset({ tier: 0, scale: 1, warm: 0 });
  for (let i = 0; i < 400; i++) gov.update(16.67, 12);
  for (let i = 0; i < 60 && gov.tier === 0; i++) gov.update(16.67, 30);
  assert.equal(gov.tier, 1);
  assert.equal(gov.tierHeld, true);
  assert.equal(gov.savedMode(100).at, 100);
  assert.equal(gov.savedMode(200).at, 100);
});
