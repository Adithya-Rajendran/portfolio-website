// End-to-end spec for the turning of the Navigation route map and its hint
import { expect, test } from '../fixtures/site.ts';
import { sleep, StationPage } from '../pages/station.ts';

const wrap = (x: number) => {
  const T = 2 * Math.PI;
  return x - T * Math.round(x / T);
};

test.describe('turn: Navigation route map turning and hint', { tag: '@timing' }, () => {
  test.describe.configure({ mode: 'serial' });

  test('map drag, pen, CDP touch, wheel, focus/tour, guards, hint, and non-turning rooms', async ({ context, profile, siteData }) => {
    const D = siteData.content.display;
    const HINT = siteData.content.rooms.experience.hint;
    const errs: string[] = [];

    const st = await StationPage.open(context, '/experience/', 'experience', errs);
    const p = st.page;

    const TS = () =>
      p.evaluate(() => {
        const t = (window as any).__lobby.turn;
        const d = (window as any).__lobby.display.state();
        return {
          a: t.angle() as number,
          front: t.front() as number,
          settled: t.settled() as boolean,
          moving: t.moving() as boolean,
          hand: t.byHand() as boolean,
          head: t.heading() as number | null,
          named: d.named as string,
          hint: d.hint as string,
          grip: t.grip() as number,
          gliding: d.gliding as boolean,
        };
      });

    const rested = (t = 90_000) => st.until(() => (window as any).__lobby.turn.settled() && !(window as any).__lobby.display.state().gliding, undefined, t);
    const onStation = (k: number, t = 90_000) =>
      st.until(
        (idx) => (window as any).__lobby.turn.front() === idx && (window as any).__lobby.turn.settled() && !(window as any).__lobby.display.state().gliding,
        k,
        t,
      );
    const wheel = (dx: number, dy: number, shift = false) =>
      p.evaluate(
        ([wx, wy, s]) => {
          const e = new WheelEvent('wheel', {
            deltaX: wx,
            deltaY: wy,
            shiftKey: s,
            bubbles: true,
            cancelable: true,
            clientX: innerWidth * 0.6,
            clientY: innerHeight * 0.4,
          });
          document.querySelector('#scene')!.dispatchEvent(e);
          return e.defaultPrevented;
        },
        [dx, dy, shift] as [number, number, boolean],
      );

    try {
      await st.until(
        () => (window as any).__lobby.ready() >= 1 && !!(window as any).__lobby.turn && (window as any).__lobby.picks.length > 0,
        undefined,
        60_000,
      );
      const cdp = profile.phone ? await context.newCDPSession(p) : null;
      const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x = 0, y = 0) =>
        cdp!.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });

      const stations = await p.evaluate(() =>
        (window as any).__lobby.picks
          .map((q: any, i: number) => ({ i, s: q.station as number, name: q.name as string }))
          .filter((q: any) => q.s != null)
          .sort((a: any, b: any) => a.s - b.s),
      );
      const N = stations.length;

      await test.step('1. hooks and initial state', async () => {
        const missingHooks = await p.evaluate(() => {
          const t = (window as any).__lobby.turn;
          return ['angle', 'front', 'settled', 'moving', 'byHand', 'heading', 'to', 'nudge', 'step', 'grip'].filter((k) => typeof t?.[k] !== 'function');
        });
        expect(missingHooks, '__lobby.turn hooks present').toEqual([]);
        expect(N > 1 && stations.every((q: any, i: number) => q.s === i), `stations carry 0..${N - 1}`).toBe(true);
        expect(
          await p.evaluate(() => document.querySelector('#scene')!.classList.contains('turns')),
          '#scene has .turns',
        ).toBe(true);
        expect(
          await p.evaluate(() => getComputedStyle(document.querySelector('#scene')!).touchAction),
          'touch-action includes pan-y',
        ).toMatch(/pan-y/);

        const t0 = await TS();
        expect(t0.settled && !t0.hand && t0.named === '', 'initial state settled, !byHand, nothing focused').toBe(true);
        expect(t0.hint === HINT[profile.kind] && !!HINT[profile.kind], 'initial hint is room hint').toBe(true);
        expect(await p.evaluate(() => document.querySelector('#hud .hint .how')?.textContent)).toBe(HINT[profile.kind]);
      });

      const home: number[] = [];
      for (const q of stations) {
        await p.evaluate((s) => (window as any).__lobby.turn.to(s, true), q.s);
        home.push((await TS()).a);
      }
      await p.evaluate(() => (window as any).__lobby.turn.to(0, true));
      const near = (i: number, a: number) => home[i] + 2 * Math.PI * Math.round((a - home[i]) / (2 * Math.PI));
      const nearest = (a: number) => stations.map((_: unknown, i: number) => [i, Math.abs(near(i, a) - a)]).sort((x: number[], y: number[]) => x[1] - y[1])[0][0];

      const tSnap = await TS();
      expect(tSnap.front === 0 && tSnap.settled && !tSnap.hand, 'turn.to(0, true) snaps cleanly').toBe(true);
      const gap = Math.abs(wrap(home[1] - home[0]));

      const spot = await st.canvasPoint(0.62, 0.3);
      expect(spot, 'canvasPoint available').not.toBeNull();
      const X0 = Math.round(spot!.x);
      const Y0 = Math.round(spot!.y);

      async function drag(how: 'mouse' | 'pen' | 'touch', n: number, dx: number, dy = 0, hold = 160) {
        const sign = dx < 0 ? 1 : -1;
        const x0 = sign > 0 ? X0 + 90 : X0 - 90;
        const before = await TS();
        const at = (i: number): [number, number] => [x0 + i * dx, Y0 + (i * dy) / Math.max(1, n)];
        if (how === 'mouse') {
          await p.mouse.move(...at(0));
          await p.mouse.down();
          for (let i = 1; i <= n; i++) {
            await p.mouse.move(...at(i));
            await sleep(20);
          }
        } else if (how === 'pen') {
          await st.pen.down(...at(0));
          for (let i = 1; i <= n; i++) {
            await st.pen.move(...at(i));
            await sleep(20);
          }
        } else {
          await touch('touchStart', ...at(0));
          for (let i = 1; i <= n; i++) {
            await touch('touchMove', ...at(i));
            await sleep(20);
          }
        }
        const during = await TS();
        await sleep(hold);
        if (how === 'mouse') await p.mouse.up();
        else if (how === 'pen') await st.pen.up(...at(n));
        else await touch('touchEnd');
        return { before, during, dist: n * dx };
      }

      await test.step('2. drag, thresholds, fling, and click-after-drag', async () => {
        for (const how of (profile.phone ? ['touch'] : ['mouse', 'pen']) as Array<'touch' | 'mouse' | 'pen'>) {
          await p.evaluate(() => (window as any).__lobby.turn.to(0, true));
          await sleep(300);
          const px = Math.round((gap * (await TS()).grip * 0.7) / 8);
          const r = await drag(how, 8, -px);
          const want = r.dist / r.before.grip;
          const got = r.during.a - r.before.a;
          expect(
            r.during.hand &&
              !r.during.settled &&
              Math.abs(got - want) <= Math.abs(want) * 0.12 + 0.01 &&
              Math.sign(got) === Math.sign(want),
            `${how}: follows pointer by 1/grip`,
          ).toBe(true);

          const target = r.before.a + got;
          await sleep(100);
          const ok = await st.until(() => (window as any).__lobby.turn.settled(), undefined, 60_000);
          const s = await TS();
          expect(ok && s.head === s.front && Math.abs(near(s.front, s.a) - s.a) < 1e-3, `${how}: settles on station front`).toBe(true);
          expect(s.front, `${how}: settles on nearest station`).toBe(nearest(target));
        }

        await p.evaluate(() => (window as any).__lobby.turn.to(0, true));
        const a0 = (await TS()).a;
        await st.pen.down(X0, Y0);
        await st.pen.move(X0 - 5, Y0);
        let s = await TS();
        expect(s.a === a0 && !s.hand, '5 px move is not a turn').toBe(true);
        await st.pen.move(X0 - 12, Y0);
        s = await TS();
        expect(s.a !== a0 && s.hand, '12 px sideways move turns').toBe(true);
        await sleep(150);
        await st.pen.up(X0 - 12, Y0);
        await st.until(() => (window as any).__lobby.turn.settled(), undefined, 60_000);

        await p.evaluate(() => (window as any).__lobby.turn.to(0, true));
        const a1 = (await TS()).a;
        await st.pen.down(X0, Y0);
        await st.pen.move(X0 - 10, Y0 + 14);
        await st.pen.move(X0 - 90, Y0 + 15);
        s = await TS();
        expect(s.a === a1 && s.settled, 'mostly vertical move cancels gesture').toBe(true);
        await st.pen.up(X0 - 90, Y0 + 15);

        if (!profile.phone) {
          await p.evaluate(() => (window as any).__lobby.turn.to(0, true));
          await sleep(300);
          const fl0 = (await TS()).a;
          await p.mouse.move(X0 + 140, Y0);
          await p.mouse.down();
          for (let i = 1; i <= 8; i++) {
            await p.mouse.move(X0 + 140 - i * 40, Y0);
            await sleep(16);
          }
          await p.mouse.up();
          const flung = await p.evaluate(() => (window as any).__lobby.turn.moving() || !(window as any).__lobby.turn.settled());
          const ok = await st.until(() => (window as any).__lobby.turn.settled(), undefined, 60_000);
          const sf = await TS();
          expect(profile.still ? true : flung, 'fling coasts after release').toBe(true);
          expect(
            ok && sf.head === sf.front && (profile.still || Math.abs(sf.a - fl0) >= (320 / sf.grip) * 0.8) && Math.sign(sf.a - fl0) === -1,
            'fling settles further in drag direction',
          ).toBe(true);

          await st.clearFocus();
          await rested();
          let pt: { x: number; y: number; inside: boolean; reaches: boolean; top: string | null } | null = null;
          let k = -1;
          for (const q of stations) {
            const c = await st.pickPoint(q.i);
            if (c.inside && c.reaches && c.top === 'scene') {
              pt = c;
              k = q.i;
              break;
            }
          }
          if (pt) {
            await p.mouse.move(pt.x, pt.y);
            await p.mouse.down();
            for (let i = 1; i <= 6; i++) {
              await p.mouse.move(pt.x - i * 8, pt.y);
              await sleep(20);
            }
            await sleep(150);
            await p.mouse.up();
            await st.until(() => (window as any).__lobby.turn.settled(), undefined, 60_000);
            await sleep(700);
            expect((await TS()).named, 'drag across station does not focus it').toBe('');
            const again = await st.pickPoint(k);
            if (again.inside && again.reaches) {
              await p.mouse.click(again.x, again.y);
              expect(await st.until(() => !!(window as any).__lobby.display.state().named, undefined, 20_000), 'plain click focuses station').toBe(true);
            }
            await st.clearFocus();
            await rested();
          }
        }
      });

      await test.step('3. wheel behavior', async () => {
        await p.evaluate(() => (window as any).__lobby.turn.to(0, true));
        await sleep(300);
        await st.clearFocus();
        await rested();
        const y0 = await p.evaluate(() => scrollY);
        const a0 = (await TS()).a;
        const pv = await wheel(0, 200);
        let s = await TS();
        expect(!pv && s.a === a0, 'plain vertical wheel ignored').toBe(true);

        if (!profile.still) {
          const sh = await wheel(0, 100, true);
          s = await TS();
          expect(sh && Math.abs(s.a - a0 - -100 * 0.005) < 1e-6 && s.hand, 'Shift + vertical wheel turns -0.5 rad').toBe(true);
          await st.until(() => (window as any).__lobby.turn.settled(), undefined, 60_000);

          const b0 = (await TS()).a;
          let all = true;
          for (let i = 0; i < 5; i++) all = (await wheel(60, 0)) && all;
          s = await TS();
          expect(all && Math.abs(s.a - b0 - -300 * 0.005) < 1e-6 && !s.settled, 'sideways wheel 5x60 turns -1.5 rad and prevents default').toBe(true);
          const ok = await st.until(() => (window as any).__lobby.turn.settled(), undefined, 60_000);
          s = await TS();
          expect(ok && s.head === s.front, 'settles on station front after wheel').toBe(true);

          await p.mouse.move(profile.width * 0.6, profile.height * 0.4);
          const c0 = (await TS()).a;
          for (let i = 0; i < 4; i++) {
            await p.mouse.wheel(80, 0);
            await sleep(30);
          }
          expect(
            await st.until((a) => Math.abs((window as any).__lobby.turn.angle() - a) > 0.2, c0, 20_000),
            'Playwright mouse.wheel sideways turns map',
          ).toBe(true);
          await st.until(() => (window as any).__lobby.turn.settled(), undefined, 60_000);
        } else {
          const f0 = (await TS()).front;
          await wheel(50, 0);
          await wheel(50, 0);
          s = await TS();
          expect(
            s.settled && s.front === (f0 + 1) % N && Math.abs(near(s.front, s.a) - s.a) < 1e-6,
            'reduced motion: 100px sideways wheel steps one station',
          ).toBe(true);
          await wheel(-100, 0);
          s = await TS();
          expect(s.settled && s.front === f0, 'reduced motion: steps back').toBe(true);
          await wheel(0, 100, true);
          s = await TS();
          expect(s.front, 'reduced motion: Shift + vertical wheel steps one station').toBe((f0 + 1) % N);
        }
        expect(await p.evaluate(() => scrollY), 'page itself did not scroll').toBe(y0);
      });

      await test.step('4. focus and tour', async () => {
        if (N > 1) {
          await st.clearFocus();
          await rested();
          const order: Array<[string, string, number | null]> = [];
          for (let k = 0; k <= N; k++) {
            await st.step(1);
            order.push(
              await p.evaluate(() => {
                const d = (window as any).__lobby.display.state();
                const n = document.querySelector('#count')!.textContent!;
                return [n, d.named, (window as any).__lobby.picks.find((q: any) => q.name === d.named)?.station ?? null];
              }),
            );
          }
          expect(
            order.slice(0, N).every((o, k) => o[2] === k && o[0].startsWith(`${k + 1} / `)),
            'tour visits stations 0..N-1 first',
          ).toBe(true);
          expect(order[N][2] === null && order[N][0].startsWith(`${N + 1} / `), 'then visits rest of room').toBe(true);

          for (const k of [N - 1, 1, 0]) {
            await st.focus(stations[k].i);
            const ok = await onStation(k);
            const s = await TS();
            expect(ok && s.front === k && !s.hand && s.named === stations[k].name, `focusing station ${k} turns map to it`).toBe(true);
          }

          await wheel(-240, 0);
          const got = await st.until(() => (window as any).__lobby.turn.front() !== 0, undefined, 60_000);
          await st.until(
            () =>
              (window as any).__lobby.turn.settled() &&
              !(window as any).__lobby.display.state().gliding &&
              (window as any).__lobby.display.state().named ===
                (window as any).__lobby.picks.find((q: any) => q.station === (window as any).__lobby.turn.front())?.name,
            undefined,
            90_000,
          );
          const sf = await TS();
          expect(got && sf.front !== 0 && sf.hand && sf.named === stations[sf.front]?.name, 'hand turn moves focus to new front station').toBe(true);

          await st.clearFocus();
          await rested();
          for (let i = 0; i < 5; i++) await wheel(60, 0);
          await st.focus(stations[0].i);
          await onStation(0);
          const s0 = await TS();
          expect(s0.front === 0 && s0.named === stations[0].name && !s0.hand, 'wheel then immediate station 0 ends on station 0').toBe(true);

          if (!profile.phone && !profile.still) {
            const e = (await st.canvasPoint(0.9, 0.12))!;
            await p.mouse.move(X0 + 140, Y0);
            await p.mouse.down();
            for (let i = 1; i <= 8; i++) {
              await p.mouse.move(X0 + 140 - i * 45, Y0);
              await sleep(16);
            }
            await p.mouse.up();
            const coasting = await p.evaluate(() => (window as any).__lobby.turn.moving());
            await p.mouse.move(e.x, e.y);
            await p.mouse.down();
            await sleep(60);
            await p.mouse.up();
            await st.until(() => (window as any).__lobby.turn.settled(), undefined, 60_000);
            await rested();
            const sc = await TS();
            expect(coasting, 'map coasts when flung').toBe(true);
            expect(sc.named, 'tap on empty canvas stops coast without losing focus').not.toBe('');
          }
        }
      });

      await test.step('5. guards (nav and reading)', async () => {
        await st.clearFocus();
        await rested();
        const a0 = (await TS()).a;
        if (!profile.phone) {
          const nav = (await p.locator('#hud nav a[data-view="0"]').boundingBox())!;
          await p.mouse.move(nav.x + 8, nav.y + nav.height / 2);
          await p.mouse.down();
          for (let i = 1; i <= 8; i++) {
            await p.mouse.move(nav.x + 8 + i * 6, nav.y + nav.height / 2);
            await sleep(20);
          }
          await p.mouse.up();
          for (let i = 1; i <= 12; i++) {
            await p.mouse.move(X0 - i * 30, Y0 + i);
            await sleep(20);
          }
          const s = await TS();
          expect(s.a === a0 && s.settled, 'drag starting on nav and bare pointer moves do not turn map').toBe(true);
        }

        await p.evaluate(() => {
          const l = (window as any).__lobby;
          l.setFocus(l.picks.find((q: any) => q.station === 1));
        });
        await rested();
        const rd = await st.readNow(profile.phone, 'button', 90_000);
        expect(rd.ok, 'station opened via READ button').toBe(true);
        await sleep(1500);
        const b0 = (await TS()).a;
        await wheel(300, 0);
        await p.evaluate(() => document.querySelector('#reader')!.dispatchEvent(new WheelEvent('wheel', { deltaX: 300, bubbles: true, cancelable: true })));
        if (!profile.phone) {
          await p.mouse.move(X0 + 100, Y0);
          await p.mouse.down();
          for (let i = 1; i <= 8; i++) {
            await p.mouse.move(X0 + 100 - i * 30, Y0);
            await sleep(20);
          }
          await p.mouse.up();
        }
        const sRead = await TS();
        expect(sRead.a === b0 && sRead.settled, 'wheel and drag do not turn map while reading').toBe(true);
        await st.leave(profile.phone);
        await st.until(() => (window as any).__lobby.reader.state() === 'closed', undefined, 20_000);
        await rested();
      });

      await test.step('7. hint lifecycle', async () => {
        const s = await TS();
        const inspected = N > 1;
        expect(s.hint === '' || s.hint === D.hint[profile.kind], 'room hint cleared after manual turn').toBe(true);
        expect(!inspected || s.hint === '', 'hint empty once a station has been inspected').toBe(true);

        const qSt = await StationPage.open(context, '/experience/', 'experience', errs);
        try {
          await qSt.until(() => (window as any).__lobby.ready() >= 1 && !!(window as any).__lobby.turn, undefined, 60_000);
          expect((await qSt.dstate()).hint, 'fresh visit starts with room hint').toBe(HINT[profile.kind]);
          await qSt.page.evaluate(() => (window as any).__lobby.turn.nudge(0.4));
          await qSt.until(
            (h) => (window as any).__lobby.turn.settled() && (window as any).__lobby.display.state().hint === h,
            D.hint[profile.kind],
            60_000,
          );
          expect((await qSt.dstate()).hint, 'nudge switches to general display hint').toBe(D.hint[profile.kind]);
          expect(await qSt.page.evaluate(() => document.querySelector('#hud .hint .how')?.textContent)).toBe(D.hint[profile.kind]);
        } finally {
          await qSt.page.close();
        }
      });

      await test.step('8. other rooms have no turn', async () => {
        await st.enter('projects');
        const there = await st.inRoom('projects', 240_000);
        await st.until(() => (window as any).__lobby.ready() >= 1, undefined, 60_000);
        expect(there, 'entered Fabrication').toBe(true);
        expect(await p.evaluate(() => (window as any).__lobby.turn === null), 'Fabrication __lobby.turn is null').toBe(true);
        expect(await p.evaluate(() => document.querySelector('#scene')!.classList.contains('turns')), '#scene lacks .turns in Fabrication').toBe(false);
        expect(errs, 'no errors in turn spec').toEqual([]);
      });
    } finally {
      await p.close();
    }
  });
});
