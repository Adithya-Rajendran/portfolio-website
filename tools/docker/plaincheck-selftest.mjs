// Self test that each plain page check can fail
import { chromium } from 'playwright';
import { plainChecks } from './plaincheck.mjs';
const page = (body, css = '') => `<!doctype html><html><head><style>html{background:#04060a;color:#dcecf5}body{margin:0;background:#04060a}a{color:#7fe3ff}pre{overflow-x:auto}${css}</style></head><body><main id="page"><article class="post">${body}</article></main></body></html>`;
const lorem = '<p>' + 'words '.repeat(60) + '</p>', long = (lorem + '\n').repeat(30);
const good = `<h1>Title</h1><h2>One</h2>${long}<h3>Sub</h3>${lorem}<img alt="a picture" width=10 height=10 src="data:image/gif;base64,R0lGODlhAQABAAAAACw="><p>see <a href="/x">link</a></p><pre>${'x'.repeat(400)}</pre>`;
const CASES = [
  ['good', good, '', null],
  ['scroll', good, 'html,body{height:100%;overflow:hidden}', 'scroll'],
  ['uncovered', good, '#page::after{content:"";position:fixed;inset:0;background:#000}', 'uncovered'],
  ['h1', good.replace('<h1>Title</h1>', '<h1>A</h1><h1>B</h1>'), '', 'h1'],
  ['levels', good.replace('<h2>One</h2>', '<h4>One</h4>'), '', 'levels'],
  ['alt', good.replace('alt="a picture"', 'alt=" "'), '', 'alt'],
  ['links', good.replace('>link<', '><'), '', 'links'],
  ['contrast', good, 'p{color:#555}', 'contrast'],
  ['overflow', good, 'pre{overflow-x:visible !important;white-space:pre}', 'overflow'],
];
const b = await chromium.launch(), p = await (await b.newContext({ viewport: { width: 390, height: 700 } })).newPage();
let failed = 0;
for (const [name, body, css, expect] of CASES) {
  await p.setContent(page(body, css)); const { found } = await plainChecks(p, 'post'), hit = Object.entries(found).filter(([, v]) => v.length).map(([k]) => k);
  const ok = expect ? hit.includes(expect) : hit.length === 0; if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: checks that complained: ${hit.join(', ') || 'none'}${ok ? '' : expect ? ` (should include ${expect})` : ' (should be none)'}`);
}
await b.close(); console.log(failed ? 'plaincheck-selftest FAILED' : 'plaincheck-selftest ok'); process.exitCode = failed ? 1 : 0;
