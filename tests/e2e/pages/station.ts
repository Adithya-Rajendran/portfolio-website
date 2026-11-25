import type { BrowserContext, Page } from '@playwright/test';
import {
  attachErrorCollector,
  type SceneFocusBox,
  type WaysSnapshot,
} from '../fixtures/site.ts';

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface SnapState {
  room: string;
  state: string;
  url: string | null;
  path: string;
  hash: string;
  search: string;
  title: string;
  cls: string;
  readerShown: boolean;
  shown: string | null;
  h1: string | null;
  count: string | null;
  enter: boolean;
  bar: boolean;
  scrollTop: number;
}

export interface DisplayState {
  lock: { name: string; verb: string; rect: [number, number, number, number] } | null;
  named: string;
  hint: string;
  gliding: boolean;
  cue: { name: string; words: string; rect: [number, number, number, number] } | null;
}

export interface ReadBox {
  live: boolean;
  glyph: boolean;
  cx: number;
  cy: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  behind: boolean;
  onTop: string | null;
}

export interface PickSource {
  i: number;
  kind: string;
  screen: unknown;
  url: string | null;
}

export interface LookSnapshot {
  state: string;
  live: boolean;
  glyph: boolean;
  ReadGlyph?: number;
  ReadFrame?: number;
  ReadBeam?: number;
  ReadAnchor?: number;
  ScanSheet?: number;
  ScanFan?: number;
  ScanBody?: number;
  ReadFlow?: number;
  ReadPrint?: number;
  [key: string]: unknown;
}

export function boxCorners(boxes: SceneFocusBox[]): Array<Array<[number, number, number]>> {
  return boxes.map((b) => {
    const [w, d, h] = b.size;
    const hx = w / 2;
    const hy = h / 2;
    const hz = d / 2;
    const c = Math.cos(b.turn || 0);
    const s = Math.sin(b.turn || 0);
    const out: Array<[number, number, number]> = [];
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const X = sx * hx;
          const Y = sy * hy;
          const Z = sz * hz;
          out.push([b.c[0] + X * c + Z * s, b.c[2] + Y, -b.c[1] + (-X * s + Z * c)]);
        }
      }
    }
    return out;
  });
}

export class ReaderPage {
  constructor(readonly page: Page) {}

  async state(): Promise<string> {
    return this.page.evaluate(() => (window as any).__lobby.reader.state());
  }

  async read(slugOrUrl: string): Promise<void> {
    await this.page.evaluate((u) => (window as any).__lobby.reader.read(u), slugOrUrl);
  }

  async close(): Promise<void> {
    await this.page.evaluate(() => (window as any).__lobby.reader.close());
  }

  async snap(): Promise<SnapState> {
    return this.page.evaluate(() => {
      const l = (window as any).__lobby;
      const r = document.querySelector('#reader') as HTMLElement | null;
      const vis = (e: HTMLElement | null) =>
        !!e && !(e as HTMLElement & { hidden: boolean }).hidden && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
      const en = document.querySelector('#enter') as HTMLElement | null;
      return {
        room: l.mode().room,
        state: l.reader.state(),
        url: l.reader.url(),
        path: location.pathname,
        hash: location.hash,
        search: location.search,
        title: document.title,
        cls: document.documentElement.className,
        readerShown: vis(r),
        shown: r?.querySelector<HTMLElement>('article.post')?.dataset.slug ?? (r?.querySelector('section.post-list') ? 'list' : null),
        h1: r?.querySelector('h1')?.textContent?.trim() ?? null,
        count: document.querySelector('#count')?.textContent ?? null,
        enter: vis(en),
        bar: vis(document.querySelector('#inspectbar') as HTMLElement | null),
        scrollTop: Math.round(document.querySelector('.reader-scroll')?.scrollTop ?? -1),
      };
    });
  }

  async frameChecks(W: number, H: number): Promise<Array<[boolean, string, unknown]>> {
    const out: Array<[boolean, string, unknown]> = [];
    const g = await this.page.evaluate(() => {
      const r = document.querySelector('#reader') as HTMLElement;
      const q = r.getBoundingClientRect();
      const de = document.documentElement;
      const over: string[] = [];
      for (const e of r.querySelectorAll('*')) {
        if (e.closest('pre')) continue;
        const b = e.getBoundingClientRect();
        if (b.width && (b.right > innerWidth + 1 || b.right > q.right + 1 || b.left < -1)) {
          over.push(`${e.tagName.toLowerCase()}.${e.className}:${Math.round(b.right)}`);
        }
      }
      const cover: string[] = [];
      for (const fx of [0.05, 0.3, 0.5, 0.7, 0.95]) {
        for (const fy of [0.05, 0.3, 0.5, 0.7, 0.95]) {
          const x = q.left + q.width * fx;
          const y = q.top + q.height * fy;
          const t = document.elementFromPoint(x, y);
          if (!t || !r.contains(t)) cover.push(`${Math.round(x)},${Math.round(y)}:${t?.tagName}#${t?.id}`);
        }
      }
      const c = document.querySelector('.reader-close') as HTMLElement;
      const cr = c.getBoundingClientRect();
      const ct = document.elementFromPoint(cr.x + cr.width / 2, cr.y + cr.height / 2);
      return {
        rect: [q.left, q.top, q.right, q.bottom].map((x) => Math.round(x * 10) / 10),
        hidden: r.hidden,
        clip: r.style.clipPath,
        sw: [de.scrollWidth, document.body.scrollWidth, r.scrollWidth, r.clientWidth, innerWidth],
        over,
        cover,
        sx: scrollX,
        sy: scrollY,
        close: { rect: [cr.left, cr.right].map(Math.round), onTop: ct === c },
      };
    });
    out.push([
      !g.hidden && g.rect[0] >= -0.5 && g.rect[1] >= -0.5 && g.rect[2] <= W + 0.5 && g.rect[3] <= H + 0.5,
      'the reader element lies inside the viewport',
      g.rect,
    ]);
    await this.page.waitForTimeout(1500);
    const tf = await this.page.evaluate(() => {
      const r = document.querySelector('#reader') as HTMLElement;
      return { inline: r.style.transform, computed: getComputedStyle(r).transform };
    });
    out.push([
      /^translate\(-?[\d.]+px, -?[\d.]+px\)$/.test(tf.inline) && /^matrix\(1, 0, 0, 1, -?[\d.]+, -?[\d.]+\)$/.test(tf.computed),
      'once open, its transform is a plain translate(...)',
      tf,
    ]);
    out.push([g.clip === '', 'the reveal clip is gone once open', g.clip]);
    out.push([
      g.sw[0] <= g.sw[4] && g.sw[1] <= g.sw[4] && g.sw[2] <= g.sw[3] + 1 && g.over.length === 0 && g.sx === 0,
      'nothing overflows the page horizontally',
      { scrollWidth: g.sw, out: g.over.slice(0, 5), scrollX: g.sx },
    ]);
    out.push([g.close.rect[0] >= 0 && g.close.rect[1] <= W && g.close.onTop, 'the CLOSE button is on the screen and can be pressed', g.close]);
    out.push([g.cover.length === 0, 'nothing but the reader is on top of it (25 points)', g.cover.slice(0, 5)]);
    return out;
  }
}

export class StationPage {
  readonly reader: ReaderPage;

  constructor(readonly page: Page) {
    this.reader = new ReaderPage(page);
  }

  static async open(
    ctx: BrowserContext,
    path: string,
    roomId: string,
    errs: string[],
    { pin = true, timeout = 150_000 }: { pin?: boolean; timeout?: number } = {},
  ): Promise<StationPage> {
    const page = await ctx.newPage();
    attachErrorCollector(page, errs);
    const station = new StationPage(page);
    await page.goto(`${path}${pin ? (path.includes('?') ? '&' : '?') + 'shot=hero&rollat=20' : ''}`);
    await station.inRoom(roomId, timeout);
    await page.waitForTimeout(1000);
    return station;
  }

  async inRoom(roomId: string, timeout = 150_000): Promise<boolean> {
    return this.page
      .waitForFunction(
        (id) => (window as any).__lobby?.mode().room === id && !!document.querySelector('#loader.done'),
        roomId,
        { timeout, polling: 250 },
      )
      .then(
        () => true,
        () => false,
      );
  }

  async until<T = undefined>(fn: (arg: T) => unknown, arg?: T, timeout = 60_000): Promise<boolean> {
    return this.page
      .waitForFunction(fn as (arg: T) => boolean, arg as T, { timeout, polling: 150 })
      .then(
        () => true,
        () => false,
      );
  }

  async poke(sel: string, phone: boolean): Promise<true | string> {
    try {
      await (phone ? this.page.tap(sel, { timeout: 15_000 }) : this.page.click(sel, { timeout: 15_000 }));
      return true;
    } catch (e) {
      return String((e as Error).message).split('\n')[0];
    }
  }

  async tapAt(x: number, y: number, phone: boolean): Promise<void> {
    if (phone) await this.page.touchscreen.tap(x, y);
    else await this.page.mouse.click(x, y);
  }

  async focus(i: number): Promise<void> {
    await this.page.evaluate((idx) => {
      const l = (window as any).__lobby;
      l.setFocus(l.picks[idx]);
    }, i);
  }

  async clearFocus(): Promise<void> {
    await this.page.evaluate(() => {
      (window as any).__lobby.setFocus(null);
    });
  }

  async enter(roomId: string): Promise<void> {
    await this.page.evaluate((id) => (window as any).__lobby.enter(id), roomId);
  }

  async step(delta: number): Promise<void> {
    await this.page.evaluate((d) => (window as any).__lobby.step(d), delta);
  }

  async sources(): Promise<PickSource[]> {
    return this.page.evaluate(() =>
      (window as any).__lobby.picks
        .map((q: any, i: number) => ({
          i,
          kind: q.mesh.userData?.screen !== undefined ? 'screen' : q.mesh.geometry.type === 'SphereGeometry' ? 'sphere' : q.mesh.geometry.type,
          screen: q.mesh.userData?.screen ?? null,
          url: q.source?.()?.url ?? null,
        }))
        .filter((q: PickSource) => q.url),
    );
  }

  async dstate(): Promise<DisplayState> {
    return this.page.evaluate(() => (window as any).__lobby.display.state());
  }

  async canvasTexts(): Promise<Array<{ w: number; h: number; t: Array<[string, number, number]> }>> {
    return this.page.evaluate(() =>
      [...((window as any).__canvases ?? [])]
        .filter((c: any) => c.__t?.length)
        .map((c: any) => ({ w: c.width, h: c.height, t: c.__t })),
    );
  }

  async planePoint(pickIndex: number, cw: number, ch: number, x: number, y: number): Promise<{ x: number; y: number; z: number }> {
    return this.page.evaluate(
      async ({ i, cw, ch, x, y }) => {
        const THREE = await import('three');
        const l = (window as any).__lobby;
        const m = l.picks[i].mesh;
        l.camera.updateMatrixWorld(true);
        m.updateWorldMatrix(true, false);
        const g = m.geometry.parameters;
        const v = new THREE.Vector3((x / cw - 0.5) * g.width, (0.5 - y / ch) * g.height, 0).applyMatrix4(m.matrixWorld).project(l.camera);
        return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight, z: v.z };
      },
      { i: pickIndex, cw, ch, x, y },
    );
  }

  async readBox(): Promise<ReadBox> {
    return this.page.evaluate(async () => {
      const THREE = await import('three');
      const l = (window as any).__lobby;
      const pick = l.picks.find((q: any) => q.reads);
      const m = pick.mesh;
      l.camera.updateMatrixWorld(true);
      m.updateWorldMatrix(true, false);
      const pts = [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
        [0, 0],
      ].map(([x, y]) => {
        const g = m.geometry.parameters;
        const v = new THREE.Vector3((x * g.width) / 2, (y * g.height) / 2, 0).applyMatrix4(m.matrixWorld).project(l.camera);
        return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight, z: v.z };
      });
      const xs = pts.slice(0, 4).map((q) => q.x);
      const ys = pts.slice(0, 4).map((q) => q.y);
      const c = pts[4];
      const top = document.elementFromPoint(c.x, c.y);
      return {
        live: !!pick.live(),
        glyph: m.parent.visible,
        cx: c.x,
        cy: c.y,
        left: Math.min(...xs),
        right: Math.max(...xs),
        top: Math.min(...ys),
        bottom: Math.max(...ys),
        behind: pts.some((q) => q.z > 1),
        onTop: top ? `${top.tagName.toLowerCase()}${top.id ? '#' + top.id : ''}` : null,
      };
    });
  }

  async settledBox(): Promise<ReadBox> {
    const eye = () => this.page.evaluate(() => (window as any).__lobby.camera.position.toArray() as [number, number, number]);
    let a = await this.readBox();
    let e = await eye();
    for (let i = 0, calm = 0; i < 60 && calm < 4; i++) {
      await this.page.waitForTimeout(300);
      const b = await this.readBox();
      const f = await eye();
      const still = Math.hypot(a.cx - b.cx, a.cy - b.cy) < 0.5 && Math.hypot(e[0] - f[0], e[1] - f[1], e[2] - f[2]) < 1e-4;
      a = b;
      e = f;
      calm = still && b.live && b.glyph ? calm + 1 : 0;
    }
    return a;
  }

  async rayHits(x: number, y: number): Promise<Array<[number, string, number]>> {
    let hits: Array<[number, string, number]> = [];
    for (let n = 0; n < 4 && !hits.length; n++) {
      if (n) await this.page.waitForTimeout(400);
      hits = await this.page.evaluate(
        async ({ x, y }) => {
          const THREE = await import('three');
          const l = (window as any).__lobby;
          const ray = new THREE.Raycaster();
          const live = l.picks.filter((q: any) => !q.live || q.live());
          l.camera.updateMatrixWorld(true);
          for (const q of live) q.mesh.updateWorldMatrix(true, false);
          ray.setFromCamera(new THREE.Vector2((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1), l.camera);
          return ray
            .intersectObjects(
              live.map((q: any) => q.mesh),
              false,
            )
            .map((h: any) => [l.picks.findIndex((q: any) => q.mesh === h.object), h.object.geometry.type, +h.distance.toFixed(2)]);
        },
        { x, y },
      );
    }
    return hits;
  }

  async readNow(phone: boolean, how: 'glyph' | 'button' = 'glyph', timeout = 60_000): Promise<{ ok: boolean; t: number; pressed: true | string }> {
    await this.until(() => {
      const q = (window as any).__lobby.picks.find((x: any) => x.reads);
      return q.live() && q.mesh.parent.visible;
    }, undefined, 20_000);
    await this.page.waitForTimeout(500);
    const t = Date.now();
    let pressed: true | string = true;
    if (how === 'button') {
      pressed = await this.poke('#enter', phone);
    } else {
      const r = await this.settledBox();
      await this.page.mouse.move(r.cx, r.cy);
      await this.page.waitForTimeout(100);
      await this.tapAt(r.cx, r.cy, phone);
    }
    const ok = await this.until(() => (window as any).__lobby.reader.state() === 'open', undefined, timeout);
    return { ok, t, pressed };
  }

  async leave(phone: boolean): Promise<boolean> {
    if (phone) await this.poke('.reader-close', true);
    else await this.page.keyboard.press('Escape');
    let ok = await this.until(() => (window as any).__lobby.reader.state() === 'closed', undefined, 8000);
    if (!ok && phone) {
      await this.poke('#back', true);
      ok = await this.until(() => (window as any).__lobby.reader.state() === 'closed', undefined, 8000);
    }
    await this.page.waitForTimeout(800);
    return ok;
  }

  async look(): Promise<LookSnapshot> {
    return this.page.evaluate(() => {
      const l = (window as any).__lobby;
      const c: Record<string, number> = {};
      const shown = (o: any) => {
        for (let e = o; e; e = e.parent) if (!e.visible) return false;
        return true;
      };
      l.scene.traverse((o: any) => {
        if (/^(Read|Scan)/.test(o.name) && shown(o)) c[o.name] = (c[o.name] || 0) + 1;
      });
      const q = l.picks.find((x: any) => x.reads);
      return { state: l.reader.state(), ...c, live: !!q?.live(), glyph: !!q && q.mesh.parent.visible };
    });
  }

  async camStill(timeout = 90_000): Promise<boolean> {
    const eye = () =>
      this.page.evaluate(
        () => [...(window as any).__lobby.camera.position.toArray(), (window as any).__lobby.display.state().gliding] as [number, number, number, boolean],
      );
    let a = await eye();
    let calm = 0;
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      await sleep(300);
      const b = await eye();
      calm = !b[3] && Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 0.05 ? calm + 1 : 0;
      a = b;
      if (calm >= 4) return true;
    }
    return false;
  }

  async pickPoint(i: number): Promise<{ x: number; y: number; inside: boolean; reaches: boolean; top: string | null }> {
    return this.page.evaluate(async (idx) => {
      const THREE = await import('three');
      const l = (window as any).__lobby;
      const m = l.picks[idx].mesh;
      const ray = new THREE.Raycaster();
      l.camera.updateMatrixWorld(true);
      m.updateWorldMatrix(true, false);
      m.geometry.computeBoundingSphere();
      const v = m.geometry.boundingSphere.center.clone().applyMatrix4(m.matrixWorld).project(l.camera);
      const x = (v.x * 0.5 + 0.5) * innerWidth;
      const y = (-v.y * 0.5 + 0.5) * innerHeight;
      const live = l.picks.filter((q: any) => !q.live || q.live());
      ray.setFromCamera(new THREE.Vector2(v.x, v.y), l.camera);
      const hit = ray.intersectObjects(
        live.map((q: any) => q.mesh),
        false,
      )[0];
      return {
        x,
        y,
        inside: x > 4 && x < innerWidth - 4 && y > 4 && y < innerHeight - 4 && v.z < 1,
        reaches: hit?.object === m,
        top: document.elementFromPoint(x, y)?.id ?? null,
      };
    }, i);
  }

  async canvasPoint(fx: number, fy: number): Promise<{ x: number; y: number; d: number } | null> {
    return this.page.evaluate(
      ([fxArg, fyArg]) => {
        let best: { x: number; y: number; d: number } | null = null;
        for (let gy = 0.05; gy < 1; gy += 0.05) {
          for (let gx = 0.05; gx < 1; gx += 0.05) {
            const x = gx * innerWidth;
            const y = gy * innerHeight;
            if (document.elementFromPoint(x, y)?.id !== 'scene') continue;
            const d = Math.hypot(gx - fxArg, gy - fyArg);
            if (!best || d < best.d) best = { x, y, d };
          }
        }
        return best;
      },
      [fx, fy] as [number, number],
    );
  }

  async markWays(): Promise<WaysSnapshot> {
    return this.page.evaluate(() => (window as any).__w.mark());
  }

  readonly gate = {
    shut: async () => {
      await this.page.evaluate(() => {
        (window as any).__gate.open = false;
        (window as any).__gate.n = 0;
      });
    },
    open: async () => {
      await this.page.evaluate(() => {
        (window as any).__gate.open = true;
      });
    },
    step: async (n: number) => {
      await this.page.evaluate((count) => {
        (window as any).__gate.n = count;
      }, n);
      await this.page.waitForFunction(() => (window as any).__gate.n <= 0, undefined, { timeout: 120_000, polling: 40 });
      await sleep(250);
    },
  };

  readonly pen = {
    down: async (x: number, y: number) => {
      await this.page.evaluate(
        ([px, py]) =>
          document.querySelector('#scene')!.dispatchEvent(
            new PointerEvent('pointerdown', {
              pointerType: 'pen',
              pointerId: 7,
              isPrimary: true,
              button: 0,
              buttons: 1,
              clientX: px,
              clientY: py,
              bubbles: true,
              cancelable: true,
            }),
          ),
        [x, y] as [number, number],
      );
    },
    move: async (x: number, y: number) => {
      await this.page.evaluate(
        ([px, py]) =>
          document.querySelector('#scene')!.dispatchEvent(
            new PointerEvent('pointermove', {
              pointerType: 'pen',
              pointerId: 7,
              isPrimary: true,
              buttons: 1,
              clientX: px,
              clientY: py,
              bubbles: true,
            }),
          ),
        [x, y] as [number, number],
      );
    },
    up: async (x: number, y: number) => {
      await this.page.evaluate(
        ([px, py]) =>
          document.querySelector('#scene')!.dispatchEvent(
            new PointerEvent('pointerup', {
              pointerType: 'pen',
              pointerId: 7,
              isPrimary: true,
              button: 0,
              buttons: 0,
              clientX: px,
              clientY: py,
              bubbles: true,
            }),
          ),
        [x, y] as [number, number],
      );
    },
  };
}
