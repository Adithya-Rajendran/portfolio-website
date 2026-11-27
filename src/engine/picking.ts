// Picking: the pick under a point of the screen, the rectangle of a pick on the screen and the order of the tour.
import * as THREE from 'three';
import type { Pick, Rect } from './types.ts';

const PAD = 6, EDGE = 8, MOST = 0.6;
const _v = new THREE.Vector3(), ray = new THREE.Raycaster(), ndc = new THREE.Vector2();

export interface Hit {
  pick: Pick;
  hit: THREE.Intersection;
}

export function pickHit(picks: Pick[], camera: THREE.Camera, x: number, y: number, W: number, H: number): Hit | null {
  ndc.set((x / W) * 2 - 1, -(y / H) * 2 + 1); ray.setFromCamera(ndc, camera);
  const live = picks.filter((p) => !p.live || p.live()), of = (h: THREE.Intersection) => live.find((p) => p.mesh === h.object)!;
  const hits = ray.intersectObjects(live.map((p) => p.mesh), false), hit = hits.find((h) => of(h).reads) ?? hits[0];
  return hit ? { pick: of(hit), hit } : null;
}

function outline(pick: Pick): THREE.Vector3[] {
  if (pick.bounds) return pick.bounds();
  const g = pick.mesh.geometry; if (!g.boundingBox) g.computeBoundingBox();
  const { min, max } = g.boundingBox!;
  return Array.from({ length: 8 }, (_, i) => new THREE.Vector3(i & 1 ? max.x : min.x, i & 2 ? max.y : min.y, i & 4 ? max.z : min.z).applyMatrix4(pick.mesh.matrixWorld));
}

export function rectOf(pick: Pick, camera: THREE.PerspectiveCamera, W: number, H: number): Rect | null {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of outline(pick)) {
    _v.copy(p).applyMatrix4(camera.matrixWorldInverse); if (_v.z > -camera.near) return null;
    _v.applyMatrix4(camera.projectionMatrix);
    const x = (_v.x + 1) / 2 * W, y = (1 - _v.y) / 2 * H;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  x0 = Math.max(EDGE, x0 - PAD); y0 = Math.max(EDGE, y0 - PAD); x1 = Math.min(W - EDGE, x1 + PAD); y1 = Math.min(H - EDGE, y1 + PAD);
  if (x1 - x0 < 2 || y1 - y0 < 2 || (x1 - x0) * (y1 - y0) > MOST * W * H) return null;
  return toRect(x0, y0, x1 - x0, y1 - y0);
}

export function toRect(x: number, y: number, width: number, height: number): Rect {
  return { left: x, top: y, right: x + width, bottom: y + height, x, y, width, height };
}

export function tourOrder(picks: Pick[], cam: THREE.Vector3): Pick[] {
  const box = new THREE.Box3(), c = new THREE.Vector3(), azimuth = (p: Pick) => { box.setFromObject(p.mesh).getCenter(c); return Math.atan2(c.x - cam.x, cam.z - c.z); };
  return [...picks.filter((p) => p.station != null).sort((a, b) => a.station! - b.station!),
    ...picks.filter((p) => !p.aside && p.station == null).map((p): [number, Pick] => [azimuth(p), p]).sort((a, b) => a[0] - b[0]).map((a) => a[1])];
}
