// The opening of the reader that the visitor's display receives, for what has nothing of its own in the room.
import * as THREE from 'three';
import { CY, GOLD } from '../kit.js';

const SANS = '"Helvetica Neue", "Segoe UI", Roboto, Arial, sans-serif';
const ACT = [0.3, 1.5];

function labelTex(a, b) {
  const cv = Object.assign(document.createElement('canvas'), { width: 1024, height: 64 }), c = cv.getContext('2d');
  c.fillStyle = '#000'; c.fillRect(0, 0, 1024, 64); c.font = `500 22px ${SANS}`; if ('letterSpacing' in c) c.letterSpacing = '7px'; c.textBaseline = 'middle';
  const skip = c.measureText(b).width + (b ? 30 : 0);
  c.fillStyle = '#0f0'; c.fillText(b, 0, 33); c.fillStyle = '#f00'; c.fillText(a, skip, 33);
  const t = new THREE.CanvasTexture(cv); t.anisotropy = 4; t.userData.skip = skip / 2; return t;
}

export function createReceive({ panel, light, ramp, ease, text, uSize, uPhone, uOpen, uFrom, uReveal, uHead }) {
  const uGot = { value: 0 }, uK = { value: 0 }, tex = labelTex(text.receiving ?? '', (text.mark ?? '').toUpperCase()), uSkip = { value: tex.userData.skip };
  const flow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), light(`uniform sampler2D tLabel; uniform vec2 uSize; uniform float uGot, uK, uOpen, uFrom, uReveal, uHead, uPhone, uSkip; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1)))*43758.5453); }
    void main(){
      float lo = uFrom*(1.0 - uOpen); if (vUv.y < lo || vUv.y > lo + uOpen) discard;
      vec2 p = vec2(vUv.x, 1.0 - vUv.y)*uSize;
      float head = 1.0 - smoothstep(0.0, 0.1, uReveal);
      vec2 q = p - vec2(mix(22.0, 14.0, uPhone), uHead*0.5 - 16.0), l = (q + vec2(uSkip*uPhone, 0.0))/vec2(512.0, 32.0);
      vec3 ink = q.x > 0.0 && l.x < 1.0 && l.y > 0.0 && l.y < 1.0 ? texture2D(tLabel, vec2(l.x, 1.0 - l.y), -0.5).rgb : vec3(0.0);
      ink.g *= 1.0 - uPhone;
      float to = uSize.x*uGot, busy = step(0.001, uGot)*(1.0 - step(0.999, uGot));
      float rule = 1.0 - smoothstep(0.5, 1.4, abs(p.y - uHead)), tip = exp(-pow((p.x - to)/7.0, 2.0))*(1.0 - smoothstep(1.0, 5.0, abs(p.y - uHead)))*busy;
      float m = clamp(uSize.x*0.05, 16.0, 56.0), col = min(uSize.x - 2.0*m, 700.0), x = p.x - (uSize.x - col)*0.5;
      float top = uHead + 44.0, lead = 26.0, row = floor((p.y - top)/lead), rows = max(1.0, floor((uSize.y - top - 34.0)/lead));
      float band = step(0.0, row)*step(row, rows - 1.0)*(1.0 - smoothstep(1.2, 2.2, abs(mod(p.y - top, lead) - lead*0.5)))*step(0.14, hash(vec2(row, 3.0)));
      float len = mix(0.42, 1.0, hash(vec2(row, 7.0)))*col, got = clamp(uGot*rows - row, 0.0, 1.0);
      float words = band*step(0.22, hash(vec2(floor(x/11.0), row)))*step(0.0, x)*step(x, len*got);
      float front = band*exp(-pow((x - len*got)/8.0, 2.0))*step(0.001, got)*(1.0 - step(0.999, got));
      float left = step(uReveal*uSize.y, p.y);
      vec3 c = (${GOLD}*ink.g*1.2 + vec3(0.62, 0.93, 1.0)*ink.r*1.15 + ${CY}*(rule*(0.08 + 0.9*step(p.x, to)) + tip*1.8))*head
             + ${CY}*(words*0.17 + front*1.3)*left;
      gl_FragColor = vec4(c*uK, 1.0);
    }`, { tLabel: { value: tex }, uSize, uPhone, uSkip, uGot, uK, uOpen, uFrom, uReveal, uHead }, { depthTest: false }));
  flow.name = 'ReadFlow'; flow.renderOrder = 9; flow.visible = false; flow.position.z = 0.0005; panel.add(flow);
  return {
    asks: false, waits: true, word: null, from: 0.5,
    ACT, UNFOLD: [0, 0.45], REVEAL: [1.5, 2.3],
    lay() {},
    update({ on, T }) {
      uGot.value = on ? ramp(T, ACT) : 0; ease(uK, on && T < 2.3 ? 1 : 0, 0.25);
      flow.visible = uK.value > 0.01;
    },
    dispose() { tex.dispose(); flow.geometry.dispose(); flow.material.dispose(); },
  };
}
