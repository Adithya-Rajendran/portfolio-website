// End-to-end spec that loads each route and collects errors
import { attachErrorCollector, expect, test } from '../fixtures/site.ts';

const ROUTES = ['/', '/about/', '/portfolio/', '/experience/', '/contact/', '/blog/'];

test.use({ viewport: { width: 960, height: 540 } });

test.describe('errs: all routes load without errors', () => {
  for (const route of ROUTES) {
    test(`loads ${route} cleanly`, async ({ page, siteData }) => {
      const url = new URL(route, 'http://127.0.0.1:8080');
      const rooms = siteData.content.rooms;
      const first = `/${url.pathname.split('/')[1]}/`.replace('//', '/');
      const expectedRoom =
        (first !== '/' && Object.keys(rooms).find((id) => rooms[id]?.path === first)) ||
        'lobby';

      const errors = attachErrorCollector(page);
      await page.goto(route);
      await page.waitForFunction(
        (id) =>
          !!document.querySelector('#loader')?.getAttribute('data-failed') ||
          ((window as any).__lobby?.mode().room === id && !!document.querySelector('#loader.done')),
        expectedRoom,
        { timeout: 120_000 },
      );
      await page.waitForTimeout(750);

      const state = await page.evaluate(() => {
        const loader = document.querySelector('#loader') as HTMLElement | null;
        return loader?.dataset.failed
          ? { failed: document.querySelector('#what')?.textContent ?? 'failed' }
          : (window as any).__lobby.mode();
      });

      expect(errors, `browser errors on ${route}`).toEqual([]);
      expect(state?.room, `room state on ${route}`).toBe(expectedRoom);
    });
  }
});
