// Wall screens: real mission content drawn with Canvas 2D and shown as emissive panels.
// Each design reports a "key" for the current time; its canvas is only redrawn (and re-uploaded) when that changes.
import * as THREE from 'three';

export const DEPART = Date.now() + (3 * 3600 + 47 * 60 + 12) * 1000;       // Ark Aurora leaves in T-03:47:12
const pad = (n) => String(n).padStart(2, '0');
export function tminus() {
  const s = Math.max(0, Math.floor((DEPART - Date.now()) / 1000));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
}
const MESSAGES = [
  ['Come back with stories.', 'LAGOS'], ['Plant something green for us.', 'KYOTO'], ['Grandpa says: check the airlock twice.', 'REYKJAVÍK'],
  ['We will keep the lights on.', 'SÃO PAULO'], ['Name a mountain after her.', 'KATHMANDU'], ['You carry all of us. Travel well.', 'NAIROBI'],
  ['Class 4B is watching the launch!', 'AUCKLAND'], ['Find us a second home.', 'MUMBAI'], ['Proud of you. Always.', 'MONTRÉAL'],
  ['Send pictures of the new sky.', 'CAIRO'], ['Go gently. Come home if you can.', 'WARSAW'], ['Take the old songs with you.', 'ULAANBAATAR'],
];
const SANS = '"Helvetica Neue", "Segoe UI", Roboto, Arial, sans-serif', MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';
const CY = '#6fdcff', AMB = '#ffb057', DIM = '#4d7f95', FG = '#d9f3ff';
const W = 1024, H = 696, CYCLE = 7, FADE = 0.8;
const ls = (c, v) => { if ('letterSpacing' in c) c.letterSpacing = v; };

let FOOTER = 'ARCADIA STATION  ·  EMBARKATION HALL  ·  RING 04';
function frameUI(c, title, tag) {
  c.fillStyle = '#020c14'; c.fillRect(0, 0, W, H);
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(40,120,160,0.16)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.fillStyle = CY; c.fillRect(48, 44, 10, 34);
  c.font = `600 30px ${SANS}`; c.textBaseline = 'middle'; c.textAlign = 'left'; ls(c, '6px'); c.fillText(title, 76, 62);
  c.textAlign = 'right'; c.fillStyle = DIM; c.font = `500 20px ${SANS}`; c.fillText(tag, 976, 62);
  c.fillStyle = 'rgba(111,220,255,0.35)'; c.fillRect(48, 100, 928, 2);
  c.textAlign = 'left'; c.fillStyle = DIM; c.font = `500 18px ${SANS}`; c.fillText(FOOTER, 48, 656);
  ls(c, '0px');
}
function row(c, y, k, v, col = FG) {
  c.textAlign = 'left'; c.fillStyle = DIM; c.font = `500 22px ${SANS}`; ls(c, '3px'); c.fillText(k, 48, y);
  ls(c, '1px'); c.textAlign = 'right'; c.fillStyle = col; c.font = `500 30px ${SANS}`; c.fillText(v, 976, y);
  c.fillStyle = 'rgba(111,220,255,0.12)'; c.fillRect(48, y + 26, 928, 1);
}
const DESIGNS = [
  { key: (t) => Math.floor(t),                               // departure board: once a second
    draw(c, t) {
      frameUI(c, 'ARK AURORA  ·  DEPARTURE', 'FLIGHT 001');
      c.textAlign = 'left'; c.fillStyle = DIM; c.font = `500 22px ${SANS}`; c.fillText('T-MINUS', 48, 150);
      c.fillStyle = AMB; c.font = `300 150px ${MONO}`; c.fillText(tminus(), 40, 250);
      row(c, 372, 'DESTINATION', 'PROXIMA CENTAURI b'); row(c, 432, 'DISTANCE', '4.24 LIGHT-YEARS'); row(c, 492, 'CREW', '10,000 · 193 NATIONS');
      c.fillStyle = Math.floor(t) % 2 === 0 ? AMB : 'rgba(255,176,87,0.35)'; c.fillRect(48, 548, 18, 18);
      c.textAlign = 'left'; c.font = `600 30px ${SANS}`; ls(c, '4px'); c.fillText('NOW BOARDING  ·  GROUP C  ·  GATES 3 – 6', 84, 558); ls(c, '0px');
    } },
  { key: (t) => { const p = t % CYCLE; return p < FADE || p > CYCLE - FADE ? Math.floor(t * 10) : Math.floor(t); },   // smooth only while fading
    draw(c, t) {
      frameUI(c, 'MESSAGES FROM HOME', 'LIVE');
      const p = t % CYCLE, [msg, from] = MESSAGES[Math.floor(t / CYCLE) % MESSAGES.length];
      c.globalAlpha = Math.max(0, Math.min(1, p / FADE, (CYCLE - p) / FADE));
      c.fillStyle = FG; c.font = `300 62px ${SANS}`; c.textAlign = 'left';
      let line = '', y = 230;
      for (const w of msg.split(' ')) { if (c.measureText(line + w).width > 900) { c.fillText(line.trim(), 48, y); y += 78; line = ''; } line += w + ' '; }
      c.fillText(line.trim(), 48, y);
      c.fillStyle = AMB; c.font = `600 26px ${SANS}`; ls(c, '6px'); c.fillText('— ' + from, 48, y + 84); ls(c, '0px'); c.globalAlpha = 1;
      c.fillStyle = DIM; c.font = `500 22px ${SANS}`; c.fillText('RECEIVED TODAY', 48, 548);
      c.fillStyle = CY; c.font = `300 44px ${MONO}`; c.fillText((41_207_316 + Math.floor(t) * 37).toLocaleString('en-US'), 48, 596);
      c.textAlign = 'right'; c.fillStyle = DIM; c.font = `500 22px ${SANS}`; c.fillText('8.2 BILLION PEOPLE  ·  ONE CREW', 976, 596);
    } },
  { key: () => 0,                                            // manifest: static
    draw(c) {
      frameUI(c, 'WHAT WE CARRY', 'MANIFEST');
      row(c, 170, 'SEED VAULT', '1,204,000 SPECIES'); row(c, 240, 'GENOME ARCHIVE', '8.9 MILLION'); row(c, 310, 'LIBRARY', 'EVERY BOOK EVER SCANNED');
      row(c, 380, 'LANGUAGES', '7,164 · ALL OF THEM'); row(c, 450, 'CREW', '10,000 VOLUNTEERS', AMB);
      c.textAlign = 'left'; c.fillStyle = FG; c.font = `300 40px ${SANS}`; c.fillText('So that there is always a tomorrow.', 48, 556);
    } },
  { key: (t) => Math.floor(t / 3),                           // boarding roster: who is going
    draw(c, t) {
      frameUI(c, 'BOARDING  ·  GROUP C', 'GATE 04');
      const hi = Math.floor(t / 3) % ROSTER.length;
      c.font = `500 17px ${SANS}`; c.fillStyle = DIM; ls(c, '3px'); c.textAlign = 'left';
      c.fillText('NAME', 48, 132); c.fillText('FROM', 430, 132); c.fillText('ROLE', 610, 132); c.textAlign = 'right'; c.fillText('STATUS', 976, 132); ls(c, '0px');
      ROSTER.forEach(([name, from, role], i) => {
        const y = 178 + i * 58, state = i < hi ? 'ABOARD' : i === hi ? 'AT GATE' : 'CHECK-IN';
        if (i === hi) { c.fillStyle = 'rgba(255,176,87,0.12)'; c.fillRect(36, y - 26, 952, 52); }
        c.textAlign = 'left'; c.fillStyle = i === hi ? '#fff' : FG; c.font = `400 28px ${SANS}`; c.fillText(name, 48, y);
        c.fillStyle = DIM; c.font = `500 20px ${SANS}`; ls(c, '2px'); c.fillText(from, 430, y); c.fillText(role, 610, y);
        c.textAlign = 'right'; c.fillStyle = state === 'ABOARD' ? CY : state === 'AT GATE' ? AMB : DIM; c.fillText(state, 976, y); ls(c, '0px');
        c.fillStyle = 'rgba(111,220,255,0.1)'; c.fillRect(48, y + 28, 928, 1);
      });
      c.textAlign = 'left'; c.fillStyle = DIM; c.font = `500 20px ${SANS}`; c.fillText(`${(6214 + Math.floor(t / 3)).toLocaleString('en-US')} OF 10,000 ABOARD`, 48, 610);
    } },
  { key: (t) => Math.floor(t / 2),                           // the ship: readiness
    draw(c, t) {
      frameUI(c, 'ARK AURORA  ·  READINESS', 'ALL SYSTEMS');
      // side elevation of the ship: drive, spine, habitat rings, shield
      c.strokeStyle = CY; c.lineWidth = 2; c.beginPath();
      c.moveTo(70, 200); c.lineTo(150, 170); c.lineTo(150, 230); c.closePath();                       // drive bell
      c.moveTo(150, 200); c.lineTo(880, 200);                                                         // spine
      for (const x of [330, 470, 610]) { c.moveTo(x - 16, 140); c.lineTo(x + 16, 140); c.lineTo(x + 16, 260); c.lineTo(x - 16, 260); c.closePath(); }   // rings, edge-on
      c.moveTo(880, 150); c.quadraticCurveTo(960, 200, 880, 250); c.closePath();                      // shield
      for (const x of [210, 250, 740, 790]) { c.moveTo(x, 186); c.lineTo(x, 214); }
      c.stroke();
      c.fillStyle = DIM; c.font = `500 16px ${SANS}`; ls(c, '2px'); c.textAlign = 'center';
      c.fillText('DRIVE', 110, 262); c.fillText('HABITAT RINGS', 470, 292); c.fillText('SHIELD', 905, 282); c.fillText('1,480 m', 515, 180); ls(c, '0px');
      const cryo = Math.min(10000, 6214 + Math.floor(t / 3));
      [['FUSION DRIVE', 1, 'READY'], ['LIFE SUPPORT', 1, 'NOMINAL'], ['HYDROPONICS', 0.98, '98%'], ['WATER  ·  94 YEARS', 1, 'SEALED'],
       ['CREW ABOARD', cryo / 10000, cryo.toLocaleString('en-US')]].forEach(([k, v, label], i) => {
        const y = 346 + i * 56;
        c.textAlign = 'left'; c.fillStyle = DIM; c.font = `500 20px ${SANS}`; ls(c, '3px'); c.fillText(k, 48, y); ls(c, '0px');
        c.fillStyle = 'rgba(111,220,255,0.14)'; c.fillRect(360, y - 7, 440, 14);
        c.fillStyle = v < 1 ? AMB : CY; c.fillRect(360, y - 7, 440 * v, 14);
        c.textAlign = 'right'; c.fillStyle = FG; c.font = `500 24px ${SANS}`; c.fillText(label, 976, y);
      });
    } },
  { key: (t) => Math.floor(t),                               // the crossing: where they are going
    draw(c, t) {
      frameUI(c, 'THE CROSSING', 'SOL  →  PROXIMA');
      for (let i = 0; i < 90; i++) { const x = 48 + rnd(i, 1) * 928, y = 120 + rnd(i, 2) * 300, r = rnd(i, 3); c.fillStyle = `rgba(190,225,255,${0.15 + r * 0.5})`; c.fillRect(x, y, r > 0.85 ? 3 : 2, r > 0.85 ? 3 : 2); }
      const x0 = 130, x1 = 890, y = 270;
      c.setLineDash([6, 10]); c.strokeStyle = 'rgba(111,220,255,0.6)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.stroke(); c.setLineDash([]);
      c.fillStyle = '#ffe7b0'; c.beginPath(); c.arc(x0, y, 13, 0, 7); c.fill();
      c.fillStyle = '#ff8d6b'; c.beginPath(); c.arc(x1, y, 9, 0, 7); c.fill();
      c.strokeStyle = AMB; c.beginPath(); c.arc(x1, y, 20, 0, 7); c.stroke();
      const xm = x0 + 26 + (Math.floor(t) % 2) * 2; c.fillStyle = '#fff'; c.beginPath(); c.moveTo(xm + 14, y); c.lineTo(xm, y - 7); c.lineTo(xm, y + 7); c.fill();
      c.textAlign = 'center'; c.fillStyle = FG; c.font = `500 22px ${SANS}`; ls(c, '4px'); c.fillText('SOL', x0, y + 48); c.fillText('PROXIMA CENTAURI b', x1 - 60, y + 48);
      c.fillStyle = DIM; c.font = `500 17px ${SANS}`; c.fillText('HOME', x0, y + 76); c.fillText('NEW HOME', x1 - 60, y + 76); ls(c, '0px');
      row(c, 440, 'DISTANCE', '4.24 LIGHT-YEARS  ·  40 TRILLION KM'); row(c, 500, 'CRUISE SPEED', '4.5% OF LIGHT'); row(c, 560, 'ARRIVAL', 'IN 94 YEARS  ·  FOUR GENERATIONS', AMB);
    } },
];
const ROSTER = [['Amara Okafor', 'LAGOS', 'AGRONOMIST'], ['Kenji Watanabe', 'OSAKA', 'REACTOR ENG.'], ['Sofía Ramírez', 'BOGOTÁ', 'PAEDIATRICIAN'],
  ['Arjun Mehta', 'PUNE', 'TEACHER'], ['Ingrid Solberg', 'TROMSØ', 'NAVIGATOR'], ['Tāne Parata', 'ROTORUA', 'HYDROLOGIST'], ['Leila Haddad', 'BEIRUT', 'ARCHIVIST']];
const rnd = (i, k) => { const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return v - Math.floor(v); };

// Placards for the other rooms. All copy below is placeholder text until the real content is filled in.
const placard = (tag, no, title, meta, l1, l2, cta) => ({ key: () => 0,
  draw(c) {
    frameUI(c, tag + (no ? ' ' + no : ''), ROOM_TAG);
    c.textAlign = 'left'; let y = 210;
    if (no) { c.fillStyle = AMB; c.font = `200 150px ${SANS}`; c.fillText(no, 44, y); y += 130; } else y = 200;
    c.fillStyle = FG; c.font = `300 64px ${SANS}`; c.fillText(title, 48, y);
    c.fillStyle = DIM; c.font = `500 22px ${SANS}`; ls(c, '4px'); c.fillText(meta, 48, y + 60); ls(c, '0px');
    c.fillStyle = 'rgba(111,220,255,0.3)'; c.fillRect(48, y + 100, 928, 1);
    c.fillStyle = FG; c.font = `300 30px ${SANS}`; c.fillText(l1, 48, y + 150);
    c.fillStyle = DIM; c.fillText(l2, 48, y + 200);
    if (cta) { c.fillStyle = CY; c.font = `600 22px ${SANS}`; ls(c, '4px'); c.fillText(cta, 48, 606); ls(c, '0px'); }
  } });
let ROOM_TAG = '';
const ROOMS = {
  lobby: { footer: 'ARCADIA STATION  ·  EMBARKATION HALL  ·  RING 04', tag: '', designs: DESIGNS },
  projects: { footer: 'ARCADIA STATION  ·  FABRICATION BAY 02', tag: 'BAY 02',
    designs: ['ONE', 'TWO', 'THREE', 'FOUR'].map((n, i) => placard('PROJECT', '0' + (i + 1), 'PROJECT ' + n, 'ROLE  ·  YEAR', 'One line on what it is and why it mattered.', 'What I built  ·  what it took  ·  what came of it', 'SELECT TO OPEN  →')) },
  about: { footer: 'ARCADIA STATION  ·  OBSERVATION LOUNGE', tag: 'LOUNGE',
    designs: [placard('ABOUT', '', 'A short introduction', 'NAME  ·  WHAT I DO  ·  WHERE', 'Two or three sentences in your own voice.', 'What you care about, and what you are looking for.', ''),
              placard('CURRENTLY', '', 'What I am working on', 'UPDATED  ·  DATE', 'The thing on the desk right now.', 'Reading  ·  building  ·  learning', '')] },
  experience: { footer: 'ARCADIA STATION  ·  NAVIGATION', tag: 'ROUTE LOG',
    designs: [4, 3, 2, 1].map((n) => placard('STATION', '0' + n, 'ROLE  ·  ORGANISATION', 'FROM  –  TO  ·  PLACE', 'What you were responsible for.', 'The outcome you would point to first.', '')) },
};

export function createScreens({ room = 'lobby', VERT, DIST, uMirror, anisotropy, gain = 0.9 }) {
  const cfg = ROOMS[room] || ROOMS.lobby; FOOTER = cfg.footer; ROOM_TAG = cfg.tag;
  const items = cfg.designs.map((d) => {
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.flipY = false; tex.anisotropy = anisotropy;
    return { ...d, ctx: cv.getContext('2d'), tex, last: null };
  });
  const materials = items.map((it) => new THREE.ShaderMaterial({
    uniforms: { map: { value: it.tex }, uMirror, uGain: { value: gain } }, vertexShader: VERT,
    fragmentShader: `uniform sampler2D map; uniform float uMirror, uGain; varying vec2 vUv; varying vec3 vW;
      void main(){
        vec3 c = texture2D(map, vUv).rgb;
        c *= 0.9 + 0.1*sin(vUv.y*${H}.0*3.14159);                       // pixel rows
        c += vec3(0.004, 0.012, 0.02);                                  // a panel never goes fully black
        gl_FragColor = vec4(c*uGain, 1.0); ${DIST}
      }`,
  }));
  function update() {
    const t = performance.now() / 1000;
    for (const it of items) { const k = it.key(t); if (k !== it.last) { it.last = k; it.draw(it.ctx, t); it.tex.needsUpdate = true; } }
  }
  update();
  return { material: (i) => materials[i % materials.length], update };
}
