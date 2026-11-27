// The floor mirror: its camera and render target, the part of the target that the floors cover, and its render pass.
import * as THREE from 'three';
import { uPx, uMirror } from './kit.js';
import { reflectEye } from './reflections.js';
import type { Room } from './types.ts';

export interface Mirror {
  cam: THREE.PerspectiveCamera;
  vp: THREE.Matrix4;
  size: THREE.Vector2;
  pxPerRad: { value: number };
  minLod: { value: number };
  rt: THREE.WebGLRenderTarget;
}

export function createMirror(hdr: boolean): Mirror {
  return { cam: new THREE.PerspectiveCamera(), vp: new THREE.Matrix4(), size: new THREE.Vector2(4, 4), pxPerRad: { value: 500 }, minLod: { value: 0 },
    rt: new THREE.WebGLRenderTarget(4, 4, { type: hdr ? THREE.HalfFloatType : THREE.UnsignedByteType, generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, samples: 4, resolveDepthBuffer: false }) };
}

const floorBox = new THREE.Box3(), _c = new THREE.Vector4(), _d = new THREE.Vector4(), _n = new THREE.Vector2(), _lo = new THREE.Vector2(), _hi = new THREE.Vector2();

export function setFloors(floors: THREE.Object3D[]) {
  floorBox.makeEmpty(); for (const f of floors) floorBox.expandByObject(f);
}

function floorRect(mirror: Mirror, room: Room): [number, number, number, number] | null {
  const corner = (i: number, v: THREE.Vector4) => v.set(i & 1 ? floorBox.max.x : floorBox.min.x, i & 2 ? floorBox.max.y : floorBox.min.y, i & 4 ? floorBox.max.z : floorBox.min.z, 1).applyMatrix4(mirror.vp);
  const add = (v: THREE.Vector4) => { _n.set(v.x / v.w, v.y / v.w); _lo.min(_n); _hi.max(_n); }, W = 1e-3;
  _lo.set(1, 1); _hi.set(-1, -1);
  for (let i = 0; i < 8; i++) {
    if (corner(i, _c).w > W) add(_c);
    for (const b of [1, 2, 4]) if (!(i & b) && (corner(i, _c).w > W) !== (corner(i | b, _d).w > W)) add(_c.lerp(_d, (_c.w - W) / (_c.w - _d.w)));
  }
  _lo.clampScalar(-1, 1); _hi.clampScalar(-1, 1);
  if (_lo.x >= _hi.x || _lo.y >= _hi.y) return null;
  const a = ((room.info.floor.rough[0] + room.info.floor.rough[1]) / 2) ** 2, rv = 2 * a * mirror.pxPerRad.value;
  const pad = 5 * rv + 2 * 2 ** (Math.max(Math.log2(Math.max(rv / 4, 1)), mirror.minLod.value) + 3) + 8, { x: w, y: h } = mirror.size;
  const x0 = Math.max(0, Math.floor((_lo.x + 1) / 2 * w - pad)), y0 = Math.max(0, Math.floor((_lo.y + 1) / 2 * h - pad));
  return [x0, y0, Math.min(w, Math.ceil((_hi.x + 1) / 2 * w + pad)) - x0, Math.min(h, Math.ceil((_hi.y + 1) / 2 * h + pad)) - y0];
}

export function renderMirror(renderer: THREE.WebGLRenderer, mirror: Mirror, room: Room, camera: THREE.PerspectiveCamera) {
  const c = mirror.cam, dim = (list: THREE.Object3D[], on: boolean) => { for (const o of list) o.visible = on; };
  reflectEye(camera, c, 0, mirror.vp);
  const rect = floorRect(mirror, room); if (!rect) return;
  mirror.rt.scissor.set(...rect); mirror.rt.scissorTest = true;
  dim(room.floors, false); dim(room.hidden, false);
  const px = uPx.value; uPx.value = mirror.pxPerRad.value; uMirror.value = 1;
  renderer.setRenderTarget(mirror.rt); renderer.render(room.scene, c); uMirror.value = 0; uPx.value = px;
  dim(room.floors, true); dim(room.hidden, true);
}
