// Guards of the measuring scripts: the pinned-state check and the overall deadline
export const NEEDED = 'tier=0 (or tier=1) and scale=1, for example "?shot=hero&tier=0&scale=1"';

export const pinnedProblem = (state) => {
  if (!state?.hasLobby) return 'the page has no window.__lobby, so the governor cannot be read';
  if (!state.hasTimer) return 'the browser has no EXT_disjoint_timer_query_webgl2';
  if (state.allPinned) return null;
  return `the governor is not pinned (scale pinned: ${state.scalePinned}, tier pinned: ${state.tierPinned}), so the page runs its own GPU timer query around each draw and the per-pass queries of this script cannot run. Add the query switches ${NEEDED}`;
};

export async function requirePinned(page) {
  const state = await page.evaluate(() => {
    const L = window.__lobby, g = L?.gov;
    const gl = L?.renderer?.getContext?.();
    return { hasLobby: !!L && !!g, hasTimer: !!gl?.getExtension('EXT_disjoint_timer_query_webgl2'), allPinned: !!g?.allPinned, scalePinned: !!g?.scalePinned, tierPinned: !!g?.tierPinned };
  });
  const why = pinnedProblem(state);
  if (why) throw new Error(`measure: ${why}`);
}

export function deadline(name, ms, stop) {
  const secs = Number(process.env.MEASURE_TIMEOUT_S) || ms / 1000;
  const id = setTimeout(async () => {
    console.error(`${name}: no result after ${secs} s, stopping`);
    try { await Promise.race([stop?.(), new Promise((r) => setTimeout(r, 5000))]); } catch {}
    process.exit(3);
  }, secs * 1000);
  return () => clearTimeout(id);
}

export function fail(name, e) {
  console.error(`${name}: ${e.message}`);
  process.exitCode = 1;
}
