// Unit tests of loadSite() and furnish() on the pages that tools/site.py writes from tools/testdata/site.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { loadSite } from './load.js';
import { furnish } from './site.js';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const DATA = join(ROOT, 'tools/testdata/site');
const content = () => JSON.parse(readFileSync(join(ROOT, 'public/content.json'), 'utf8'));
let out = '';

beforeAll(() => {
  out = mkdtempSync(join(tmpdir(), 'arcadia-site-'));
  execFileSync('python3', [join(ROOT, 'tools/site.py'), '--posts', join(DATA, 'posts'), '--projects', join(DATA, 'projects'),
    '--profile', join(DATA, 'profile.json'), '--out', out], { cwd: ROOT, stdio: 'ignore' });
});
afterAll(() => rmSync(out, { recursive: true, force: true }));
afterEach(() => vi.unstubAllGlobals());

function serve(skip: string[] = []) {
  vi.stubGlobal('fetch', async (url: string) => {
    const file = join(out, url);
    if (skip.includes(url) || !existsSync(file)) return { ok: false, json: async () => null };
    return { ok: true, json: async () => JSON.parse(readFileSync(file, 'utf8')) };
  });
}

describe('furnish with the fixture site', () => {
  test('the Library shelves every post', async () => {
    serve();
    const c = content(), site = await loadSite();
    furnish(c, site);
    expect(c.rooms.writing.volumes.map((p: { slug: string }) => p.slug)).toEqual(['my-homelab']);
  });

  test('Fabrication shows the named exhibits and fills the gaps by rank', async () => {
    serve();
    const c = content(), site = await loadSite();
    furnish(c, site);
    expect(c.rooms.projects.exhibits.map((e: { name: string } | null) => e?.name ?? null))
      .toEqual(['Second', 'Minimal', 'Quiet', 'Homelab <&> "one"', 'Unranked']);
    expect(c.rooms.projects.screens.list.map((s: { name: string }) => s.name)).toEqual(['Second', 'Minimal', 'Quiet', 'Homelab <&> "one"']);
  });

  test('Navigation has a station for each entry of the timeline, the newest last', async () => {
    serve();
    const c = content(), site = await loadSite();
    furnish(c, site);
    const stations = c.rooms.experience.stations;
    expect(stations).toHaveLength(site.profile.timeline.length);
    expect(stations.at(-1).model).toBe(c.rooms.experience.models.at(-1));
  });

  test('Contact gets the profile links and the résumé last', async () => {
    serve();
    const c = content(), site = await loadSite();
    furnish(c, site);
    const comms = c.rooms.comms.comms;
    expect(comms.name).toBe(site.profile.name);
    expect(comms.links.at(-1)).toEqual([comms.resume, site.profile.resume]);
    expect(comms.links.slice(0, -1).map(([, url]: [string, string]) => url)).toEqual(site.profile.contact.links.map((l: { url: string }) => l.url));
  });

  test('without a profile the rooms drop what the profile would fill', async () => {
    serve(['profile.json']);
    const c = content(), site = await loadSite();
    expect(site.profile).toBeNull();
    furnish(c, site);
    expect(c.rooms.experience.facts).toHaveLength(1);
    expect(c.rooms.lobby.sub).toEqual([]);
    expect(c.rooms.about.cta).toBeUndefined();
  });
});
