import type { APIRequestContext, APIResponse } from '@playwright/test';
import { expect, test } from '../fixtures/site.ts';

const SITE = process.env.SITE || 'https://adithya-rajendran.com';

const unxml = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&');

const localPath = (u: string) => {
  if (!u.startsWith(`${SITE}/`)) throw new Error(`not on ${SITE}: ${u}`);
  return u.slice(SITE.length);
};

async function getEndpoint(request: APIRequestContext, path: string, type: RegExp | null, name = path): Promise<APIResponse> {
  const res = await request.get(path, { maxRedirects: 0 });
  expect(res.status(), `${name} status`).toBe(200);
  if (type) {
    const ct = res.headers()['content-type'] || '';
    expect(ct, `${name} content-type`).toMatch(type);
  }
  return res;
}

type ShapeSpec = string | [ShapeSpec] | { [key: string]: ShapeSpec };

function assertShape(v: unknown, sh: ShapeSpec, where: string): void {
  if (Array.isArray(sh)) {
    expect(Array.isArray(v), `${where} is a list`).toBe(true);
    (v as unknown[]).forEach((x, i) => assertShape(x, sh[0], `${where}[${i}]`));
    return;
  }
  if (typeof sh === 'object') {
    expect(v !== null && typeof v === 'object' && !Array.isArray(v), `${where} is a record`).toBe(true);
    const rec = v as Record<string, unknown>;
    expect(Object.keys(rec).join(), `${where} keys order`).toBe(Object.keys(sh).join());
    for (const k of Object.keys(sh)) {
      assertShape(rec[k], sh[k], `${where}.${k}`);
    }
    return;
  }
  const type = sh.replace('?', '');
  const maybe = sh.endsWith('?');
  const ok = (maybe && v === null) || (type === 'null' ? v === null : typeof v === type);
  expect(ok, `${where} is ${JSON.stringify(v)}, expected ${sh}`).toBe(true);
}

const PROJECT_SHAPE: ShapeSpec = {
  slug: 'string',
  url: 'string',
  name: 'string',
  title: 'string',
  summary: 'string',
  status: 'string',
  status_label: 'string',
  period: 'string?',
  year: 'string?',
  types: ['string'],
  role: 'string?',
  technologies: ['string'],
  featured: 'number?',
  quiet: 'boolean',
};

const PROFILE_SHAPE: ShapeSpec = {
  v: 'string',
  name: 'string',
  headline: 'string',
  tagline: 'string',
  location: 'string',
  introduction: 'string',
  focus: ['string'],
  availability: { status: 'string', label: 'string', seeking: ['string'] },
  curiosities: [{ kind: 'string?', title: 'string', note: 'string?', url: 'string?' }],
  timeline: [
    {
      id: 'string',
      url: 'string',
      kind: 'string',
      title: 'string',
      organization: 'string',
      org_short: 'string',
      period: 'string',
      year: 'string',
      current: 'boolean',
      location: 'string?',
      employment: 'string?',
      summary: 'string?',
    },
  ],
  links: [{ label: 'string', url: 'string' }],
  contact: {
    intro: 'string',
    invitation: 'string',
    email: 'null',
    routes: [{ id: 'string', title: 'string', prompt: 'string' }],
  },
  resume: 'string?',
};

test('endpoints: feed, sitemap, llms, robots, resume, and JSON contracts match', async ({ request }) => {
  const feed = await (await getEndpoint(request, '/feed.xml', /xml/)).text();
  const sitemap = await (await getEndpoint(request, '/sitemap.xml', /xml/)).text();
  const llms = await (await getEndpoint(request, '/llms.txt', /^text\/plain/)).text();
  const robots = await (await getEndpoint(request, '/robots.txt', /^text\/plain/)).text();

  expect(feed.startsWith('<?xml') && feed.includes('<rss version="2.0"'), 'feed.xml is RSS 2.0').toBe(true);
  expect(sitemap.includes('<urlset'), 'sitemap.xml has <urlset>').toBe(true);
  expect(robots.includes(`Sitemap: ${SITE}/sitemap.xml`), 'robots.txt names sitemap').toBe(true);

  // The résumé: the link llms.txt gives, served as a PDF.
  const cv = llms.match(/\]\((\S+\/resume\/[^)\s]+)\)/)?.[1];
  expect(cv, 'llms.txt has a résumé link').toBeTruthy();
  const cvRes = await getEndpoint(request, localPath(cv!), /^application\/pdf/, 'résumé');
  const cvBuf = await cvRes.body();
  expect(cvBuf.subarray(0, 5).toString().startsWith('%PDF-'), 'résumé starts with %PDF-').toBe(true);

  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => unxml(m[1]));
  const links = [...feed.matchAll(/<(?:link|guid[^>]*)>([^<]+)<\/(?:link|guid)>/g)].map((m) => unxml(m[1]));
  const escapedSite = SITE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const inFeed = [...unxml(feed).matchAll(new RegExp(`(?:href|src)="(${escapedSite}[^"]*)"`, 'g'))].map((m) =>
    m[1].replace(/&amp;/g, '&'),
  );
  const inLlms = [...llms.matchAll(/\]\((\S+?)\)/g)].map((m) => m[1]);

  expect(locs.length, 'sitemap locs non-empty').toBeGreaterThan(0);
  expect(links.length, 'feed links non-empty').toBeGreaterThan(0);
  expect(inFeed.length, 'feed article URLs non-empty').toBeGreaterThan(0);

  for (const [what, list] of [
    ['sitemap', locs],
    ['feed', links],
    ['feed article', inFeed],
    ['llms.txt', inLlms],
  ] as const) {
    for (const u of new Set(list)) {
      const type =
        what === 'feed article' && /\.webp$/.test(u)
          ? /^image\/webp/
          : /\/$|\?/.test(u) && !/\.\w+$/.test(u)
            ? /^text\/html/
            : null;
      await getEndpoint(request, localPath(u), type, `${what}: ${u}`);
    }
  }

  const portfolio = await (await getEndpoint(request, '/portfolio/index.json', /^application\/json/)).json();
  const profile = await (await getEndpoint(request, '/profile.json', /^application\/json/)).json();

  assertShape(portfolio, { v: 'string', projects: [PROJECT_SHAPE] }, 'portfolio/index.json');
  assertShape(profile, PROFILE_SHAPE, 'profile.json');

  for (const doc of [portfolio, profile]) {
    expect(doc.v, 'version hash is 8 hex chars').toMatch(/^[0-9a-f]{8}$/);
  }

  const urls: string[] = [
    ...portfolio.projects.map((p: { url: string }) => p.url),
    ...profile.curiosities.map((c: { url: string | null }) => c.url).filter(Boolean),
    ...profile.timeline.map((e: { url: string }) => e.url),
    ...profile.links.map((l: { url: string }) => l.url),
    ...(profile.resume ? [profile.resume] : []),
  ];
  const seen = new Map<string, string>();
  for (const u of urls) {
    if (/^https?:\/\//.test(u)) continue;
    expect(u.startsWith('/') && !u.startsWith('//'), `json url is a site path: ${u}`).toBe(true);
    const [path, frag] = u.split('#');
    if (!seen.has(path)) {
      const r = await getEndpoint(request, path, null, `json url: ${u}`);
      seen.set(path, path.endsWith('/') ? await r.text() : '');
    }
    if (frag) {
      expect(seen.get(path)!.includes(` id="${frag}"`), `json url ${u} targets missing id="${frag}"`).toBe(true);
    }
  }

  // Sitemap completeness: feed posts + rooms + projects.
  const posts = links.filter((u) => /\/blog\/[^/]+\/$/.test(u));
  const rooms = ['/', '/blog/', '/about/', '/portfolio/', '/experience/', '/contact/'].map((p) => SITE + p);
  const projects = portfolio.projects.map((p: { url: string }) => SITE + p.url);
  for (const u of new Set([...posts, ...rooms, ...projects])) {
    expect(locs.includes(u), `sitemap includes ${u}`).toBe(true);
  }
  for (const u of locs) {
    expect(rooms.includes(u) || posts.includes(u) || projects.includes(u), `sitemap entry ${u} is a known page`).toBe(true);
  }
});
