// End-to-end spec for the plain page checks, on built test pages
import { expect, test } from '../fixtures/site.ts';
import { plainChecks, type PlainCheckFindings } from '../helpers/plaincheck.ts';

const buildHtml = (body: string, css = '') =>
  `<!doctype html><html><head><style>html{background:#04060a;color:#dcecf5}body{margin:0;background:#04060a}a{color:#7fe3ff}pre{overflow-x:auto}${css}</style></head><body><main id="page"><article class="post">${body}</article></main></body></html>`;

const lorem = '<p>' + 'words '.repeat(60) + '</p>';
const long = (lorem + '\n').repeat(30);
const good = `<h1>Title</h1><h2>One</h2>${long}<h3>Sub</h3>${lorem}<img alt="a picture" width=10 height=10 src="data:image/gif;base64,R0lGODlhAQABAAAAACw="><p>see <a href="/x">link</a></p><pre>${'x'.repeat(400)}</pre>`;

const CASES: Array<[string, string, string, keyof PlainCheckFindings | null]> = [
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

test.use({ viewport: { width: 390, height: 700 } });

test.describe('plaincheck selftest: failure detectors catch broken rules', () => {
  for (const [name, body, css, expected] of CASES) {
    test(`case "${name}"`, async ({ page }) => {
      await page.setContent(buildHtml(body, css));
      const { found } = await plainChecks(page, 'post');
      const hit = Object.entries(found)
        .filter(([, v]) => v.length > 0)
        .map(([k]) => k);

      if (expected) {
        expect(hit, `expected "${expected}" to complain, got [${hit.join(', ')}]`).toContain(expected);
      } else {
        expect(hit, `expected no complaints on good page, got [${hit.join(', ')}]`).toEqual([]);
      }
    });
  }
});
