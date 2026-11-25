import { attachErrorCollector, expect, test } from '../fixtures/site.ts';

test.use({ viewport: { width: 960, height: 540 } });

test('view: landing page loads and renders WebGL frame across browser engines', async ({ page }, testInfo) => {
  test.setTimeout(660_000);
  const errors = attachErrorCollector(page);
  // Software-rendered Firefox draws about one frame in ten seconds at full size (the intro advances per frame, 50 ms of
  // scene time each), so it is pinned to the cheap tier at half scale; the other engines load the page as a visitor does.
  const lite = testInfo.project.name === 'smoke-firefox' ? '/?tier=1&scale=0.5' : '/';
  await page.goto(lite, { waitUntil: 'load', timeout: 60_000 });

  const t0 = Date.now();
  let state: {
    lobby: boolean;
    intro: number;
    mode: unknown;
    label: string | null;
    pct: string | null;
    loaderDone: boolean;
  } | null = null;

  while (Date.now() - t0 < 600_000) {
    state = await page.evaluate(() => ({
      lobby: !!(window as any).__lobby,
      intro: (window as any).__lobby ? (window as any).__lobby.ready() : -1,
      mode: (window as any).__lobby?.mode(),
      label: document.querySelector('#loader .label')?.textContent ?? null,
      pct: document.getElementById('pct')?.textContent ?? null,
      loaderDone: document.getElementById('loader')?.classList.contains('done') ?? false,
    }));
    if (state.intro >= 1) break;
    await page.waitForTimeout(3000);
  }

  await page.screenshot({ path: testInfo.outputPath(`${testInfo.project.name}.png`), timeout: 120_000 });

  expect(state?.intro ?? -1, `WebGL scene reached ready() >= 1 (${JSON.stringify(state)})`).toBeGreaterThanOrEqual(1);
  expect(errors, `errors in ${testInfo.project.name}`).toEqual([]);
});
