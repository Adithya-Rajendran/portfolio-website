// End-to-end spec for the generated pages
import type { BrowserContext, TestInfo } from '@playwright/test';
import { expect, test } from '../fixtures/site.ts';

type PageKind = 'list' | 'post' | 'project' | 'about' | 'experience' | 'contact';

const REQUIRED: Record<PageKind, string[]> = {
  list: ['.post-lede', 'ol > li > a', 'ol > li > p.post-meta'],
  post: ['header .post-meta time', 'header .post-lede', 'div.post-body', 'div.post-body h2[id]', 'div.post-body p'],
  project: ['header .post-meta .post-status', 'header .post-lede'],
  about: ['header .post-meta', 'header .post-lede', 'div.post-body h2[id]', 'div.post-body p', 'ul.post-links a'],
  experience: ['header .post-lede', 'section.entry[id] > h2', 'section.entry[id] > p.post-meta', 'div.post-body h2[id]', 'ul.post-tags li'],
  contact: ['header .post-lede', 'ul.post-links a', 'div.post-body h2[id]'],
};

const OPTIONAL: Record<PageKind, string[]> = {
  list: ['h2[id]', 'li.quiet'],
  post: ['div.post-body pre[data-lang] > code', 'div.post-body figure > img', 'ul.post-tags', 'section.post-takeaways', 'footer .post-changelog', 'footer .post-next'],
  project: [
    'header .post-role',
    'header .post-status-note',
    'ul.post-tags',
    'figure.post-cover > img',
    'div.post-body',
    'div.post-body h2[id]',
    'dl.post-facts',
    'ul.post-links',
    'footer .post-next',
  ],
  about: ['ul.post-curiosities > li', 'p.post-availability', 'p.post-cta a', 'p.post-featured a'],
  experience: ['section.entry img.entry-logo', 'ul.post-credentials > li', 'ul.post-credentials img.post-badge', 'ul.post-talks > li'],
  contact: ['p.post-availability'],
};

function kindOf(path: string): PageKind {
  if (/^\/(blog|portfolio)\/$/.test(path)) return 'list';
  if (/^\/blog\/[^/]+\/$/.test(path)) return 'post';
  if (/^\/portfolio\/[^/]+\/$/.test(path)) return 'project';
  const roomKind = ({ '/about/': 'about', '/experience/': 'experience', '/contact/': 'contact' } as const)[path];
  if (!roomKind) throw new Error(`not a generated page: ${path}`);
  return roomKind;
}

async function verifyGeneratedPage(ctx: BrowserContext, path: string, testInfo: TestInfo): Promise<void> {
  const kind = kindOf(path);
  const p = await ctx.newPage();
  const requests: string[] = [];
  const errors: string[] = [];

  p.on('request', (r) => requests.push(r.url()));
  p.on('requestfailed', (r) => errors.push(`request failed: ${r.url()} ${r.failure()?.errorText ?? ''}`));
  p.on('response', (r) => {
    if (r.status() >= 400) errors.push(`http ${r.status()}: ${r.url()}`);
  });

  try {
    const res = await p.goto(path, { waitUntil: 'load' });
    expect(res?.status(), `${path} status`).toBe(200);
    expect(errors, `${path} failed requests/http`).toEqual([]);
    expect(
      requests.some((u) => u.endsWith('/main.js')),
      `${path}: main.js must not be requested with JS disabled`,
    ).toBe(false);

    const root =
      kind === 'list'
        ? 'main#page > section.post-list'
        : kind === 'post'
          ? 'main#page > article.post'
          : kind === 'project'
            ? 'main#page > article.post.project[data-slug]'
            : `main#page > article.post.page[data-slug="${kind}"]`;

    const content = p.locator(root);
    expect(await content.count(), `${path}: ${root} count`).toBe(1);
    expect(await p.locator('main#page > *').count(), `${path}: main#page holds only its article`).toBe(1);

    const h1 = (await p.locator(`${root} h1`).first().textContent())?.trim();
    expect(h1, `${path}: non-empty h1`).toBeTruthy();
    expect(await p.locator('main#page h1').count(), `${path}: exactly one h1`).toBe(1);

    for (const part of REQUIRED[kind]) {
      expect(await p.locator(`${root} ${part}`).count(), `${path}: missing ${part}`).toBeGreaterThan(0);
    }
    for (const part of OPTIONAL[kind]) {
      await p.locator(`${root} ${part}`).count();
    }

    expect(await p.locator('script[type="application/ld+json"]').count(), `${path}: JSON-LD count`).toBe(1);
    const ldText = await p.locator('script[type="application/ld+json"]').textContent();
    expect(() => JSON.parse(ldText || ''), `${path}: valid JSON-LD`).not.toThrow();

    const canonical = await p.locator('link[rel="canonical"]').getAttribute('href');
    expect(canonical?.endsWith(path), `${path}: canonical link ${canonical}`).toBe(true);

    const ids = await p.evaluate(() => [...document.querySelectorAll('[id]')].map((e) => e.id));
    expect(new Set(ids).size, `${path}: duplicate ids: ${ids.filter((x, i) => ids.indexOf(x) !== i).join(', ')}`).toBe(ids.length);
    expect(await p.locator(`${root} form, ${root} input, ${root} script`).count(), `${path}: no form/input/script in content`).toBe(0);

    const imgs = p.locator(`${root} img`);
    const imgCount = await imgs.count();
    for (let i = 0; i < imgCount; i++) {
      const img = imgs.nth(i);
      await img.scrollIntoViewIfNeeded();
      const handle = await img.elementHandle();
      if (handle) {
        await p.waitForFunction((el) => (el as HTMLImageElement).complete, handle, { timeout: 15_000 }).catch(() => {});
      }
      const [src, nw, nh] = await img.evaluate((el) => {
        const im = el as HTMLImageElement;
        return [im.getAttribute('src'), im.naturalWidth, im.naturalHeight] as const;
      });
      expect(nw, `${path}: image not loaded: ${src}`).toBeGreaterThan(0);
      expect(`${nw}x${nh}`, `${path}: width/height attrs match file for ${src}`).toBe(
        `${await img.getAttribute('width')}x${await img.getAttribute('height')}`,
      );
    }

    const hrefs = await p
      .locator(`${root} a[href]`)
      .evaluateAll((as) => as.map((a) => [a.getAttribute('href') || '', a.getAttribute('target'), a.getAttribute('rel')] as const));
    const site = new Set<string>();
    for (const [h, target, rel] of hrefs) {
      if (/^https?:\/\//.test(h)) {
        expect([target, rel], `${path}: external link target/rel for ${h}`).toEqual(['_blank', 'noopener']);
      } else if (h.startsWith('/') && !h.startsWith('//')) {
        site.add(h);
      } else {
        throw new Error(`${path}: link not allowed: ${h}`);
      }
    }

    const pages = new Map<string, string>();
    for (const h of site) {
      const [where, frag] = h.split('#');
      if (!pages.has(where)) {
        const r = await ctx.request.get(where, { maxRedirects: 0 });
        expect(r.status(), `${path}: linked ${h} status`).toBe(200);
        pages.set(where, where.endsWith('/') ? await r.text() : '');
      }
      if (frag) {
        expect(pages.get(where)!.includes(` id="${frag}"`), `${path}: link ${h} targets missing id`).toBe(true);
      }
    }

    await p.evaluate(() => {
      document.documentElement.scrollTop = document.body.scrollTop = 0;
    });
    const slug = path.replace(/\W+/g, '_').replace(/^_+|_+$/g, '') || 'root';
    await p.screenshot({ path: testInfo.outputPath(`page-${slug}.png`) });

    for (const over of ['#loader', '#scene']) {
      await p.locator(over).evaluate((el) => {
        (el as HTMLElement).style.display = 'none';
      });
    }
    const box = await content.boundingBox();
    expect(box, `${path}: content boundingBox`).not.toBeNull();
    await p.setViewportSize({ width: 1000, height: Math.ceil(Math.min(box!.y + box!.height, 16_000)) });
    await content.screenshot({ path: testInfo.outputPath(`page-article-${slug}.png`) });
  } finally {
    await p.close();
  }
}

test.describe('page: generated pages without JavaScript', () => {
  test('all blog posts, room pages, and project pages pass DOM, media, and link checks', async ({ browser, siteData }, testInfo) => {
    const paths = [
      ...siteData.posts.map((p) => `/blog/${p.slug}/`),
      '/blog/',
      '/about/',
      '/portfolio/',
      '/experience/',
      '/contact/',
      ...siteData.projects.map((p) => `/portfolio/${p.slug}/`),
    ];

    const ctx = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 1000, height: 900 },
    });
    try {
      for (const path of paths) {
        await test.step(path, async () => {
          await verifyGeneratedPage(ctx, path, testInfo);
        });
      }
    } finally {
      await ctx.close();
    }
  });
});
