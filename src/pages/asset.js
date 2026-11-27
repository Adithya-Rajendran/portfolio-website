// The asset bench: one live-drawn asset alone under a plain studio light.
import * as THREE from 'three';
import { setDistanceScale, uTime, V } from '../engine/kit.js';
import { createDrone } from '../engine/drone.js';
import { loadSite } from '../content/load.js';
import { params } from '../engine/dev.js';

const Q = params(), num = (k, d) => (Q.has(k) ? parseFloat(Q.get(k)) : d);
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('scene'), antialias: true });
renderer.setPixelRatio(1); renderer.setSize(innerWidth, innerHeight); renderer.toneMapping = THREE.AgXToneMapping; renderer.toneMappingExposure = num('exp', 1.1);
setDistanceScale(1);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x15171b);
const studio = new THREE.Scene(), panel = (w, h, col, pos) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide })); m.position.copy(pos); m.lookAt(0, 0, 0); studio.add(m); };
studio.background = new THREE.Color(0.05, 0.05, 0.06); panel(3, 3, new THREE.Color(5, 3.6, 2.4), V(0, 4, 1)); panel(2.5, 4, new THREE.Color(2.2, 3.0, 4.2), V(-4, 1, -2)); panel(4, 2, new THREE.Color(0.8, 0.7, 0.6), V(3, 0.5, 3));
const env = new THREE.PMREMGenerator(renderer).fromScene(studio, 0.03).texture;
const volumes = (await loadSite()).posts;
const drone = createDrone({ scene, dock: V(0, 0, 0), deliver: V(0, 0, 0), slots: [V(3, 0, 0)], volumes }); drone.setEnv(env);
if (Q.has('book')) drone.debug(num('book', 0), Q.get('open') === '1');
const a = num('a', 30) * Math.PI / 180, e = num('e', 15) * Math.PI / 180, d = num('d', 1.3), tgt = V(0, num('ty', -0.1), 0);
const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.02, 50);
camera.position.set(Math.sin(a) * Math.cos(e) * d, Math.sin(e) * d, Math.cos(a) * Math.cos(e) * d).add(tgt); camera.lookAt(tgt);
let t = 0; const lift = Q.get('fly') === '1';
if (lift) drone.root.position.y = 0;
renderer.setAnimationLoop(() => { t += 1 / 60; uTime.value = t; drone.update(t); renderer.render(scene, camera); });
window.__lobby = { ready: () => (t > 4 ? 1 : 0.5), mode: () => ({ asset: 'drone' }) };
