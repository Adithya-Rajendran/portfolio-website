// End-to-end spec for the plain pages on desktop and phone
import { chromium, type BrowserContext, type Page, type TestInfo } from '@playwright/test';
import { expect, test } from '../fixtures/site.ts';
import { plainChecks, type PlainPageKind } from '../helpers/plaincheck.ts';

const SIZES: Array<[string, { width: number; height: number }]> = [
  ['desktop', { width: 1280, height: 720 }],
  ['phone', { width: 390, height: 844 }],
];
const NO_WEBGL = ['--disable-gpu', '--disable-webgl', '--disable-3d-apis', '--disable-software-rasterizer'];

async function webglNotice(p: Page): Promise<{ text: string; links: number; covered: string }> {
  return p.evaluate(() => {
    const n = document.querySelector('#nogl') as HTMLElement | null;
    if (!n || n.hidden || !n.getClientRects().length) return { text: '', links: 0, covered: '' };
    n.scrollIntoView({ block: 'center' });
    const r = n.getBoundingClientRect();
    const t = document.elementFromPoint(r.left + 8, r.top + Math.min(r.height / 2, 20));
    const covered = t && (n === t || n.contains(t)) ? '' : t ? t.tagName.toLowerCase() + (t.id ? '#' + t.id : '') : 'nothing';
    scrollTo(0, 0);
    return { text: (n.textContent || '').trim(), links: n.querySelectorAll('a[href]').length, covered };
  });
}

async function imageChecks(p: Page): Promise<{ found: string[]; notes: string[]; n: number }> {
  const tall = await p.evaluate(() => [document.scrollingElement!.scrollHeight, innerHeight] as const);
  for (let y = 0; y <= tall[0]; y += tall[1] * 0.7) {
    await p.evaluate((scrollYPos) => scrollTo(0, scrollYPos), y);
    await p.waitForTimeout(60);
  }
  for (
    let n = 0;
    n < 80 && !(await p.evaluate(() => [...document.querySelectorAll('main#page img')].every((i) => (i as HTMLImageElement).complete)));
    n++
  ) {
    await p.waitForTimeout(100);
  }
  return p.evaluate(() => {
    const found: string[] = [];
    const notes: string[] = [];
    const imgs = [...document.querySelectorAll('main#page img')] as HTMLImageElement[];
    const W = innerWidth;
    for (const i of imgs) {
      const name = `${i.className || 'img'} ${(i.getAttribute('src') || '').split('/').pop()?.slice(0, 36) ?? ''}`;
      const r = i.getBoundingClientRect();
      const box = i.parentElement!.closest('li, figure, section, article, p, div') ?? i.parentElement!;
      const c = box.getBoundingClientRect();
      const cs = getComputedStyle(box);
      const inner = { left: c.left + parseFloat(cs.paddingLeft), right: c.right - parseFloat(cs.paddingRight) };
      if (!i.naturalWidth) found.push(`${name}: did not load`);
      if (r.width > W + 0.5 || r.right > W + 0.5 || r.left < -0.5) found.push(`${name}: ${Math.round(r.left)}..${Math.round(r.right)} in a ${W} px window`);
      if (r.width > inner.right - inner.left + 1 || r.left < c.left - 1 || r.right > c.right + 1) {
        found.push(
          `${name}: ${Math.round(r.width)} px wide in a container ${Math.round(c.width)} px wide (${box.tagName.toLowerCase()}.${box.className}, content ${Math.round(inner.right - inner.left)})`,
        );
      }
      const aw = +(i.getAttribute('width') || 0);
      const ah = +(i.getAttribute('height') || 0);
      if (aw && ah && r.width && r.height && Math.abs(r.width / r.height - aw / ah) / (aw / ah) > 0.03) {
        found.push(`${name}: shown ${Math.round(r.width)}x${Math.round(r.height)}, written ${aw}x${ah} (distorted)`);
      }
      if (r.width && r.height && Math.max(r.width, r.height) > 0.6 * Math.max(innerWidth, 400) && /logo|badge/.test(i.className)) {
        notes.push(`${name}: a ${/logo/.test(i.className) ? 'logo' : 'badge'} shown ${Math.round(r.width)}x${Math.round(r.height)} in a ${W} px window`);
      }
      if (/logo|badge/.test(i.className)) {
        notes.push(`${i.className}: ${Math.round(r.width)}x${Math.round(r.height)} (written ${aw}x${ah}, file ${i.naturalWidth}x${i.naturalHeight})`);
      }
    }
    scrollTo(0, 0);
    return { found, notes: [...new Set(notes)], n: imgs.length };
  });
}

async function checkPlainPage(
  ctx: BrowserContext,
  item: 11 | 12,
  path: string,
  kind: PlainPageKind,
  size: string,
  testInfo: TestInfo,
): Promise<string[]> {
  const where = `[${item}] ${path} ${size}`;
  const p = await ctx.newPage();
  const errs: string[] = [];
  const failures: string[] = [];
  p.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
  p.on('console', (m) => {
    if (m.type() === 'error') errs.push(`console: ${m.text().slice(0, 200)}`);
  });
  p.on('response', (r) => {
    if (r.status() >= 400) errs.push(`http ${r.status()} ${r.url()}`);
  });

  try {
    const res = await p.goto(path, { waitUntil: 'load' });
    if (res?.status() !== 200) failures.push(`${where}: status ${res?.status()}`);

    if (item === 12) {
      const gl = await p.evaluate(() => {
        const c = document.createElement('canvas');
        return [c.getContext('webgl2'), document.createElement('canvas').getContext('webgl')].map((x) => !!x);
      });
      if (gl[0] || gl[1]) failures.push(`${where}: canvas.getContext('webgl2') / ('webgl') exist: ${JSON.stringify(gl)}`);

      const done = await p
        .waitForFunction(() => !!document.querySelector('#loader')?.getAttribute('data-failed'), undefined, { timeout: 60_000 })
        .then(
          () => true,
          () => false,
        );
      if (!done) failures.push(`${where}: main.js did not give up on WebGL (#loader[data-failed])`);
      await p.waitForTimeout(1200);

      const o = await p.evaluate(() => {
        const l = document.querySelector('#loader') as HTMLElement;
        const s = getComputedStyle(l);
        return {
          cls: document.documentElement.className,
          loader: s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0 || l.getClientRects().length === 0,
          what: document.querySelector('#what')?.textContent,
        };
      });
      if (o.cls !== '' || !o.loader) {
        failures.push(`${where}: loader/error cover over page (html class "${o.cls}", loader hidden ${o.loader}, text "${o.what}")`);
      }
      const note = await webglNotice(p);
      if (!/WebGL/.test(note.text)) failures.push(`${where}: no visible notice #nogl that the station needs WebGL`);
      if (note.covered) failures.push(`${where}: the notice #nogl is covered by ${note.covered}`);
    }

    const { found } = await plainChecks(p, kind);
    for (const [name, list] of Object.entries(found)) {
      if (list.length > 0) {
        failures.push(`${where}: ${name}: ${list.slice(0, 6).join(' | ')}${list.length > 6 ? ` | (+${list.length - 6})` : ''}`);
      }
    }

    const imgs = await imageChecks(p);
    for (const f of imgs.found) failures.push(`${where}: ${f}`);

    for (const e of [...new Set(errs)]) failures.push(`${where}: ${item === 11 ? 'JavaScript' : 'WebGL'} is off but: ${e}`);

    if (failures.length > 0) {
      await p.screenshot({
        path: testInfo.outputPath(`plain-${item}-${path.replace(/\W+/g, '_')}-${size}.png`),
      });
    }
    return failures;
  } finally {
    await p.close();
  }
}

test.describe('plainpage: no-JS, no-WebGL, and 404', () => {
  test('11: all pages pass plainChecks and imageChecks with JavaScript disabled', async ({ browser, baseURL, siteData }, testInfo) => {
    const pages: Array<[string, PlainPageKind]> = [
      ['/blog/', 'list'],
      ...siteData.posts.map((p): [string, PlainPageKind] => [`/blog/${p.slug}/`, 'post']),
      ['/about/', 'post'],
      ['/portfolio/', 'list'],
      ...siteData.projects.map((p): [string, PlainPageKind] => [p.url, 'post']),
      ['/experience/', 'post'],
      ['/contact/', 'post'],
    ];

    const allFailures: string[] = [];
    for (const [size, viewport] of SIZES) {
      const ctx = await browser.newContext({
        javaScriptEnabled: false,
        viewport,
        baseURL,
      });
      try {
        for (const [path, kind] of pages) {
          await test.step(`${size} ${path}`, async () => {
            const fails = await checkPlainPage(ctx, 11, path, kind, size, testInfo);
            allFailures.push(...fails);
          });
        }
      } finally {
        await ctx.close();
      }
    }
    expect(allFailures, allFailures.join('\n')).toEqual([]);
  });

  test('12: all pages fall back cleanly and pass plainChecks when WebGL is unavailable', async ({ baseURL, siteData }, testInfo) => {
    const pages: Array<[string, PlainPageKind]> = [
      ['/blog/', 'list'],
      ...siteData.posts.map((p): [string, PlainPageKind] => [`/blog/${p.slug}/`, 'post']),
      ['/about/', 'post'],
      ['/portfolio/', 'list'],
      ...siteData.projects.map((p): [string, PlainPageKind] => [p.url, 'post']),
      ['/experience/', 'post'],
      ['/contact/', 'post'],
    ];

    const noWebglBrowser = await chromium.launch({ args: NO_WEBGL });
    const allFailures: string[] = [];
    try {
      for (const [size, viewport] of SIZES) {
        const ctx = await noWebglBrowser.newContext({
          viewport,
          baseURL,
        });
        try {
          for (const [path, kind] of pages) {
            await test.step(`${size} ${path}`, async () => {
              const fails = await checkPlainPage(ctx, 12, path, kind, size, testInfo);
              allFailures.push(...fails);
            });
          }
        } finally {
          await ctx.close();
        }
      }
    } finally {
      await noWebglBrowser.close();
    }
    expect(allFailures, allFailures.join('\n')).toEqual([]);
  });

  test('14: the landing page without WebGL shows the notice and throws nothing', async ({ baseURL }) => {
    const b = await chromium.launch({ args: NO_WEBGL });
    const failures: string[] = [];
    try {
      for (const [size, viewport] of SIZES) {
        const ctx = await b.newContext({ viewport, baseURL });
        const p = await ctx.newPage();
        const errs: string[] = [];
        p.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
        p.on('console', (m) => {
          if (m.type() === 'error') errs.push(`console: ${m.text().slice(0, 200)}`);
        });
        p.on('response', (r) => {
          if (r.status() >= 400) errs.push(`http ${r.status()} ${r.url()}`);
        });
        try {
          await p.goto('/', { waitUntil: 'load' });
          await p.waitForFunction(() => !!document.querySelector('#loader')?.getAttribute('data-failed'), undefined, { timeout: 60_000 });
          await p.waitForTimeout(1200);
          const o = await p.evaluate(() => ({
            cls: document.documentElement.className,
            loader: getComputedStyle(document.querySelector('#loader')!).display,
            nav: (document.querySelector('#pagenav') as HTMLElement).getClientRects().length,
          }));
          if (o.cls !== '') failures.push(`/ ${size}: html class "${o.cls}"`);
          if (o.loader !== 'none') failures.push(`/ ${size}: the loader shows (display ${o.loader})`);
          if (!o.nav) failures.push(`/ ${size}: #pagenav is not shown`);
          const note = await webglNotice(p);
          if (!/WebGL/.test(note.text)) failures.push(`/ ${size}: no visible notice #nogl that the station needs WebGL`);
          if (note.links !== 5) failures.push(`/ ${size}: the notice has ${note.links} links, not 5`);
          if (note.covered) failures.push(`/ ${size}: the notice #nogl is covered by ${note.covered}`);
          for (const e of new Set(errs)) failures.push(`/ ${size}: WebGL is off but: ${e}`);
        } finally {
          await ctx.close();
        }
      }
    } finally {
      await b.close();
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });

  test('13: unknown post and project URLs return 404 without soft-404 article/list markup', async ({ request }) => {
    for (const path of ['/blog/no-such-post/', '/blog/no-such-post', '/portfolio/no-such-project/', '/portfolio/no-such-project']) {
      const r = await request.get(path, { maxRedirects: 10 });
      const body = await r.text();
      expect(r.status(), `${path} status`).toBe(404);
      expect(/<article|class="post-list"/.test(body), `${path} must not contain article or post-list`).toBe(false);
    }
  });
});
