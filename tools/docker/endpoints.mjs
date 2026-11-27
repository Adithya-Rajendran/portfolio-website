// Check of the static endpoints through the test server
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
const json = async (path) => { const r = await get(path, /^application\/json/); try { return r ? await r.json() : null; } catch { fail(path, 'is not JSON'); return null; } };
function shape(v, sh, where) {
  if (Array.isArray(sh)) { if (!Array.isArray(v)) return fail(where, 'is not a list'); v.forEach((x, i) => shape(x, sh[0], `${where}[${i}]`)); return; }
  if (typeof sh === 'object') {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return fail(where, 'is not a record');
    if (Object.keys(v).join() !== Object.keys(sh).join()) fail(where, 'keys', Object.keys(v).join(), 'instead of', Object.keys(sh).join());
    for (const k of Object.keys(sh)) shape(v[k], sh[k], `${where}.${k}`);
    return;
  }
  const [type, maybe] = [sh.replace('?', ''), sh.endsWith('?')];
  if (!((maybe && v === null) || (type === 'null' ? v === null : typeof v === type))) fail(where, 'is', JSON.stringify(v), 'not', sh);
}
const PROJECT = { slug: 'string', url: 'string', name: 'string', title: 'string', summary: 'string', status: 'string', status_label: 'string', period: 'string?',
  year: 'string?', types: ['string'], role: 'string?', technologies: ['string'], featured: 'number?', quiet: 'boolean' };
const PROFILE = { v: 'string', name: 'string', headline: 'string', tagline: 'string', location: 'string', introduction: 'string', focus: ['string'],
  availability: { status: 'string', label: 'string', seeking: ['string'] }, curiosities: [{ kind: 'string?', title: 'string', note: 'string?', url: 'string?' }],
  timeline: [{ id: 'string', url: 'string', kind: 'string', title: 'string', organization: 'string', org_short: 'string', period: 'string', year: 'string',
    current: 'boolean', location: 'string?', employment: 'string?', summary: 'string?' }],
  links: [{ label: 'string', url: 'string' }], contact: { intro: 'string', invitation: 'string', links: [{ label: 'string', url: 'string' }], routes: [{ id: 'string', title: 'string', prompt: 'string' }] },
  resume: 'string?' };
const portfolio = await json('/portfolio/index.json'), profile = await json('/profile.json');
shape(portfolio, { v: 'string', projects: [PROJECT] }, 'portfolio/index.json');
shape(profile, PROFILE, 'profile.json');
for (const doc of [portfolio, profile]) if (doc && !/^[0-9a-f]{8}$/.test(doc.v)) fail('v is not 8 hex:', doc.v);
const urls = [...(portfolio?.projects ?? []).map(p => p.url), ...(profile?.curiosities ?? []).map(c => c.url).filter(Boolean),
  ...(profile?.timeline ?? []).map(e => e.url), ...(profile?.links ?? []).map(l => l.url), ...(profile?.contact?.links ?? []).map(l => l.url), ...(profile?.resume ? [profile.resume] : [])];
const seen = new Map();
for (const u of urls) {
  if (/^https?:\/\//.test(u)) continue;
  if (!u.startsWith('/') || u.startsWith('//')) { fail('json url is neither a site path nor http(s):', u); continue; }
  const [path, frag] = u.split('#');
  if (!seen.has(path)) { const r = await get(path, null, `json url: ${u}`); seen.set(path, r && path.endsWith('/') ? await r.text() : ''); }
  if (frag && !seen.get(path).includes(` id="${frag}"`)) fail('json url to a missing id:', u);
}
console.log(`${portfolio?.projects.length} projects, ${profile?.timeline.length} timeline entries, ${seen.size} site paths in the JSON`);

const posts = links.filter(u => /\/blog\/[^/]+\/$/.test(u));
const rooms = ['/', '/blog/', '/about/', '/portfolio/', '/experience/', '/contact/'].map(p => SITE + p);
const projects = (portfolio?.projects ?? []).map(p => SITE + p.url);
for (const u of new Set([...posts, ...rooms, ...projects])) if (!locs.includes(u)) fail('a page that is not in the sitemap:', u);
for (const u of locs) if (!rooms.includes(u) && !posts.includes(u) && !projects.includes(u)) fail('in the sitemap but not a page:', u);
console.log(`${checked} requests, ${failed} failures`);
await api.dispose();
process.exit(failed ? 1 : 0);
