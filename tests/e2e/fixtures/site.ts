import { test as base, expect, type APIRequestContext, type Page } from '@playwright/test';

export interface ProjectEntry {
  slug: string;
  url: string;
  name: string;
  title: string;
  summary: string;
  status: string;
  status_label: string;
  period: string | null;
  year: string | null;
  types: string[];
  role: string | null;
  technologies: string[];
  featured: number | null;
  quiet: boolean;
}

export interface ProfileData {
  v: string;
  name: string;
  headline: string;
  tagline: string;
  location: string;
  introduction: string;
  focus: string[];
  availability: { status: string; label: string; seeking: string[] } | null;
  curiosities: Array<{ kind: string | null; title: string; note: string | null; url: string | null }>;
  timeline: Array<{
    id: string;
    url: string;
    kind: string;
    title: string;
    organization: string;
    org_short: string;
    period: string;
    year: string;
    current: boolean;
    location: string | null;
    employment: string | null;
    summary: string | null;
  }>;
  links: Array<{ label: string; url: string }>;
  contact: {
    intro: string;
    invitation: string;
    email: string | null;
    routes: Array<{ id: string; title: string; prompt: string }>;
  };
  resume: string | null;
}

export interface BlogPostEntry {
  slug: string;
  url: string;
  title: string;
  description: string;
  published: string;
  revised: string | null;
  date: string;
  minutes: number;
  words: number;
  tags: string[];
  sections: Array<{ id: string; title: string; level: number }>;
}

export interface ContentData {
  display: {
    hint: { pointer: string; touch: string; [key: string]: string };
    [key: string]: unknown;
  };
  rooms: {
    projects: { path: string; exhibits: string[]; [key: string]: unknown };
    experience: { path: string; hint: { pointer: string; touch: string; until?: string }; [key: string]: unknown };
    [key: string]: { path?: string; [key: string]: unknown };
  };
  [key: string]: unknown;
}

export interface SceneFocusBox {
  c: [number, number, number];
  size: [number, number, number];
  turn?: number;
  reads?: boolean;
}

export interface SceneData {
  focus: Array<{ c: [number, number, number]; r: number; dir: [number, number, number]; boxes?: SceneFocusBox[] }>;
  [key: string]: unknown;
}

export interface SiteData {
  projects: ProjectEntry[];
  profile: ProfileData;
  content: ContentData;
  posts: BlogPostEntry[];
}

export interface ProfileMeta {
  name: 'desktop' | 'phone' | 'reduced';
  phone: boolean;
  still: boolean;
  kind: 'pointer' | 'touch';
  width: number;
  height: number;
}

export const ROOM_OF: Record<string, string> = {
  '/': 'lobby',
  '/about/': 'about',
  '/portfolio/': 'projects',
  '/experience/': 'experience',
  '/blog/': 'writing',
  '/contact/': 'comms',
};

export async function loadJson<T>(request: APIRequestContext, path: string): Promise<T> {
  const res = await request.get(path);
  expect(res.status(), `GET ${path} should succeed`).toBe(200);
  return (await res.json()) as T;
}

export async function loadSiteData(request: APIRequestContext): Promise<SiteData> {
  const [portfolio, profile, content, blog] = await Promise.all([
    loadJson<{ v: string; projects: ProjectEntry[] }>(request, '/portfolio/index.json'),
    loadJson<ProfileData>(request, '/profile.json'),
    loadJson<ContentData>(request, '/content.json'),
    loadJson<{ v: string; posts: BlogPostEntry[] }>(request, '/blog/index.json'),
  ]);
  return {
    projects: portfolio.projects,
    profile,
    content,
    posts: blog.posts,
  };
}

export function attachErrorCollector(page: Page, errors: string[] = []): string[] {
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 300)}`);
  });
  page.on('requestfailed', (r) => (r.failure()?.errorText === 'net::ERR_ABORTED' && /^\/assets\/[^/]+\/tex\/[^/]+\.ktx2$/.test(new URL(r.url()).pathname)) || errors.push(`request failed: ${r.url()} ${r.failure()?.errorText ?? ''}`));
  page.on('response', (r) => {
    if (r.status() >= 400) errors.push(`http ${r.status()}: ${r.url()}`);
  });
  return errors;
}

/** Browser init script: logs canvas 2D text on each canvas (canvas.__t) and tracks canvases in window.__canvases. */
export const canvasSpyInitScript = () => {
  const P = CanvasRenderingContext2D.prototype;
  const ft = P.fillText;
  const fr = P.fillRect;
  const cr = P.clearRect;
  const reset = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
    if (x === 0 && y === 0 && w >= c.canvas.width && h >= c.canvas.height) {
      (c.canvas as unknown as { __t: Array<[string, number, number]> }).__t = [];
    }
  };
  P.fillText = function (s: string, x: number, y: number, ...r: number[]) {
    const canvas = this.canvas as unknown as { __t?: Array<[string, number, number]> };
    (canvas.__t ??= []).push([String(s), x, y]);
    return ft.call(this, s, x, y, ...r);
  };
  P.fillRect = function (x: number, y: number, w: number, h: number) {
    reset(this, x, y, w, h);
    return fr.call(this, x, y, w, h);
  };
  P.clearRect = function (x: number, y: number, w: number, h: number) {
    reset(this, x, y, w, h);
    return cr.call(this, x, y, w, h);
  };
  const gc = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (...a: unknown[]) {
    const win = window as unknown as { __canvases?: Set<HTMLCanvasElement> };
    (win.__canvases ??= new Set()).add(this);
    return gc.apply(this, a as Parameters<typeof gc>);
  };
};

/** Browser init script: 25ms poller recording reader states and opening meshes in window.__w. */
export const waysRecorderInitScript = () => {
  const NAMES = ['ReadGlyph', 'ReadFrame', 'ReadBeam', 'ReadAnchor', 'ScanSheet', 'ScanFan', 'ScanBody', 'ReadFlow', 'ReadPrint'];
  const fresh = () => ({
    n: 0,
    states: [] as string[],
    max: {} as Record<string, number>,
    byState: {} as Record<string, Record<string, number>>,
    word: 0,
    live: false,
    dark: 0,
    astray: 0,
  });
  const win = window as unknown as Record<string, unknown>;
  const W = {
    rec: fresh(),
    mark() {
      const r = W.rec;
      W.rec = fresh();
      return r;
    },
  };
  win.__w = W;
  const shown = (o: { visible: boolean; parent: unknown } | null) => {
    for (let e = o as { visible: boolean; parent: unknown } | null; e; e = e.parent as { visible: boolean; parent: unknown } | null) {
      if (!e.visible) return false;
    }
    return true;
  };
  setInterval(() => {
    const l = win.__lobby as {
      scene?: { traverse: (fn: (o: Record<string, unknown>) => void) => void };
      reader: { state: () => string };
      picks: Array<{ reads?: boolean; live?: () => boolean }>;
    } | undefined;
    if (!l?.scene) return;
    const r = W.rec;
    const st = l.reader.state();
    const c: Record<string, number> = {};
    let glyph: Record<string, unknown> | null = null;
    let dark = 0;
    r.n++;
    if (r.states[r.states.length - 1] !== st) r.states.push(st);
    l.scene.traverse((o) => {
      const name = String(o.name ?? '');
      if (NAMES.includes(name)) {
        if (name === 'ReadGlyph') glyph = o;
        if (shown(o as unknown as { visible: boolean; parent: unknown })) c[name] = (c[name] || 0) + 1;
      } else if (o.isSprite && (o.userData as { pane?: unknown })?.pane && ((o.material as { opacity: number }).opacity < 0.01)) {
        dark++;
      }
    });
    const by = (r.byState[st] ??= {});
    for (const k of NAMES) {
      const n = c[k] || 0;
      r.max[k] = Math.max(r.max[k] || 0, n);
      by[k] = Math.max(by[k] || 0, n);
    }
    if (glyph) {
      const mat = (glyph as { material: { uniforms: { uWord: { value: number } } } }).material;
      r.word = Math.max(r.word, mat.uniforms.uWord.value);
    }
    r.dark = Math.max(r.dark, dark);
    if (l.picks.find((q) => q.reads)?.live?.()) r.live = true;
    const host = document.querySelector('#reader') as HTMLElement | null;
    if (host && !host.hidden) {
      const q = host.getBoundingClientRect();
      r.astray = Math.max(r.astray, -q.left, -q.top, q.right - innerWidth, q.bottom - innerHeight);
    }
  }, 25);
};

/** Browser init script: requestAnimationFrame gate in window.__gate. */
export const frameGateInitScript = () => {
  const raf = window.requestAnimationFrame.bind(window);
  const g = ((window as unknown as Record<string, unknown>).__gate = { open: true, n: 0, stamp: -1 });
  window.requestAnimationFrame = (cb) => {
    const go = (t: number) => {
      if (g.open || g.stamp === t) return cb(t);
      if (g.n > 0) {
        g.n--;
        g.stamp = t;
        return cb(t);
      }
      raf(go);
    };
    return raf(go);
  };
};

export interface WaysSnapshot {
  n: number;
  states: string[];
  max: Record<string, number>;
  byState: Record<string, Record<string, number>>;
  word: number;
  live: boolean;
  dark: number;
  astray: number;
}

export const test = base.extend<{
  siteData: SiteData;
  profile: ProfileMeta;
}>({
  siteData: async ({ request }, use) => {
    const data = await loadSiteData(request);
    await use(data);
  },
  profile: async ({}, use, testInfo) => {
    const name = (testInfo.project.name === 'phone' || testInfo.project.name === 'reduced'
      ? testInfo.project.name
      : 'desktop') as ProfileMeta['name'];
    const useOpts = testInfo.project.use;
    const viewport = useOpts.viewport ?? { width: 1280, height: 720 };
    const phone = name === 'phone' || !!useOpts.isMobile;
    const still = name === 'reduced' || useOpts.reducedMotion === 'reduce';
    await use({
      name,
      phone,
      still,
      kind: phone ? 'touch' : 'pointer',
      width: viewport.width,
      height: viewport.height,
    });
  },
});

export { expect };
