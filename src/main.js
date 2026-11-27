// The entry of the page: the plain page without WebGL 2, or else the station and the page code that use it.
import { GL_ATTRS } from './engine/context.js';
import { stayPlain } from './legacy-shell/plain.js';

function hasWebGL2() {
  try {
    const gl = document.createElement('canvas').getContext('webgl2', GL_ATTRS);
    if (!(gl instanceof WebGL2RenderingContext)) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch { return false; }
}

if (!hasWebGL2()) stayPlain();
else await (await import('./legacy-shell/shell.js')).boot();
