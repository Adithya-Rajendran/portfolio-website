// The static endpoints, fetched through the test server:  tools/dtest.sh endpoints.mjs
// Generate them first (python3 tools/site.py). Each endpoint must answer 200 with the right content type; then every <loc>
// in the sitemap, every <link> and <guid> in the feed and every site URL inside the feed's articles (links, images) must
// answer 200 too. The URLs are written on the canonical origin, so the origin is swapped for the test server's.
// The test server does not apply public/_redirects or public/_headers (Cloudflare does): neither is exercised here.
import { request } from 'playwright';
const SITE = process.env.SITE || 'https://adithya-rajendran.com';
const api = await request.newContext({ baseURL: process.env.ORIGIN });
let failed = 0, checked = 0;
const fail = (...m) => { failed++; console.log('FAIL', ...m); };
const local = (u) => { if (!u.startsWith(SITE + '/')) throw new Error('not on ' + SITE + ': ' + u); return u.slice(SITE.length); };
const unxml = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&');
async function get(path, type, name = path) {
  const r = await api.get(path, { maxRedirects: 0 });
  checked++;
  if (r.status() !== 200) { fail(name, 'status', r.status()); return null; }
  const ct = r.headers()['content-type'] || '';
  if (type && !type.test(ct)) fail(name, 'content-type', ct);
  return r;
}
const text = async (path, type) => (await get(path, type))?.text() ?? '';

const feed = await text('/feed.xml', /xml/);
const sitemap = await text('/sitemap.xml', /xml/);
const llms = await text('/llms.txt', /^text\/plain/);
const robots = await text('/robots.txt', /^text\/plain/);
console.log(`feed ${feed.length} B, sitemap ${sitemap.length} B, llms.txt ${llms.length} B, robots.txt ${robots.length} B`);

if (!feed.startsWith('<?xml') || !feed.includes('<rss version="2.0"')) fail('feed.xml is not RSS 2.0');
if (!sitemap.includes('<urlset')) fail('sitemap.xml has no urlset');
if (!robots.includes(`Sitemap: ${SITE}/sitemap.xml`)) fail('robots.txt does not name the sitemap');

// The résumé: the link llms.txt gives, served as a PDF.
const cv = llms.match(/\]\((\S+\/resume\/[^)\s]+)\)/)?.[1];
if (!cv) fail('llms.txt has no résumé link');
else { const r = await get(local(cv), /^application\/pdf/, 'résumé'); if (r && !(await r.body()).subarray(0, 5).toString().startsWith('%PDF-')) fail('résumé is not a PDF'); }

const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => unxml(m[1]));
const links = [...feed.matchAll(/<(?:link|guid[^>]*)>([^<]+)<\/(?:link|guid)>/g)].map(m => unxml(m[1]));
const inFeed = [...unxml(feed).matchAll(/(?:href|src)="(https:\/\/adithya-rajendran\.com[^"]*)"/g)].map(m => m[1].replace(/&amp;/g, '&'));
const inLlms = [...llms.matchAll(/\]\((\S+?)\)/g)].map(m => m[1]);
console.log(`${locs.length} sitemap locs, ${links.length} feed links, ${inFeed.length} site URLs in the articles, ${inLlms.length} in llms.txt`);
if (!locs.length || !links.length || !inFeed.length) fail('nothing to follow');
for (const [what, list] of [['sitemap', locs], ['feed', links], ['feed article', inFeed], ['llms.txt', inLlms]])
  for (const u of new Set(list)) {
    const type = what === 'feed article' && /\.webp$/.test(u) ? /^image\/webp/ : /\/$|\?/.test(u) && !/\.\w+$/.test(u) ? /^text\/html/ : null;
    await get(local(u), type, `${what}: ${u}`);
  }
// The pages that the sitemap lists are the pages that the feed carries, plus / and /blog/.
const posts = links.filter(u => /\/blog\/[^/]+\/$/.test(u));
for (const u of new Set(posts)) if (!locs.includes(u)) fail('in the feed but not the sitemap:', u);
for (const u of locs) if (u !== SITE + '/' && u !== SITE + '/blog/' && !posts.includes(u)) fail('in the sitemap but not the feed:', u);
console.log(`${checked} requests, ${failed} failures`);
await api.dispose();
process.exit(failed ? 1 : 0);
