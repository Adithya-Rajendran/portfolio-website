// The attributes of the WebGL context of the station.
import { params } from './dev.js';

const Q = params();
const WEBKIT = /AppleWebKit/.test(navigator.userAgent) && !/Chrom(e|ium)|Edg\//.test(navigator.userAgent);
export const GL_ATTRS = Object.freeze({ antialias: Q.has('aa') ? Q.get('aa') === '1' : WEBKIT, alpha: true, depth: false, stencil: false, powerPreference: 'high-performance' });
