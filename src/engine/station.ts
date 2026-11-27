// createStation: the renderer, the camera, the frame loop, the governor and the open room, behind the Station boundary.
import * as THREE from 'three';
import { Post, Governor } from './post.js';
import { loadRoomMode, saveRoomMode } from './governor.js';
import { Q, SKIP, V, num, uTime, uPx, uMirror, DSCALE, setDistanceScale } from './kit.js';
import { loadRoom } from './room.js';
import { TURN } from './turn.js';
import { windowShadow } from './sunlight.js';
import { DEV } from './dev.js';
import { GL_ATTRS } from './context.js';
import { createGpuTimer } from './gpu-timer.ts';
import { createMirror, setFloors, renderMirror } from './mirror.ts';
import { pickHit, rectOf as rectOfPick, toRect, tourOrder as orderOf } from './picking.ts';
import { store, polled } from './readable.ts';
import type { Content, ContactInfo, Focused, Pick, PickId, PickKind, PointerHow, ReaderInfo, Rect, Room, RoomId, RoomStatus,
  SiteData, Station, StationHost, StationPick, TurnApi, ViewName } from './types.ts';

type Saved = { tier: number; scale: number; held?: boolean; at?: number | null } | null;
type Gov = {
  min: number; max: number; scale: number; tier: number; warm: number; settledMs: number; excluded: boolean; allPinned: boolean; scalePinned: boolean;
  update(dtMs: number, gpu: number[] | null, upload: boolean): boolean; rest(ms: number): void; reset(options: object): void; savedMode(now: number): object;
};
type PostPass = {
  scene: THREE.WebGLRenderTarget; msaa: number;
  setMSAA(n: number): void; setFXAA(on: boolean): void; setSize(w: number, h: number): void; setExposure(e: number): void; render(t: number, noBloom: boolean): void;
};

const sleep = (ms: number) => new Promise<void>((done) => { setTimeout(done, ms); });

export function createStation(canvas: HTMLCanvasElement, content: Content, _site: SiteData, host: StationHost): Station {
  const renderer = new THREE.WebGLRenderer({ canvas, ...GL_ATTRS });
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.info.autoReset = false;
  const gl = renderer.getContext() as WebGL2RenderingContext, FLOAT = !!gl.getExtension('EXT_color_buffer_float'), HDR_OK = FLOAT || !!gl.getExtension('EXT_color_buffer_half_float');
  const timer = createGpuTimer(gl);
  let savedRoom: RoomId | null = null;
  const safeStorage = () => { try { return globalThis.localStorage; } catch { return null; } };
  setDistanceScale(HDR_OK ? 1 : 0.01);
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.3, 3000), maxAniso = renderer.capabilities.getMaxAnisotropy();
  const mirror = createMirror(HDR_OK);
  const post = new Post(renderer, { hdr: HDR_OK, packed: FLOAT, msaa: 4, look: { contrast: num('contrast', 1.3), saturation: num('sat', 1.08),
    bloom: 0.0375 * num('bloom', 1), threshold: num('bloomth', 1.3), vignette: num('vig', 0.45), grain: num('grain', 0.045) } }) as unknown as PostPass;
  let room: Room | null = null, busy = false, active = true, W = 1, H = 1, DPR = 1, covered: Rect | null = null;

  const REFL_SCALE = num('refl', 0.66), TIER_PINNED = Q.has('tier') || Q.has('msaa');
  const PINNED_TIER = Q.has('tier') ? (num('tier', 0) ? 1 : 0) : (num('msaa', 4) ? 0 : 1);
  const PINNED_SCALE = Q.has('scale') ? num('scale', 1) : null;
  const gov = new Governor({ min: 0.5, max: 1, pinned: PINNED_SCALE, tierPinned: TIER_PINNED, tier: PINNED_TIER, hasGpuTimer: timer.has }) as unknown as Gov;
  let tier = -1, reflScale = REFL_SCALE;
  function setTier(t: number) {
    if (t === tier) return; tier = t;
    post.setMSAA(t ? 0 : 4); post.setFXAA(!!t);
    mirror.rt.samples = t ? 0 : 4; mirror.rt.dispose();
    reflScale = t ? Math.min(1, REFL_SCALE * 1.3) : REFL_SCALE; mirror.minLod.value = t ? 0.8 : 0;
  }
  setTier(PINNED_TIER);
  function applyScale() {
    const cw = canvas.width, ch = canvas.height, s = gov.scale, tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const rw = Math.max(8, Math.round(cw * s * reflScale)), rh = Math.max(8, Math.round(ch * s * reflScale));
    post.setSize(cw * s, ch * s); mirror.rt.setSize(rw, rh); mirror.size.set(rw, rh);
    mirror.pxPerRad.value = rh / (2 * tanHalf); uPx.value = post.scene.height / (2 * tanHalf);
  }
  function resize() {
    renderer.setPixelRatio(Math.min(DPR, num('dpr', 2))); renderer.setSize(W, H, false);
    camera.aspect = W / H;
    const base = Math.tan(THREE.MathUtils.degToRad((room?.info.fov ?? 50) / 2));
    camera.fov = Math.min(96, THREE.MathUtils.radToDeg(2 * Math.atan(base * Math.max(1, (16 / 9) / camera.aspect))));
    camera.updateProjectionMatrix(); applyScale();
    if (focus.pick) focus.to = focus.pick.pose();
  }

  function draw(t: number) {
    const r = room!;
    renderer.info.reset();
    r.scene.updateMatrixWorld();
    if (!SKIP.has('sunlight')) r.prepass?.(renderer);
    r.capture?.(renderer);
    r.chart?.draw(renderer, r.scene, camera);
    if (!SKIP.has('mirror')) renderMirror(renderer, mirror, r, camera);
    renderer.setRenderTarget(post.scene); renderer.render(r.scene, camera);
    post.render(t, SKIP.has('bloom'));
  }
  function brightness(n: number) {
    const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(4); let sum = 0;
    for (let i = 1; i < n; i++) for (let k = 1; k < n; k++) { gl.readPixels((w * i / n) | 0, (h * k / n) | 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); sum += px[0] + px[1] + px[2]; }
    return sum / (3 * (n - 1) ** 2);
  }
  const series: number[] = [];

  const mouse = new THREE.Vector2(), smooth = new THREE.Vector2(), _hero = V(), _close = V(), _look = V(), _p = V();
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches, PINNED = Q.has('shot') || still;
  const HOLD = num('hold', 1.2), TRAVEL = num('travel', 5.5);
  const SHOT = ({ hero: 0, close: 1 } as Record<string, number>)[Q.get('shot') ?? ''] ?? num('shot', 0);
  let view = 1, viewTarget = 1, navTouched = false, intro = 0, t0 = 0;

  const focus = { pick: null as Pick | null, to: null as { pos: THREE.Vector3; tgt: THREE.Vector3 } | null, f: 1,
    from: { pos: V(), tgt: V() }, cur: { pos: V(), tgt: V() }, dest: V() };
  let tour: Pick[] | null = null, leaving: ReturnType<typeof setTimeout> | null = null;
  let pointer: { x: number; y: number } | null = null, over: Pick | null = null, aim = false, aimed = 0, hovered = 0;
  const ids = new WeakMap<Pick, PickId>(), byId = new Map<PickId, Pick>();
  let nextId = 0;
  const idOf = (p: Pick) => { let id = ids.get(p); if (!id) { id = `p${++nextId}`; ids.set(p, id); byId.set(id, p); } return id; };
  const pickOf = (id: PickId | null | undefined) => (id == null ? null : byId.get(id) ?? null);
  const tourOrder = () => (tour ??= orderOf(room!.picks, room!.CAM));
  const kindOf = (p: Pick): PickKind => (p.door ? 'door' : p === room?.terminal ? 'terminal' : p.station != null ? 'station' : p.click ? 'contact' : p.source ? 'exhibit' : 'thing');

  function focusedNow(): Focused | null {
    const p = focus.pick; if (!p) return null;
    const order = tourOrder(), door = p.door, ways = !door ? [] : door.stops ?? [[`ENTER ${door.label}`, door.to ?? '']];
    return {
      pick: idOf(p), name: p.name ?? '', verb: p.verb ?? '', aside: !!p.aside, steady: !!p.steady, backLabel: p.backLabel ?? '←  BACK',
      tour: { index: order.indexOf(p), count: order.length },
      ways: ways.map(([label, to]) => ({ label, to: to ?? '' })),
      options: p.options ? p.options.map(([label, , sub]) => (sub ? { label, sub } : { label })) : null,
      current: p.current?.() ?? -1, list: !!p.list, canRead: !!p.enter?.(), readLabel: p.enterLabel ?? '', typing: !!p.typing?.(), reads: !!p.reads,
      url: p.url?.() ?? null, title: p.title?.() ?? null,
    };
  }
  const focused = polled(focusedNow, () => (focus.pick ? [idOf(focus.pick), !!focus.pick.enter?.(), focus.pick.current?.() ?? -1, !!focus.pick.typing?.()] : null));
  const livePicks = (): Pick[] => (room ? room.picks.filter((p) => !p.reads && (!p.live || p.live())) : []);
  const picks = polled((): StationPick[] => livePicks().map((p) => ({ id: idOf(p), name: p.name ?? '', verb: p.verb ?? '', kind: kindOf(p),
    ...(p.cta ? { cta: true } : {}), ...(p.cue ? { cue: p.cue } : {}) })), () => livePicks().map(idOf));
  const pointed = store<PickId | null>(null), wideAtRest = store(false), hintTurnDone = store(false);
  const gliding = polled(() => focus.f < 1);
  const view$ = polled((): ViewName => (viewTarget >= 0.5 ? 'close' : 'wide'));
  const roomState = store<RoomStatus>({ id: null, status: 'loading', progress: 0, label: '' });
  const readerNow = (): ReaderInfo => {
    const r = room?.reader;
    return { state: r?.state() ?? 'closed', url: r?.url() ?? null, title: r?.title() ?? null, phone: W <= 720 };
  };
  const reader = polled(readerNow, () => [room?.reader?.state() ?? 'closed', room?.reader?.url() ?? null, W <= 720]);
  const contactNow = (): ContactInfo => ({ open: !!room?.comms?.expanded(), links: room?.comms?.links() ?? [] });
  const contact = polled(contactNow, () => !!room?.comms?.expanded());

  function setFocus(pick: Pick | null = null) {
    if (pick === focus.pick) return;
    focus.pick?.onFocus?.(false, pick); pick?.onFocus?.(true);
    focus.pick = pick; focus.to = pick?.pose() ?? null; focus.f = still ? 1 : 0;
    pointer = null;
    focus.from.pos.copy(focus.cur.pos); focus.from.tgt.copy(focus.cur.tgt);
    if (leaving) clearTimeout(leaving);
    leaving = null;
    if (pick) { navTouched = true; viewTarget = Math.round(view); }
    gliding.poll(); view$.poll();
    focused.poll();
  }
  function step(d: number) { const t = tourOrder(), i = t.indexOf(focus.pick!); setFocus(t[((i < 0 ? (d > 0 ? -1 : 0) : i) + d + t.length) % t.length]); }
  function travel(id: RoomId | '' | undefined, delay = 0) {
    if (id && !leaving) leaving = setTimeout(() => { if (host.travel) host.travel(id); else void enter(id); }, delay);
  }
  function back() { setFocus(focus.pick?.back?.() ?? null); }
  function clearance(x0: number, x1: number) {
    if (covered) return covered.right > x0 && covered.left < x1 ? H - covered.top : 0;
    return host.clearance?.(x0, x1) ?? 0;
  }

  const isRoom = (id: RoomId) => typeof id === 'string' && Object.hasOwn(content.rooms, id);
  async function enter(id: RoomId, { want }: { want?: string } = {}) {
    if (busy || !isRoom(id) || id === room?.id) return;
    const label = content.rooms[id].loading;
    busy = true; roomState.set({ id: room?.id ?? null, status: 'loading', progress: 0, label });
    setFocus(null); intro = 0;
    if (room) { await sleep(500); room.dispose(); room = null; seen = null; }
    roomState.set({ id: null, status: 'loading', progress: 0, label });
    let next: Room;
    try {
      next = await loadRoom(id, content.rooms[id], { renderer, camera, mirror, maxAniso, onProgress: (f: number) => roomState.set({ id: null, status: 'loading', progress: f, label }),
        onLink: (href: string | null) => host.onLink(href), clearance, words: content.reader, display: content.display,
        onShown: () => { if (room && !busy) host.onShown?.(); }, want }) as unknown as Room;
    } catch (e) {
      roomState.set({ id: null, status: 'failed', progress: roomState.get().progress, label, error: String((e as Error)?.message ?? e) });
      throw e;
    }
    room = next;
    room.scene.matrixWorldAutoUpdate = false; room.scene.matrixAutoUpdate = false;
    setFloors(room.floors);
    savedRoom = null;
    const asked = { min: gov.min, max: gov.max, bake: room.scene.userData.stream?.bake?.() };
    const remembered = loadRoomMode(safeStorage(), id, asked) as Saved;
    const startTier = TIER_PINNED ? PINNED_TIER : (remembered ? remembered.tier : 0);
    const startScale = PINNED_SCALE != null ? PINNED_SCALE : (remembered ? remembered.scale : gov.max);
    gov.reset({ tier: startTier, scale: startScale, warm: 600, held: !TIER_PINNED && !!remembered?.held, heldAt: remembered?.at ?? null });
    setTier(gov.tier);
    post.setExposure(room.exposure); resize(); timer.reset();
    tour = null; view = viewTarget = Q.has('shot') ? SHOT : +!still; navTouched = PINNED; t0 = uTime.value;
    busy = false;
    picks.poll(); view$.poll(); reader.poll(); contact.poll();
    roomState.set({ id, status: 'ready', progress: 1, label });
  }

  async function readAt(url: string, { fly = false }: { fly?: boolean } = {}) {
    if (!room?.read) return false;
    if ((fly && room.terminal) || focus.pick?.reads) setFocus(room.terminal ?? null);
    const here = room, pick = await room.read(url, fly);
    if (pick && room === here) setFocus(pick);
    return !!pick;
  }

  const CALM = num('calm', 0.15), LIFT = 0.8, clock = new THREE.Clock(), frames = new Set<(seconds: number) => void>();
  let drawn = 0, wasCalm = false, seen: Pick | null = null, uploadsSeen = 0, uploadLast = false, raf = 0;
  const callFrames = (t: number) => { for (const fn of Array.from(frames)) fn(t); };
  function saveMode(r: Room) {
    saveRoomMode(safeStorage(), r.id, { ...gov.savedMode(Date.now()), bake: r.scene.userData.stream?.bake?.() }, { min: gov.min, max: gov.max });
    savedRoom = r.id;
  }
  function frame() {
    raf = requestAnimationFrame(frame);
    const rawDt = clock.getDelta(), dt = Math.min(rawDt, 0.05), t = (uTime.value += dt), since = t - t0;
    if (!room || !active) { pointed.set(null); wideAtRest.set(false); return callFrames(t); }
    const calm = focus.f >= 1 && !!focus.pick?.calm?.();
    if (calm && t - drawn < CALM) return;
    if (calm !== wasCalm) { wasCalm = calm; timer.reset(); gov.rest(600); }
    drawn = t;
    const uploads = room.scene.userData.stream?.uploads?.() ?? 0, uploadNow = uploads !== uploadsSeen, uploadFrame = uploadNow || uploadLast;
    uploadsSeen = uploads; uploadLast = uploadNow;
    const gpuSamples = !calm ? timer.drain() : null;
    if (!calm && gov.update(rawDt * 1000, gpuSamples, uploadFrame)) {
      setTier(gov.tier);
      applyScale();
      timer.reset();
      if (!gov.scalePinned && !TIER_PINNED && room) saveMode(room);
    } else if (!calm && room && savedRoom !== room.id && !gov.scalePinned && !TIER_PINNED && gov.warm <= 0 && gov.settledMs >= 2000) saveMode(room);
    if (room.turn) {
      const by = focus.pick?.reads ? room.reader?.offeredBy() : focus.pick, at = by?.station ?? null;
      if (focus.pick !== seen) { seen = focus.pick; if (at !== null) room.turn.to(at); }
      else if (at !== null && by === focus.pick && room.turn.byHand() && room.turn.front() !== at) { setFocus(room.picks.find((p) => p.station === room!.turn!.front()) ?? null); seen = focus.pick; }
    }
    const { CAM, TGT, CLOSE, CLOSE_TGT } = room;
    if (since > HOLD && !navTouched) viewTarget = 0;
    view += THREE.MathUtils.clamp(viewTarget - view, -dt / TRAVEL, dt / TRAVEL);
    intro = Q.has('shot') ? 1 : Math.max(intro, 1 - view);
    const e = view * view * view * (view * (view * 6 - 15) + 10), par = 1 - 0.75 * e;
    smooth.lerp(mouse, 1 - Math.exp(-dt * 2.5));
    _hero.set(CAM.x + smooth.x * 1.0 * par + Math.sin(t * 0.17) * 0.12, CAM.y - smooth.y * 0.22 * par + Math.sin(t * 0.23) * 0.04, CAM.z);
    _close.set(CLOSE.x + smooth.x * 0.5 + Math.sin(t * 0.17) * 0.06, CLOSE.y - smooth.y * 0.15 + Math.sin(t * 0.23) * 0.03, CLOSE.z - Math.min(since, 8) * 0.06);
    camera.position.lerpVectors(_hero, _close, e);
    camera.position.y += Math.sin(Math.PI * e) * room.arc;
    _look.set(TGT.x + smooth.x * 0.8, TGT.y - smooth.y * 0.55, TGT.z).lerp(_p.set(CLOSE_TGT.x + smooth.x * 0.6, CLOSE_TGT.y - smooth.y * 0.4, CLOSE_TGT.z), e);
    focus.f = Math.min(1, focus.f + dt / 1.4);
    const glide = focus.f * focus.f * (3 - 2 * focus.f);
    if (focus.to) {
      focus.dest.copy(focus.to.pos); if (!focus.pick!.steady) { focus.dest.x += smooth.x * 0.1; focus.dest.y -= smooth.y * 0.06; }
      camera.position.lerpVectors(focus.from.pos, focus.dest, glide); _look.lerpVectors(focus.from.tgt, focus.to.tgt, glide);
    } else if (focus.f < 1) { camera.position.lerpVectors(focus.from.pos, camera.position, glide); _look.lerpVectors(focus.from.tgt, _look, glide); }
    focus.cur.pos.copy(camera.position); focus.cur.tgt.copy(_look);
    camera.lookAt(_look); camera.updateMatrixWorld();

    room.update(t);
    const q = timer.begin(!calm && !gov.allPinned);
    try {
      draw(t);
    } finally {
      timer.end(q, gov.excluded);
    }
    if (!pointer) over = null; else if (aim || t - aimed > 0.15) { over = pickHit(room.picks, camera, pointer.x, pointer.y, W, H)?.pick ?? null; aim = false; aimed = t; }
    if (room.turn?.byHand()) hintTurnDone.set(true);
    picks.poll(); focused.poll(); gliding.poll(); view$.poll(); reader.poll(); contact.poll();
    pointed.set(over ? idOf(over) : null);
    wideAtRest.set(!busy && !focus.pick && focus.f >= 1 && view === 0 && since > LIFT);
    callFrames(t);
    if (Q.has('debug')) { series.push(Math.round(brightness(7))); if (series.length > 400) series.shift(); }
  }

  canvas.addEventListener('webglcontextlost', () => { timer.lost(); });

  const turnApi = (): TurnApi | null => {
    const t = room?.turn; if (!t) return null;
    return {
      angle: () => t.angle(), grab: () => t.grab(), drag: (a) => t.drag(a), release: (v, lean) => t.release(v, lean), step: (d) => t.step(d),
      moving: () => t.moving(), usable: () => !!room?.turn && !busy && !leaving && !focus.pick?.reads, grip: () => t.grip(camera, H), feel: TURN,
    };
  };

  const station: Station = {
    start() {
      const r = room; if (!r) return;
      camera.position.copy(r.CAM); camera.lookAt(r.TGT); camera.updateMatrixWorld(); r.update(0); draw(0);
      if (tier === 0 && !TIER_PINNED && brightness(8) < 2) { setTier(1); gov.tier = 1; applyScale(); }
      if (Q.has('focus')) setTimeout(() => setFocus(room?.picks[num('focus', 0)] ?? null), 300);
      frame();
    },
    dispose() { cancelAnimationFrame(raf); if (leaving) clearTimeout(leaving); room?.dispose(); room = null; renderer.dispose(); },
    enter,
    room: roomState,
    reads: (url) => !!room?.reads(url),
    get volumesCount() { return room?.volumes?.length ?? 0; },
    focus(id) {
      const p = pickOf(id); setFocus(p);
      if (p?.door && !p.door.stops) travel(p.door.to, 1500);
    },
    back,
    step,
    focused,
    choose(i) { focus.pick?.options?.[i]?.[1](); },
    travel: (to) => travel(to),
    read(id) {
      if (id != null) {
        const p = pickOf(id); if (!p) return false;
        if (p !== focus.pick) { if (!p.enter?.()) return false; setFocus(p); }
      }
      const r = focus.pick?.enter?.(); if (!r) return false;
      setFocus(r); return true;
    },
    picks,
    pointed,
    rectOf(id) { const p = pickOf(id); return p ? rectOfPick(p, camera, W, H) : null; },
    gliding,
    wideAtRest,
    hintTurnDone,
    reader,
    readAt,
    closeReader() { if (focus.pick?.reads) back(); },
    jump(anchor) { room?.reader?.jump(anchor); },
    readerScrollTo(anchor) { room?.reader?.scrollTo(anchor); },
    frameOf: () => room?.reader?.frame() ?? null,
    contact,
    contactLinkRect(i) { const r = room?.comms?.linkRect(i); return r ? toRect(r[0] * W, r[1] * H, r[2] * W, r[3] * H) : null; },
    setCovered(_region, rect) { covered = rect; },
    view: view$,
    setView(v, how) {
      navTouched = true; viewTarget = v === 'close' ? 1 : 0;
      if (how?.now) { view = viewTarget; t0 = uTime.value; }
      view$.poll();
    },
    get turn() { return turnApi(); },
    onFrame(fn) { frames.add(fn); return () => { frames.delete(fn); }; },
    pointer(x, y, type, how: PointerHow = {}) {
      if (how.steer !== false) mouse.set((x / W) * 2 - 1, (y / H) * 2 - 1);
      pointer = type !== 'touch' && how.scene ? { x, y } : null; aim = true;
      const at = how.at ?? performance.now();
      if (room && active && at - hovered > 60) {
        hovered = at; const ph = pickHit(room.picks, camera, x, y, W, H);
        canvas.style.cursor = !ph ? '' : ph.pick === focus.pick && ph.pick.cursor ? ph.pick.cursor(ph.hit.uv!) : 'pointer';
      }
    },
    pointerGone() { pointer = null; },
    tilt(gamma, beta) { mouse.set(THREE.MathUtils.clamp(gamma / 30, -1, 1), THREE.MathUtils.clamp((beta - 45) / 30, -1, 1)); },
    tap(x, y) {
      if (!room || busy) return;
      const ph = pickHit(room.picks, camera, x, y, W, H), pick = ph?.pick ?? null;
      if (ph && ph.pick === focus.pick && ph.pick.click) { ph.pick.click(ph.hit.uv!); return; }
      if (!pick && focus.pick?.steady) return;
      setFocus(pick);
      if (pick?.door && !pick.door.stops) travel(pick.door.to, 1500);
    },
    setActive(on) { active = on; },
    resize(width, height, dpr) { W = width; H = height; DPR = dpr; resize(); reader.poll(); },
    setHidden(hidden) { if (!hidden) { timer.reset(); gov.rest(500); } },
    debug: {
      renderer, camera, post, gov, series,
      get room() { return room; },
      get turn() { const t = room?.turn; return t ? { ...t, grip: () => t.grip(camera, H) } : null; },
      setFocus: (pick) => setFocus(pick ?? null),
      ready: () => intro,
      volumes: () => (room?.volumes ?? []).map(({ slug, title }) => ({ slug, title })),
      held: () => room?.volumes?.[room.heldVolume()]?.slug ?? null,
      mode: () => ({ room: room?.id, hdr: HDR_OK, tier, msaa: post.msaa, scale: +gov.scale.toFixed(2), size: `${post.scene.width}x${post.scene.height}`, mirror: `${mirror.size.x}x${mirror.size.y}` }),
      ...(Q.has('lightcheck') && { lightFrame(eye: [number, number, number], at: [number, number, number], t: number) {
        camera.position.fromArray(eye); camera.lookAt(...at); camera.updateMatrixWorld(true);
        uTime.value = t; room!.update(t); draw(t);
      } }),
      ...(DEV && { modules: {
        THREE: { BoxGeometry: THREE.BoxGeometry, Camera: THREE.Camera, Color: THREE.Color, DataUtils: THREE.DataUtils, DoubleSide: THREE.DoubleSide,
          FloatType: THREE.FloatType, FrontSide: THREE.FrontSide, HalfFloatType: THREE.HalfFloatType, Mesh: THREE.Mesh, MeshBasicMaterial: THREE.MeshBasicMaterial,
          PlaneGeometry: THREE.PlaneGeometry, Raycaster: THREE.Raycaster, Scene: THREE.Scene, ShaderMaterial: THREE.ShaderMaterial,
          SphereGeometry: THREE.SphereGeometry, Vector2: THREE.Vector2, Vector3: THREE.Vector3, WebGLRenderTarget: THREE.WebGLRenderTarget },
        kit: { uTime, uMirror, get DSCALE() { return DSCALE; } },
        sunlight: { windowShadow },
      } }),
    },
  };
  return station;
}
