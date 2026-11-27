// The page code of the station: the head-up display, the inspect bar, the keys, the pointer, the addresses and the loader, over the Station.
import { createStation } from '../engine/station.ts';
import { params, DEV } from '../engine/dev.js';
import { loadSite, furnish } from '../content/site.js';
import { initLive, live, fill } from '../content/live.js';
import { addresses } from './address.js';
import { createDisplay } from './display.js';

export async function boot(stayPlain) {
  const Q = params();
  const $ = (sel) => document.querySelector(sel), esc = (str) => String(str).replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
  const canvas = $('#scene'), loader = $('#loader'), hud = $('#hud'), bar = $('#inspectbar');
  const html = document.documentElement, plain = () => !html.classList.contains('station');
  function fail(msg) {
    if (loader.dataset.failed) return;
    if ($('#page')) { loader.dataset.failed = 'true'; html.className = ''; console.error(msg); return; }
    loader.dataset.failed = 'true'; loader.classList.remove('done'); $('#what').textContent = msg;
    $('#loader .percentage').hidden = true;
    $('#loader .bar').style.display = 'none'; $('#loader .mark').style.animation = 'none';
  }
  addEventListener('error', (e) => fail('ERROR: ' + (e.message || 'failed to start')));
  addEventListener('unhandledrejection', (e) => fail('ERROR: ' + (e.reason?.message || e.reason || 'failed to load')));
  const [content, site] = await Promise.all([fetch('content.json').then((r) => r.json()), loadSite()]);
  furnish(content, site);
  const titles = new Map([...site.posts, ...site.projects].map((p) => [p.url, p.title]));

  let st = null;
  const host = {
    onLink: (href) => onLink(href),
    onShown: () => { if (!busy()) syncUrl(); },
    travel: (to) => { enter(to); },
    clearance,
  };
  try {
    st = createStation(canvas, content, site, host);
  } catch (e) {
    stayPlain('WebGL2 did not start: ' + (e?.message ?? e));
    return;
  }
  const station = st;
  station.setActive(!plain());
  new MutationObserver(() => station.setActive(!plain())).observe(html, { attributes: true, attributeFilter: ['class'] });
  const setMode = (name) => { html.className = name; station.setActive(!plain()); };
  if (DEV) window.__modules = station.debug.modules;

  let inflight = false, failed = false, silent = 0, pushNext = null, unturn = null;
  const busy = () => inflight || failed;
  const display = createDisplay({ station, words: content.display, choose: (pick) => { if (station.room.get().id && !busy() && !plain()) station.focus(pick.id, { travel: false }); } });
  let focusNow = null;
  const isRoom = (id) => typeof id === 'string' && Object.hasOwn(content.rooms, id);
  const { roomAt, route: routeOf } = addresses(content.rooms);
  const route = (u) => routeOf(u ?? location);
  const roomInUrl = () => route().id;
  const query = () => { const p = new URLSearchParams(Q); p.delete('room'); return `${p}` ? `?${p}` : ''; };
  const urlFor = (id) => content.rooms[id].path + query();

  function focusChanged(f) {
    const same = (f?.pick ?? null) === (focusNow?.pick ?? null);
    focusNow = f;
    if (same) return;
    display.focused(f);
    hud.classList.toggle('inspecting', !!f); bar.hidden = !f; bar.classList.toggle('aside', !!f?.aside);
    if (station.room.get().id && !busy()) syncUrl();
    if (!f) return;
    $('#back').textContent = f.backLabel;
    $('#count').textContent = `${f.tour.index + 1} / ${f.tour.count}`;
    $('#ways').innerHTML = f.ways.map(({ label, to }) => `<button data-to="${to}"${to ? '' : ' disabled'}>${label}${to ? '  →' : '  ·  NOT YET OPEN'}</button>`).join('')
      + (f.options || []).map(({ label, sub }, i) => `<button data-option="${i}"${f.current === i ? ' aria-current="true"' : ''}>${esc(label)}${sub ? `<small>${esc(sub)}</small>` : ''}</button>`).join('');
    $('#ways').classList.toggle('list', f.list); $('#ways').classList.toggle('chosen', f.current >= 0);
    if (f.readLabel) $('#ways').insertAdjacentHTML('beforeend', `<button id="enter" hidden aria-label="${esc(content.reader.readThis)}">${esc(f.readLabel)}</button>`);
    tick();
  }
  station.focused.subscribe(focusChanged);

  const tick = () => {
    const v = live(); for (const el of document.querySelectorAll('[data-live]')) el.textContent = fill(`{${el.getAttribute('data-live')}}`, v);
    const b = $('#enter'); if (b) b.hidden = !station.focused.get()?.canRead;
  };
  function fillHud(id) {
    const r = content.rooms[id];
    document.title = r.title; $('.kicker').textContent = r.kicker; $('.headline').innerHTML = r.headline.join('<br>');
    const sub = $('.sub'); sub.hidden = !r.sub.length;
    sub.innerHTML = r.sub.map(esc).join('<br>').replace(/\{(\w+)\}/g, '<span data-live="$1"></span>');
    $('.hero .cta')?.remove();
    if (r.cta) $('.hero').insertAdjacentHTML('beforeend', `<button class="cta">${esc(r.cta)}</button>`);
    $('#hud nav').innerHTML = Object.entries(content.rooms).map(([k, v]) => `<a href="${urlFor(k)}" data-room="${k}"${k === id ? ' class="here"' : ''}>${v.nav}</a>`).join('')
      + `<span class="sep"></span><a data-view="0">WIDE</a><a data-view="1">${r.close}</a>`;
    const shelved = station.volumesCount, facts = r.facts.map(([k, v]) => [k, v.replace('{count} VOLUMES', `${shelved} VOLUME${shelved === 1 ? '' : 'S'}`)]);
    $('#hud > footer').innerHTML = facts.map(([k, v]) => `<div><b>${esc(k)}</b> ${esc(v)}</div>`).join('')
      + `<div class="hint"><span class="how"></span>${r.credit ? `<small>${content.credit}</small>` : ''}</div>`;
    display.paintHint(); tick();
  }
  function syncUrl() {
    if (silent) return;
    const f = station.focused.get(), id0 = station.room.get().id;
    const read = f?.url ?? null, [path, id] = (read ?? '').split('#'), url = read ? path + query() + (id ? `#${id}` : '') : urlFor(id0);
    if (location.pathname + location.search === url.split('#')[0]) { if (location.hash !== (id ? `#${id}` : '')) history.replaceState(null, '', url); }
    else history.pushState(null, '', url);
    document.title = (read && (f.title ?? titles.get(path))) || content.rooms[id0].title;
  }
  function readPost(url, fly) {
    silent++;
    try { return station.readAt(url, { fly }); } finally { silent--; }
  }
  function onLink(href) {
    if (href === null) return back();
    const here = station.room.get().id;
    const u = new URL(href, location.origin), [at] = roomAt(u.pathname.replace(/\/?$/, '/')), to = route(u);
    if (u.origin !== location.origin || (!at && u.pathname !== '/')) return false;
    if (to.read && to.id === here) {
      const now = station.focused.get()?.url?.split('#')[0];
      if (now === to.read.split('#')[0]) station.jump(u.hash.slice(1));
      else if (station.reads(to.read)) readPost(to.read, true);
      else return false;
    } else if (to.id === here) back();
    else { if (to.read) history.pushState(null, '', to.read.split('#')[0] + query() + u.hash); enter(to.id, !to.read); }
  }
  function clearance(x0, x1) {
    if (bar.hidden) return 0;
    let top = innerHeight;
    for (const el of bar.querySelectorAll('button, #named')) { const r = el.getBoundingClientRect(); if (r.width && r.right > x0 && r.left < x1) top = Math.min(top, r.top); }
    return innerHeight - top;
  }
  function back() {
    const wasReads = !!station.focused.get()?.reads; station.back();
    if (wasReads) (bar.querySelector('[aria-current], #enter:not([hidden]), [data-option]') ?? $('.hero .cta') ?? $('#back'))?.focus({ preventScroll: true });
  }
  const progress = (f) => { $('#progress').style.width = `${f * 100}%`; $('#pct').textContent = Math.round(f * 100); };
  station.room.subscribe((s) => {
    if (s.status !== 'loading') return;
    progress(s.progress);
    if (s.id === null && pushNext) {
      const id = pushNext; pushNext = null;
      unturn?.(); unturn = null;
      if (location.pathname + location.search !== urlFor(id)) history.pushState(null, '', urlFor(id));
    } else if (s.id === null) { unturn?.(); unturn = null; }
  });
  async function enter(id, push = true) {
    if (busy() || !isRoom(id) || id === station.room.get().id) return;
    inflight = true; pushNext = push ? id : null;
    const willPush = push && location.pathname + location.search !== urlFor(id);
    const loading = station.enter(id, { want: willPush ? undefined : route().read?.split('/')[2] });
    $('#what').textContent = content.rooms[id].loading; progress(0); loader.classList.remove('done'); hud.classList.add('hidden');
    try { await loading; } catch (e) { failed = true; inflight = false; throw e; }
    if (station.turn) unturn = turning(station.turn);
    display.room(content.rooms[id].hint);
    fillHud(id);
    document.body.classList.toggle('bright', !!content.rooms[id].bright);
    loader.classList.add('done'); hud.classList.remove('hidden'); inflight = false;
    if (roomInUrl() !== id) enter(roomInUrl(), false);
    else if (route().read && !plain()) readPost(route().read, false);
  }

  let downAt = null;
  const CLICK = 6;
  let hand = null, swept = false;
  const turnable = (turn) => turn.usable() && !plain();
  function turning(turn) {
    const TURN = turn.feel, ac = new AbortController(), on = (type, fn, o) => canvas.addEventListener(type, fn, { ...o, signal: ac.signal });
    let idle = 0, banked = 0;
    canvas.classList.add('turns');
    on('pointerdown', (e) => {
      if (hand) letGo(e);
      swept = false;
      if (!e.isPrimary || (e.pointerType === 'mouse' && e.button) || !turnable(turn)) return;
      const held = swept = turn.moving() && (turn.grab(), true);
      hand = { id: e.pointerId, x: e.clientX, y: e.clientY, on: false, held, a0: turn.angle(), per: turn.grip(), trail: [] };
    });
    on('pointermove', (e) => {
      if (!hand || e.pointerId !== hand.id) return;
      if (!e.buttons || !turnable(turn)) return letGo(e);
      const dx = e.clientX - hand.x, dy = e.clientY - hand.y;
      if (!hand.on) {
        if (Math.hypot(dx, dy) <= CLICK) return;
        if (Math.abs(dx) < Math.abs(dy) * TURN.SLOPE) return letGo(e);
        hand.on = swept = true; const a = turn.angle();
        hand.a0 = a === hand.a0 ? turn.grab() : turn.grab() - dx / hand.per;
        try { canvas.setPointerCapture(e.pointerId); } catch {}
      }
      turn.drag(hand.a0 + dx / hand.per);
      const tr = hand.trail; tr.push([e.timeStamp, turn.angle()]); while (tr.length > 2 && e.timeStamp - tr[1][0] > TURN.FLING * 1000) tr.shift();
    });
    function letGo(e) {
      const h = hand; hand = null; if (!h?.on && !h?.held) return;
      const tr = h.trail, a = tr[0], b = tr[tr.length - 1], span = b && (b[0] - a[0]) / 1000;
      turn.release(b && span > 0.008 && e.timeStamp - b[0] < TURN.FLING * 1000 ? (b[1] - a[1]) / span : 0);
    }
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) on(type, (e) => { if (hand && e.pointerId === hand.id) letGo(e); });
    on('wheel', (e) => {
      if (plain()) return;
      const d = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.shiftKey || TURN.VERTICAL ? e.deltaY : 0) * (e.deltaMode === 1 ? TURN.LINE : e.deltaMode === 2 ? innerWidth : 1);
      if (!d) return;
      e.preventDefault();
      if (!turnable(turn) || hand?.on) return;
      clearTimeout(idle);
      if (still) {
        banked += d; const n = Math.trunc(banked / TURN.STEP); banked -= n * TURN.STEP; if (n) turn.step(Math.sign(n));
        idle = setTimeout(() => { banked = 0; }, TURN.IDLE); return;
      }
      turn.drag(turn.angle() - d * TURN.WHEEL);
      idle = setTimeout(() => { if (!hand?.on) turn.release(0, -Math.sign(d) * TURN.LEAN); }, TURN.IDLE);
    }, { passive: false });
    return () => { ac.abort(); clearTimeout(idle); canvas.classList.remove('turns'); hand = null; swept = false; };
  }
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const size = () => station.resize(innerWidth, innerHeight, devicePixelRatio);
  size();
  addEventListener('resize', size);
  addEventListener('popstate', () => {
    const r = route();
    if (r.id !== station.room.get().id) enter(r.id, false);
    else if (r.read) {
      const now = station.focused.get()?.url;
      if (now?.split('#')[0] === r.read.split('#')[0]) station.jump(location.hash.slice(1)); else readPost(r.read, false);
    }
    else if (station.focused.get()?.reads) back();
  });
  addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; station.pointerGone(); display.pointing(e.pointerType); });
  addEventListener('pointerout', (e) => { if (!e.relatedTarget) station.pointerGone(); });
  addEventListener('blur', () => { station.pointerGone(); });
  document.addEventListener('visibilitychange', () => { station.setHidden(document.hidden); });
  addEventListener('pointermove', (e) => {
    display.pointing(e.pointerType);
    station.pointer(e.clientX, e.clientY, e.pointerType, { scene: e.target === canvas, steer: !hand?.on, at: e.timeStamp });
  });
  addEventListener('deviceorientation', (e) => {
    if (e.gamma != null && !hand?.on) station.tilt(e.gamma, e.beta);
  });
  addEventListener('click', (e) => {
    if (!station.room.get().id || busy() || plain() || !(e.target instanceof Element) || e.target.closest('#hud nav, #inspectbar, #reader, a, button')) return;
    if (swept || (downAt && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > CLICK)) return;
    station.tap(e.clientX, e.clientY);
  });
  addEventListener('keydown', (e) => {
    if (!station.room.get().id || busy() || plain()) return;
    const f = station.focused.get();
    if (f?.typing && e.key !== 'Escape') return;
    if (e.key === 'Escape') back();
    else if (e.key === 'Enter' && f?.canRead) station.read();
    else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); station.step(e.key === 'ArrowRight' ? 1 : -1); }
  });
  bar.addEventListener('click', (e) => {
    if (e.target.dataset.to) station.travel(e.target.dataset.to);
    if (e.target.id === 'enter' && station.focused.get()?.canRead) return station.read();
    const option = e.target.closest('[data-option]');
    if (option) {
      const ways = $('#ways'), again = ways.classList.contains('chosen') && option.hasAttribute('aria-current') && matchMedia('(max-width: 720px)').matches;
      ways.classList.toggle('chosen', !again); if (again) return;
      for (const b of bar.querySelectorAll('[data-option]')) { if (b === option) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); }
      station.choose(+option.dataset.option);
    }
    else ({ back, prev: () => station.step(-1), next: () => station.step(1) })[e.target.id]?.();
  });
  $('.hero').addEventListener('click', (e) => {
    const id = station.room.get().id;
    if (!e.target.closest('.cta') || !id) return;
    const reads = content.rooms[id].ctaReads; if (reads) readPost(reads, false); else station.focus(station.picks.get().find((p) => p.cta)?.id ?? null, { travel: false });
  });
  $('#hud nav').addEventListener('click', (e) => {
    const a = e.target.closest('a'); if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
    if (a.dataset.room) { e.preventDefault(); enter(a.dataset.room); }
    else station.setView(+a.dataset.view ? 'close' : 'wide');
  });
  station.hintTurnDone.subscribe((on) => { if (on) display.did('turn'); });
  station.onFrame(() => {
    if (!station.room.get().id || plain()) return display.frame(null);
    const id = station.pointed.get(), over = id && station.picks.get().find((p) => p.id === id);
    display.frame(over && !busy() && id !== focusNow?.pick && !focusNow?.reads && over.name ? over : null, station.wideAtRest.get());
  });

  initLive(content); $('#brand').textContent = content.brand; setInterval(tick, 500);
  let touched = false;
  const offer = () => new Promise((yes) => {
    const words = Object.fromEntries(Object.entries(content.reader).map(([k, v]) => [k, v.replace('{place}', content.rooms[route().id].place ?? '')])), b = Object.assign(document.createElement('button'), { id: 'stepin', type: 'button' });
    b.innerHTML = `<small>${esc(station.room.get().id ? words.ready : words.offer)}</small>${esc(words.enter)}`; b.addEventListener('click', () => { b.remove(); yes(undefined); }); document.body.append(b);
  });
  async function stepIn() {
    const read = route().read, at = [...document.querySelectorAll('#page .post-body h2[id]')].filter((h) => h.getBoundingClientRect().top < innerHeight * 0.4).pop()?.id;
    setMode('station'); scrollTo(0, 0); size(); station.setView('wide', { now: true });
    if (at) station.readerScrollTo(at);
    await readPost(read, false);
  }
  if (plain()) {
    for (const type of ['scroll', 'keydown', 'pointerdown', 'wheel']) addEventListener(type, () => { touched = true; }, { once: true, passive: true });
    if (navigator.connection?.saveData) await offer();
  }
  await enter(roomInUrl(), false);
  if (plain()) {
    if (!station.reads(route().read)) setMode('');
    else if (!touched && scrollY < 80) stepIn(); else offer().then(stepIn);
  }
  station.start();
  const dbg = station.debug;
  window.__lobby = { renderer: dbg.renderer, camera: dbg.camera, post: dbg.post, gov: dbg.gov, series: dbg.series, setFocus: dbg.setFocus, step: (d) => station.step(d), enter, ready: dbg.ready, display: { state: display.state },
    get turn() { return dbg.turn; },
    get scene() { return dbg.room?.scene; }, get picks() { return dbg.room?.picks ?? []; },
    ...(dbg.lightFrame && { lightFrame: dbg.lightFrame }),
    reader: { state: () => station.reader.get().state, url: () => station.reader.get().url, slug: () => station.reader.get().url?.split('#')[0].split('/').filter(Boolean).pop() ?? null,
      read: (what) => readPost(what.startsWith('/') ? what : `/blog/${what}/`, true), close: () => { if (station.focused.get()?.reads) back(); } },
    volumes: dbg.volumes, held: dbg.held, mode: dbg.mode };
  window.__station = station;
}
