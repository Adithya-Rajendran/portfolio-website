// End-to-end spec for the opening sequence
import {
  canvasSpyInitScript,
  expect,
  frameGateInitScript,
  loadJson,
  test,
  waysRecorderInitScript,
  type SceneData,
  type WaysSnapshot,
} from '../fixtures/site.ts';
import { boxCorners, sleep, StationPage } from '../pages/station.ts';

const noneShown = (r: WaysSnapshot, names: string[]) => names.filter((k) => (r.max[k] || 0) > 0);

async function installOpeningScripts(context: import('@playwright/test').BrowserContext, baseOrigin: string, external: string[]) {
  await context.addInitScript(canvasSpyInitScript);
  await context.addInitScript(waysRecorderInitScript);
  await context.addInitScript(frameGateInitScript);
  await context.route(
    (u) => u.origin !== baseOrigin,
    (r) => {
      external.push(r.request().url());
      return r.fulfill({ status: 200, contentType: 'text/html', body: '<title>external</title>' });
    },
  );
}

async function waitRest(st: StationPage) {
  await st.until(() => !(window as any).__lobby.display.state().gliding, undefined, 90_000);
}

async function waitClosed(st: StationPage, phone: boolean) {
  await st.leave(phone);
  await st.until(() => (window as any).__lobby.reader.state() === 'closed', undefined, 30_000);
  await waitRest(st);
  await st.page.waitForTimeout(1500);
}

test.describe('opening: ways of opening across Fabrication, Lounge, and Navigation', { tag: '@timing' }, () => {
  test.describe.configure({ mode: 'serial' });

  test('F: Fabrication exhibit flat scan and receiving list / non-exhibit project', async ({ context, baseURL, profile, siteData }) => {
    const baseOrigin = new URL(baseURL || 'http://127.0.0.1:8080').origin;
    const external: string[] = [];
    const errs: string[] = [];
    await installOpeningScripts(context, baseOrigin, external);

    const st = await StationPage.open(context, '/portfolio/', 'projects', errs);
    try {
      await st.until(() => (window as any).__lobby.ready() >= 1 && (window as any).__lobby.picks.length > 0, undefined, 60_000);
      const src = await st.sources();
      expect(src.length > 0 && src.every((q) => q.kind === 'sphere'), 'every source of Fabrication is an exhibit sphere').toBe(true);
      expect(
        await st.page.evaluate(() => (window as any).__lobby.picks.every((q: any) => q.mesh.userData?.screen === undefined)),
        'no wall screen is a pick',
      ).toBe(true);

      const ex = src[0];
      await st.focus(ex.i);
      await st.camStill();
      await st.until(() => (window as any).__lobby.picks.find((q: any) => q.reads).live(), undefined, 30_000);
      const l = await st.look();
      expect(l.live && l.glyph, 'exhibit in focus offers READ glyph').toBe(true);

      await st.markWays();
      const r = await st.readNow(profile.phone, 'glyph');
      await sleep(300);
      let rec = await st.markWays();
      expect(r.ok, 'READ on exhibit opens article').toBe(true);

      if (profile.still) {
        expect(rec.astray, 'reduced motion: reader stays inside viewport').toBeLessThan(1);
        expect(!rec.max.ScanFan && !rec.max.ScanSheet, 'reduced motion: no ScanFan or ScanSheet').toBe(true);
      } else {
        expect(rec.states.includes('scanning') && rec.states.at(-1) === 'open', 'reader goes scanning then open').toBe(true);
        expect(
          (rec.byState.scanning?.ScanSheet || 0) >= 1 && (rec.byState.scanning?.ScanFan || 0) === 1 && !rec.max.ScanBody,
          'flat scan shows ScanSheet and one ScanFan, no ScanBody',
        ).toBe(true);
        expect(rec.word, 'glyph says SCANNING (uWord > 0.5)').toBeGreaterThan(0.5);
      }
      await waitClosed(st, profile.phone);

      const { projects, content } = siteData;
      for (const via of ['button', 'address'] as const) {
        const nonEx = projects.find((q) => !content.rooms.projects.exhibits.includes(q.slug));
        const url = nonEx?.url ?? projects[0].url;
        const tag = via === 'button' ? 'the list ("ALL n PROJECTS")' : `a project with no exhibit (${url})`;
        await st.clearFocus();
        await waitRest(st);
        await st.page.waitForTimeout(800);

        const pre = await st.look();
        expect(!pre.live && !pre.glyph, `${tag}: no READ offered beforehand`).toBe(true);

        await st.markWays();
        if (via === 'button') {
          await st.page.evaluate(() => (document.querySelector('.hero .cta') as HTMLElement).click());
        } else {
          await st.reader.read(url);
        }

        const ok = await st.until(() => (window as any).__lobby.reader.state() === 'open', undefined, 120_000);
        await sleep(300);
        rec = await st.markWays();
        expect(ok, `${tag}: opens`).toBe(true);
        if (profile.still) {
          expect(rec.astray, `${tag}: reduced motion astray < 1`).toBeLessThan(1);
        }
        expect(
          (profile.still || rec.states.includes('scanning')) &&
            noneShown(rec, ['ReadGlyph', 'ScanFan', 'ScanSheet', 'ScanBody', 'ReadBeam']).length === 0 &&
            !rec.live,
          `${tag}: no ReadGlyph/ScanFan/ScanSheet/ScanBody/ReadBeam and READ pick never live`,
        ).toBe(true);
        if (!profile.still) {
          expect(rec.byState.scanning?.ReadFlow || 0, `${tag}: ReadFlow shows while arriving`).toBeGreaterThanOrEqual(1);
        } else {
          expect(rec.max.ReadFlow || 0, `${tag}: reduced motion no ReadFlow`).toBe(0);
        }

        const s = await st.reader.snap();
        expect(s.shown === (via === 'button' ? 'list' : nonEx!.slug) && s.readerShown, `${tag}: reader shows expected content`).toBe(true);
        if (via === 'button') {
          for (const [k, what, d] of await st.reader.frameChecks(profile.width, profile.height)) {
            expect(k, `list: ${what} (${JSON.stringify(d)})`).toBe(true);
          }
        }
        await waitClosed(st, profile.phone);
        const post = await st.look();
        const enterShown = (await st.reader.snap()).enter;
        expect(
          !post.live && !post.glyph && !enterShown && !((post.ReadGlyph || 0) > 0),
          `${tag}: after CLOSE nothing is offered`,
        ).toBe(true);
      }

      await st.page.evaluate(() => (document.querySelector('.hero .cta') as HTMLElement).click());
      expect(await st.until(() => (window as any).__lobby.reader.state() === 'open', undefined, 120_000), 'CTA opens list again').toBe(true);
      await waitClosed(st, profile.phone);
      expect(errs, 'no errors in Fabrication').toEqual([]);
      expect(external, 'no external requests in Fabrication').toEqual([]);
    } finally {
      await st.page.close();
    }
  });

  test('L: Lounge books scan with shape, bounds, lock tracking, and rayHits', async ({ context, baseURL, profile, request }) => {
    const baseOrigin = new URL(baseURL || 'http://127.0.0.1:8080').origin;
    const external: string[] = [];
    const errs: string[] = [];
    await installOpeningScripts(context, baseOrigin, external);

    const scene = await loadJson<SceneData>(request, '/assets/about/scene.json');
    const books = scene.focus[0].boxes!;
    const bookCorners = boxCorners(books);

    const st = await StationPage.open(context, '/about/', 'about', errs);
    try {
      await st.until(() => (window as any).__lobby.ready() >= 1 && (window as any).__lobby.picks.length > 0, undefined, 60_000);
      const bk = await st.page.evaluate(() => (window as any).__lobby.picks.findIndex((q: any) => q.source?.().bodies?.length));
      expect(bk, 'Lounge has a pick with source.bodies').toBeGreaterThanOrEqual(0);

      const bodies = await st.page.evaluate((i) => (window as any).__lobby.picks[i].source().bodies.length, bk);
      expect(bodies === books.length && bodies >= 2, `bodies (${bodies}) match focus[0].boxes (${books.length})`).toBe(true);

      const bnd = (await st.page.evaluate((i) => (window as any).__lobby.picks[i].bounds().map((v: any) => v.toArray()), bk)) as Array<
        [number, number, number]
      >;
      const near = (a: [number, number, number]) => bnd.some((q) => Math.hypot(q[0] - a[0], q[1] - a[1], q[2] - a[2]) < 0.004);
      expect(bnd.length === 8 * books.length && bookCorners.flat().every(near), 'bounds() match all 8 book corners within 4mm').toBe(true);

      const rectOf = () =>
        st.page.evaluate(
          async ({ pts, all }) => {
            const THREE = await import('three');
            const l = (window as any).__lobby;
            l.camera.updateMatrixWorld(true);
            const proj = (set: Array<[number, number, number]>) => {
              let x0 = 1e9;
              let y0 = 1e9;
              let x1 = -1e9;
              let y1 = -1e9;
              let ok = true;
              for (const c of set) {
                const v = new THREE.Vector3(...c).project(l.camera);
                if (v.z > 1) ok = false;
                const x = (v.x * 0.5 + 0.5) * innerWidth;
                const y = (-v.y * 0.5 + 0.5) * innerHeight;
                x0 = Math.min(x0, x);
                x1 = Math.max(x1, x);
                y0 = Math.min(y0, y);
                y1 = Math.max(y1, y);
              }
              return { l: x0, t: y0, r: x1, b: y1, ok };
            };
            return {
              lock: l.display.state().lock as { rect: [number, number, number, number] } | null,
              all: proj(all),
              each: pts.map(proj),
              eye: l.camera.position.toArray() as [number, number, number],
            };
          },
          { pts: bookCorners, all: bookCorners.flat() },
        );

      const rx = await rectOf();
      for (const [k, e] of rx.each.entries()) {
        const x = (e.l + e.r) / 2;
        const y = (e.t + e.b) / 2;
        const hits = await st.rayHits(x, y);
        expect(
          e.ok && x > 0 && x < profile.width && y > 0 && y < profile.height && hits[0]?.[0] === bk,
          `press at center of book ${k + 1} reaches pick ${bk}`,
        ).toBe(true);
      }

      if (!profile.phone) {
        const onBooks = async (target: 'all' | number) => {
          for (let i = 0; i < 10; i++) {
            const s = await rectOf();
            const e = target === 'all' ? s.all : s.each[target];
            await st.page.mouse.move((e.l + e.r) / 2, (e.t + e.b) / 2, { steps: 3 });
            await sleep(700);
            const t = await rectOf();
            const f = target === 'all' ? t.all : t.each[target];
            if (t.lock && Math.abs((f.l + f.r) / 2 - (e.l + e.r) / 2) < 8) return true;
          }
          return false;
        };

        for (const [what, target] of [
          ['the middle of the books', 'all'],
          ['the first book', 0],
          ['the second book', 1],
        ] as const) {
          const got = await onBooks(target);
          expect(got, `pointer on ${what} brings the lock`).toBe(true);
          for (let k = 0; k < 3; k++) {
            await sleep(900);
            const s = await rectOf();
            const [x, y, w, h] = s.lock?.rect ?? [0, 0, 0, 0];
            const a = s.all;
            const tol = 2.5;
            const pad = 6;
            expect(
              !!s.lock &&
                x <= a.l - pad + tol &&
                x >= a.l - pad - tol &&
                y <= a.t - pad + tol &&
                y >= a.t - pad - tol &&
                x + w >= a.r + pad - tol &&
                x + w <= a.r + pad + tol &&
                y + h >= a.b + pad - tol &&
                y + h <= a.b + pad + tol,
              `${what} (look ${k + 1}): lock rect matches projected books + 6px`,
            ).toBe(true);
          }
        }
        await st.page.mouse.move(profile.width - 4, 4);
        await st.until(() => !(window as any).__lobby.display.state().lock, undefined, 15_000);
      }

      await st.focus(bk);
      await st.camStill();
      await st.until(() => (window as any).__lobby.picks.find((q: any) => q.reads).live(), undefined, 30_000);
      const l = await st.look();
      expect(l.live && l.glyph, 'books in focus offer READ').toBe(true);

      await st.markWays();
      const r = await st.readNow(profile.phone, 'glyph');
      await sleep(300);
      const rec = await st.markWays();
      expect(r.ok, 'READ opens Lounge article').toBe(true);

      if (profile.still) {
        expect(rec.astray, 'reduced motion: astray < 1').toBeLessThan(1);
        expect(!rec.max.ScanFan && !rec.max.ScanSheet && !rec.max.ScanBody, 'reduced motion: no scan meshes').toBe(true);
      } else {
        expect(rec.states.includes('scanning') && rec.states.at(-1) === 'open', 'reader goes scanning then open').toBe(true);
        expect(rec.byState.scanning?.ScanBody || 0, 'one ScanBody per book').toBe(books.length);
        expect(rec.byState.scanning?.ScanFan || 0, 'a ScanFan per book').toBeGreaterThanOrEqual(books.length);
        expect(rec.max.ScanSheet || 0, 'no ScanSheet').toBe(0);
        expect(rec.word, 'glyph never says SCANNING').toBeLessThan(0.5);
      }

      await st.page.waitForTimeout(1500);
      for (const [k, what, d] of await st.reader.frameChecks(profile.width, profile.height)) {
        expect(k, `${what} (${JSON.stringify(d)})`).toBe(true);
      }
      await waitClosed(st, profile.phone);
      const after = await st.look();
      expect(!after.ScanBody && !after.ScanFan && !after.ScanSheet, 'no scan meshes left after CLOSE').toBe(true);
      expect(errs, 'no errors in Lounge').toEqual([]);
    } finally {
      await st.page.close();
    }
  });

  test('N: Navigation station unfolds and CLOSE folds frame in place', async ({ context, baseURL, profile }) => {
    const baseOrigin = new URL(baseURL || 'http://127.0.0.1:8080').origin;
    const external: string[] = [];
    const errs: string[] = [];
    await installOpeningScripts(context, baseOrigin, external);

    const sheets = () =>
      st.page.evaluate(() => {
        const o: number[] = [];
        (window as any).__lobby.scene.traverse((n: any) => {
          if (n.isSprite && n.userData.pane) o.push(n.material.opacity);
        });
        return o;
      });

    const st = await StationPage.open(context, '/experience/', 'experience', errs);
    try {
      await st.until(
        () => (window as any).__lobby.ready() >= 1 && !!(window as any).__lobby.turn && (window as any).__lobby.picks.length > 0,
        undefined,
        60_000,
      );
      const stations = await st.page.evaluate(() =>
        (window as any).__lobby.picks
          .map((q: any, i: number) => ({ i, s: q.station, how: q.source?.().how }))
          .filter((q: any) => q.s != null) as Array<{ i: number; s: number; how: string }>,
      );
      const N = stations.length;
      expect(N > 1 && stations.every((q) => q.how === 'unfold'), 'every station opens by unfolding').toBe(true);
      const sh0 = await sheets();
      expect(sh0.length === N && sh0.every((o) => o === 1), 'each station has a sheet at opacity 1').toBe(true);

      const src = await st.sources();
      expect(src.length === N && src.every((q) => q.kind === 'sphere'), 'stations are the only sources').toBe(true);

      await st.focus(stations[1].i);
      await st.camStill();
      await st.until(() => (window as any).__lobby.turn.settled(), undefined, 60_000);
      await st.until(() => (window as any).__lobby.picks.find((q: any) => q.reads).live(), undefined, 30_000);

      const l = await st.look();
      expect(l.live && l.glyph, 'station in focus offers READ').toBe(true);

      await st.markWays();
      const r = await st.readNow(profile.phone, 'glyph', 120_000);
      await sleep(300);
      const rec = await st.markWays();
      expect(r.ok, 'READ on station opens entry').toBe(true);

      if (profile.still) {
        expect(rec.astray, 'reduced motion: astray < 1').toBeLessThan(1);
      }
      expect(
        (profile.still || rec.states.includes('scanning')) && rec.states.at(-1) === 'open',
        'reader reaches open via scanning (or cut on reduced motion)',
      ).toBe(true);
      expect(rec.word, 'glyph never says SCANNING').toBeLessThan(0.5);
      expect(!rec.max.ScanFan && !rec.max.ScanSheet && !rec.max.ScanBody, 'no Scan* meshes').toBe(true);
      if (!profile.still) {
        expect(rec.max.ReadPrint || 0, 'ReadPrint shows').toBeGreaterThanOrEqual(1);
      }
      expect(rec.dark, 'station sheet goes dark while reading').toBeGreaterThanOrEqual(1);

      await st.page.waitForTimeout(1200);
      const s = await st.reader.snap();
      const sh = await sheets();
      expect(s.readerShown && !!s.shown && sh.filter((o) => o < 0.01).length === 1, 'frame at rest, one sheet dark').toBe(true);

      for (const [k, what, d] of await st.reader.frameChecks(profile.width, profile.height)) {
        expect(k, `${what} (${JSON.stringify(d)})`).toBe(true);
      }
      await waitClosed(st, profile.phone);
      const sh2 = await sheets();
      expect(sh2.every((o) => o === 1), 'after CLOSE all sheets return to opacity 1').toBe(true);
      const after = await st.look();
      expect(!after.ReadPrint && !after.ReadFrame, 'ReadPrint and ReadFrame hidden after CLOSE').toBe(true);

      if (!profile.phone && !profile.still) {
        await st.focus(stations[2].i);
        await st.camStill();
        await st.until(() => (window as any).__lobby.turn.settled(), undefined, 60_000);
        await st.until(() => (window as any).__lobby.picks.find((q: any) => q.reads).live(), undefined, 30_000);
        await sleep(1500);

        const readFrame = () =>
          st.page.evaluate(() => {
            const f = (window as any).__lobby.scene.getObjectByName('ReadFrame');
            let v = true;
            for (let e = f; e; e = e.parent) if (!e.visible) v = false;
            return { vis: v, w: +f.scale.x.toFixed(3), x: +f.position.x.toFixed(3), y: +f.position.y.toFixed(3) };
          });

        await st.gate.shut();
        await st.page.evaluate(() => {
          const l = (window as any).__lobby;
          l.setFocus(l.picks.find((q: any) => q.reads));
        });
        await st.gate.step(6);
        const mid = await readFrame();
        await st.reader.close();
        await st.gate.step(2);
        const fold = await readFrame();

        expect(
          mid.vis && mid.w > 0 && fold.vis && Math.abs(fold.w - mid.w) < 1e-3 && Math.abs(fold.x - mid.x) < 1e-3 && Math.abs(fold.y - mid.y) < 1e-3,
          'part-way CLOSE folds ReadFrame in place',
        ).toBe(true);

        await st.gate.step(3);
        await st.gate.open();
        const gone = await st.until(
          () => {
            const f = (window as any).__lobby.scene.getObjectByName('ReadFrame');
            for (let e = f; e; e = e.parent) if (!e.visible) return true;
            return false;
          },
          undefined,
          60_000,
        );
        expect(gone, 'ReadFrame hides after fold finishes').toBe(true);
        const sh3 = await sheets();
        expect(sh3.length === N && sh3.every((o) => o === 1), 'all sheets back to opacity 1').toBe(true);
      }

      expect(errs, 'no errors in Navigation').toEqual([]);
    } finally {
      await st.page.close();
    }
  });
});
