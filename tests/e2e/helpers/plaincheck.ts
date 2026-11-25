import type { Page } from '@playwright/test';

export type PlainPageKind = 'post' | 'list';

export interface PlainCheckFindings {
  scroll: string[];
  uncovered: string[];
  h1: string[];
  levels: string[];
  alt: string[];
  links: string[];
  contrast: string[];
  overflow: string[];
}

export interface PlainCheckResult {
  found: PlainCheckFindings;
  notes: string[];
}

export async function plainChecks(p: Page, kind: PlainPageKind): Promise<PlainCheckResult> {
  await p.evaluate(() => scrollTo(0, 0));
  const out = await p.evaluate(async (k) => {
    const R = {
      scroll: [] as string[],
      uncovered: [] as string[],
      h1: [] as string[],
      levels: [] as string[],
      alt: [] as string[],
      links: [] as string[],
      contrast: [] as string[],
      overflow: [] as string[],
      notes: [] as string[],
    };
    const root = document.querySelector('main#page');
    const W = innerWidth;
    const Hh = innerHeight;
    const name = (e: Element) =>
      e.parentElement?.tagName === 'NOSCRIPT'
        ? 'the noscript notice'
        : `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}${
            typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/)[0] : ''
          }`;
    const txt = (e: Element) => (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    if (!root) {
      R.scroll.push('no main#page in the document');
      return R;
    }

    // ---- it scrolls, and the end of it can be reached
    const se = document.scrollingElement!;
    const max = se.scrollHeight - Hh;
    if (max > 0) {
      scrollTo(0, 400);
      if (scrollY < 1) R.scroll.push(`scrollTo(0, 400) left scrollY at ${scrollY} (document ${se.scrollHeight} px, window ${Hh})`);
      scrollTo(0, 0);
    } else {
      R.notes.push(`the page is not taller than the window (${se.scrollHeight} <= ${Hh})`);
    }
    const style = getComputedStyle(document.documentElement);
    if (style.overflowY === 'hidden' && max > 0) R.scroll.push('html has overflow-y: hidden');

    // ---- not covered: h1 and a paragraph first (the brief's check), then every block at every scroll position
    const top = (e: Element) => {
      const r = e.getClientRects()[0];
      return r && document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(r.height / 2, 30));
    };
    const h1 = root.querySelector('h1');
    const para = root.querySelector('p:not(.post-meta):not(.post-lede), .post-lede');
    for (const [what, e] of [
      ['h1', h1],
      ['a paragraph', para],
    ] as const) {
      if (!e) {
        R.uncovered.push(`no ${what}`);
        continue;
      }
      e.scrollIntoView({ block: 'center' });
      const t = top(e);
      if (!t || !(e === t || e.contains(t))) R.uncovered.push(`${what} is covered by ${t ? name(t) : 'nothing'}`);
    }
    const cs = getComputedStyle(root);
    if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity < 1) {
      R.uncovered.push(`main#page: display ${cs.display}, visibility ${cs.visibility}, opacity ${cs.opacity}`);
    }
    const blocks = [...root.querySelectorAll('h1, h2, h3, p, li, pre, figcaption, img, time')];
    const seen = new Map<Element, { n: number; covered: number; by: Set<string> }>();
    for (let y = 0; y <= Math.max(0, max) + 1; y += 40) {
      scrollTo(0, Math.min(y, Math.max(0, max)));
      for (const e of blocks) {
        const r = e.getBoundingClientRect();
        if (!r.width || r.top < 0 || r.bottom > Hh) continue;
        const rec = seen.get(e) ?? { n: 0, covered: 0, by: new Set<string>() };
        seen.set(e, rec);
        rec.n++;
        const t = top(e);
        if (!t || !(e === t || e.contains(t))) {
          rec.covered++;
          rec.by.add(t ? name(t) : 'nothing');
        }
      }
    }
    const always = [...seen].filter(([, r]) => r.n && r.covered === r.n);
    const some = [...seen].filter(([, r]) => r.covered && r.covered < r.n);
    for (const [e, r] of always.slice(0, 6)) {
      R.uncovered.push(`${name(e)} "${txt(e)}" is covered by ${[...r.by].join(', ')} wherever it is on screen`);
    }
    if (some.length) {
      R.notes.push(
        `${some.length} blocks are covered by ${[...new Set(some.flatMap(([, r]) => [...r.by]))].join(', ')} at some scroll positions (they come clear when scrolled)`,
      );
    }
    scrollTo(0, Math.max(0, max));
    const last = [...root.querySelectorAll('li, p, section, article, footer')].pop();
    const lr = last?.getBoundingClientRect();
    if (last && lr && lr.bottom > Hh + 1) {
      R.scroll.push(`at the end of the page the last block ends at ${Math.round(lr.bottom)}, below the window (${Hh})`);
    }
    scrollTo(0, 0);

    // ---- headings
    const hs = [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')];
    if (document.querySelectorAll('h1').length !== 1) R.h1.push(`${document.querySelectorAll('h1').length} h1 in the document`);
    let prev = 0;
    for (const h of hs) {
      const l = +h.tagName[1];
      if (l - prev > 1) R.levels.push(`${h.tagName.toLowerCase()} "${txt(h)}" follows ${prev ? 'h' + prev : 'nothing'}`);
      prev = l;
    }
    if (hs.length && hs[0].tagName !== 'H1') R.levels.push(`the first heading is ${hs[0].tagName.toLowerCase()}, not h1`);
    if (k === 'post' && !root.querySelector('article.post h1')) R.h1.push('the h1 is not in the article');
    if (k === 'list' && !root.querySelector('.post-list h1')) R.h1.push('the h1 is not in the list');

    // ---- images and links
    for (const i of document.images) {
      if (!(i.getAttribute('alt') || '').trim()) R.alt.push(`img ${i.getAttribute('src')} has alt ${JSON.stringify(i.getAttribute('alt'))}`);
    }
    for (const a of document.querySelectorAll('a')) {
      const t =
        (a.textContent || '').trim() ||
        (a.getAttribute('aria-label') || '').trim() ||
        [...a.querySelectorAll('img')].map((i) => i.alt).join('').trim() ||
        (a.getAttribute('title') || '').trim();
      if (!t) R.links.push(`link to ${a.getAttribute('href')} has no text`);
      if (!a.getAttribute('href')) R.links.push(`an <a> without href: "${txt(a)}"`);
    }

    // ---- contrast
    const cv = Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', { willReadFrequently: true })!;
    const rgba = (s: string): [number, number, number, number] => {
      cv.clearRect(0, 0, 1, 1);
      cv.fillStyle = '#000';
      cv.fillStyle = s;
      cv.fillRect(0, 0, 1, 1);
      const d = cv.getImageData(0, 0, 1, 1).data;
      return [d[0], d[1], d[2], d[3] / 255];
    };
    const over = (f: number[], b: number[]): [number, number, number, number] => [
      f[0] * f[3] + b[0] * (1 - f[3]),
      f[1] * f[3] + b[1] * (1 - f[3]),
      f[2] * f[3] + b[2] * (1 - f[3]),
      1,
    ];
    const lum = (c: number[]) => {
      const l = c.slice(0, 3).map((v) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
    };
    const ratio = (a: number[], b: number[]) => {
      const x = lum(a);
      const y = lum(b);
      return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
    };
    const backs = (e: Element, pseudo?: string) => {
      const chain: Element[] = [];
      for (let n: Element | null = e; n; n = n.parentElement) chain.push(n);
      let bases: Array<[number, number, number, number]> = [[4, 6, 10, 1]];
      for (const n of chain.reverse()) {
        const s = getComputedStyle(n, n === e ? pseudo : undefined);
        const c = rgba(s.backgroundColor);
        if (c[3] > 0) bases = bases.map((b) => over(c, b));
        const cols = [...(s.backgroundImage.match(/rgba?\([^)]*\)/g) ?? [])].map(rgba).filter((col) => col[3] > 0);
        if (cols.length) bases = bases.flatMap((b) => [b, ...cols.map((col) => over(col, b))]);
        if (n.tagName === 'HTML' && !(rgba(s.backgroundColor)[3] > 0)) bases = [[255, 255, 255, 1]];
      }
      return bases;
    };
    let low: [number, string] = [99, ''];
    const bad = new Map<string, string>();
    const check = (e: Element, pseudo: string | undefined, text: string) => {
      const s = getComputedStyle(e, pseudo);
      const size = parseFloat(s.fontSize);
      const big = size >= 24 || (size >= 18.66 && +s.fontWeight >= 700);
      const need = big ? 3 : 4.5;
      const fg = rgba(s.color);
      const op = (() => {
        let o = 1;
        for (let n: Element | null = e; n; n = n.parentElement) o *= +getComputedStyle(n).opacity;
        return o;
      })();
      let worst = Infinity;
      let wb: number[] = [0, 0, 0, 1];
      for (const b of backs(e, pseudo)) {
        const r = ratio(over([fg[0], fg[1], fg[2], fg[3] * op], b), b);
        if (r < worst) {
          worst = r;
          wb = b;
        }
      }
      if (worst / need < low[0]) low = [worst / need, `${worst.toFixed(1)}:1 (${name(e)}${pseudo ?? ''}, ${s.color})`];
      if (worst < need) {
        bad.set(
          `${name(e)}${pseudo ?? ''}|${s.color}`,
          `${name(e)}${pseudo ?? ''} "${text}" ${s.color} on rgb(${wb.slice(0, 3).map(Math.round)}) = ${worst.toFixed(2)}:1 (needs ${need}, ${size}px)`,
        );
      }
    };
    const shown = (e: Element) => {
      if (!e.getClientRects().length) return false;
      for (let n: Element | null = e; n && n !== document.documentElement; n = n.parentElement) {
        const s = getComputedStyle(n);
        if (s.display === 'none' || s.visibility === 'hidden') return false;
      }
      return true;
    };
    for (const e of document.body.querySelectorAll('*')) {
      if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(e.tagName) || !shown(e)) continue;
      if ([...e.childNodes].some((n) => n.nodeType === 3 && (n.textContent || '').trim())) check(e, undefined, txt(e));
      for (const ps of ['::before', '::after']) {
        const c = getComputedStyle(e, ps).content;
        if (c && c !== 'none' && c !== 'normal' && c !== '""' && shown(e)) check(e, ps, c.slice(0, 40));
      }
    }
    R.contrast.push(...bad.values());
    R.notes.push(`lowest contrast against its need: ${low[1]}`);

    // ---- nothing sticks out sideways; wide code scrolls inside itself
    const de = document.documentElement;
    if (de.scrollWidth > W) R.overflow.push(`the page is ${de.scrollWidth} px wide in a ${W} px window`);
    if (document.body.scrollWidth > W) R.overflow.push(`the body is ${document.body.scrollWidth} px wide in a ${W} px window`);
    for (const e of root.querySelectorAll('*')) {
      if (e.closest('pre')) continue;
      const r = e.getBoundingClientRect();
      if (r.width && (r.right > W + 0.5 || r.left < -0.5)) R.overflow.push(`${name(e)} "${txt(e)}" spans ${Math.round(r.left)} to ${Math.round(r.right)}`);
    }
    for (const pre of root.querySelectorAll('pre')) {
      const r = pre.getBoundingClientRect();
      const ox = getComputedStyle(pre).overflowX;
      if (r.right > W + 0.5 || r.left < -0.5) R.overflow.push(`a pre spans ${Math.round(r.left)} to ${Math.round(r.right)}`);
      if (pre.scrollWidth > pre.clientWidth + 1 && !['auto', 'scroll'].includes(ox)) {
        R.overflow.push(`a pre is wider than its box (${pre.scrollWidth} > ${pre.clientWidth}) and does not scroll (overflow-x: ${ox})`);
      }
      if (pre.scrollWidth > pre.clientWidth + 1) {
        pre.scrollLeft = 50;
        if (pre.scrollLeft < 1) R.overflow.push('a wide pre does not scroll');
        R.notes.push(`pre scrolls inside itself (${pre.scrollWidth} in ${pre.clientWidth})`);
        pre.scrollLeft = 0;
      }
    }
    R.notes = [...new Set(R.notes)];
    return R;
  }, kind);

  const { notes, ...found } = out;
  return { found, notes };
}
