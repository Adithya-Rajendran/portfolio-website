// The entry of the page: the plain page without WebGL 2, or else the station and the page code that use it.
import { stayPlain } from './legacy-shell/plain.js';

const WEBKIT = /AppleWebKit/.test(navigator.userAgent) && !/Chrom(e|ium)|Edg\//.test(navigator.userAgent);

function hasWebGL2() {
  try {
    const gl = document.createElement('canvas').getContext('webgl2', { antialias: WEBKIT, alpha: true, depth: false, stencil: false, powerPreference: 'high-performance' });
    if (!(gl instanceof WebGL2RenderingContext)) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch { return false; }
}

async function start() {
  let shell;
  try { shell = await import('./legacy-shell/shell.js'); } catch (e) { return stayPlain('The station code did not load: ' + (e instanceof Error ? e.message : String(e))); }
  await shell.boot(stayPlain);
}

if (!hasWebGL2()) stayPlain();
else await start();
