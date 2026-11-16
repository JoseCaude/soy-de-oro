'use strict';
// ¡SOY DE ORO! — cliente: render, interpolación, entrada y sonido
const cv = document.getElementById('game'), ctx = cv.getContext('2d');
const VW = 960, VH = 540, FLOOR = 318;
const FONT = 'Bangers, Impact, sans-serif';
const $ = id => document.getElementById(id);

let myId = null, joined = false, muted = false, K = 1;
const snaps = [], parts = [], toasts = [];
let T = 0, shake = 0, flashScr = 0, windFx = 0, scen = 0, scenSpeed = 0, doorOpen = 0;

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.random() * a.length | 0];
const posmod = (a, n) => ((a % n) + n) % n;
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = c => clamp(c + amt, 0, 255);
  return '#' + ((1 << 24) | (f(n >> 16) << 16) | (f((n >> 8) & 255) << 8) | f(n & 255)).toString(16).slice(1);
}

// ------------------------------------------------------------------ pantalla
function fit() {
  const s = Math.min(innerWidth / VW, innerHeight / VH);
  K = s * (window.devicePixelRatio || 1);
  cv.width = Math.round(VW * K); cv.height = Math.round(VH * K);
  cv.style.width = VW * s + 'px'; cv.style.height = VH * s + 'px';
}
addEventListener('resize', fit); fit();

// ------------------------------------------------------------------ red
let ws;
function connect() {
  ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
  ws.onopen = () => { $('status').textContent = ''; };
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.t === 's') {
      snaps.push({ tm: performance.now(), s: m });
      if (snaps.length > 40) snaps.shift();
      handleEvents(m.ev);
    } else if (m.t === 'welcome') { myId = m.id; joined = true; $('join').classList.add('hidden'); }
    else if (m.t === 'full') { alert('El tranvía va lleno (8 jugadores). Espera a la siguiente parada.'); }
  };
  ws.onclose = () => {
    $('status').textContent = 'Sin conexión con el tranvía… reintentando';
    myId = null; joined = false; $('join').classList.remove('hidden');
    setTimeout(connect, 1500);
  };
}
connect();

function join() {
  ac();
  if (matchMedia('(pointer: coarse)').matches) {
    try { const el = document.documentElement; (el.requestFullscreen || el.webkitRequestFullscreen).call(el).then(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {}); } catch (e) {}
  }
  const n = $('name').value.trim() || 'Zeus Jr.';
  try { localStorage.setItem('sdo-name', n); } catch (e) {}
  if (ws && ws.readyState === 1) ws.send(JSON.stringify({ t: 'join', n }));
}
$('go').onclick = join;
$('name').addEventListener('keydown', e => { if (e.key === 'Enter') join(); e.stopPropagation(); });
try { $('name').value = localStorage.getItem('sdo-name') || ''; } catch (e) {}
fetch('/info').then(r => r.json()).then(i => {
  const local = ['localhost', '127.0.0.1', '::1'].includes(location.hostname);
  $('url').textContent = local && i.ips.length ? `http://${i.ips[0]}:${i.port}` : location.origin;
}).catch(() => {});

// ------------------------------------------------------------------ entrada
const KEYMAP = { ArrowUp: 1, KeyW: 1, ArrowDown: 2, KeyS: 2, ArrowLeft: 4, KeyA: 4, ArrowRight: 8, KeyD: 8,
  KeyJ: 16, KeyZ: 16, KeyK: 32, KeyX: 32, Space: 32, KeyL: 64, KeyC: 64 };
const keys = {};
let pressAcc = 0, touchMask = 0, padMask = 0, lastMask = -1, padPrev = 0;
addEventListener('keydown', e => {
  if (e.code === 'KeyM') { muted = !muted; toast(muted ? 'Sonido apagado' : 'Sonido encendido'); }
  const b = KEYMAP[e.code];
  if (!b || !joined) return;
  e.preventDefault();
  if (!keys[e.code]) { keys[e.code] = true; if (b >= 16) pressAcc |= b; }
});
addEventListener('keyup', e => { if (KEYMAP[e.code]) keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

if (matchMedia('(pointer: coarse)').matches) $('touch').classList.add('on');
document.querySelectorAll('#touch .tb').forEach(el => {
  const b = +el.dataset.b;
  const on = e => { e.preventDefault(); ac(); touchMask |= b; if (b >= 16) pressAcc |= b; el.classList.add('act'); };
  const off = e => { e.preventDefault(); touchMask &= ~b; el.classList.remove('act'); };
  el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off);
  el.addEventListener('pointercancel', off); el.addEventListener('pointerleave', off);
});

// joystick virtual (móvil): toca en la mitad izquierda y arrastra
let stickId = null, sx0 = 0, sy0 = 0, stickMask = 0;
const stick = $('stick'), knob = $('knob');
function stickSet(dx, dy) {
  const d = Math.hypot(dx, dy), m = 46, k = d > m ? m / d : 1;
  knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
  stickMask = 0;
  if (d > 14) {
    const a = Math.atan2(dy, dx);
    if (Math.cos(a) > .38) stickMask |= 8; if (Math.cos(a) < -.38) stickMask |= 4;
    if (Math.sin(a) > .38) stickMask |= 2; if (Math.sin(a) < -.38) stickMask |= 1;
  }
}
stick.addEventListener('pointerdown', e => {
  e.preventDefault(); ac(); stickId = e.pointerId; stick.setPointerCapture(e.pointerId);
  const r = stick.getBoundingClientRect(); sx0 = e.clientX; sy0 = e.clientY;
  knob.style.left = (e.clientX - r.left) + 'px'; knob.style.top = (e.clientY - r.top) + 'px'; stickSet(0, 0);
});
stick.addEventListener('pointermove', e => { if (e.pointerId === stickId) stickSet(e.clientX - sx0, e.clientY - sy0); });
const stickEnd = e => { if (e.pointerId !== stickId) return; stickId = null; stickSet(0, 0); knob.style.left = '90px'; knob.style.top = 'calc(100% - 90px)'; };
stick.addEventListener('pointerup', stickEnd); stick.addEventListener('pointercancel', stickEnd);
document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });

function pollPad() {
  padMask = 0;
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const gp = [...pads].find(p => p);
  if (!gp) return;
  const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0, B = i => gp.buttons[i] && gp.buttons[i].pressed;
  if (ay < -0.4 || B(12)) padMask |= 1; if (ay > 0.4 || B(13)) padMask |= 2;
  if (ax < -0.4 || B(14)) padMask |= 4; if (ax > 0.4 || B(15)) padMask |= 8;
  if (B(2)) padMask |= 16; if (B(0)) padMask |= 32; if (B(1) || B(3)) padMask |= 64;
  pressAcc |= padMask & ~padPrev & 112;
  padPrev = padMask;
}
function sendInput() {
  if (!joined || !ws || ws.readyState !== 1) return;
  let m = touchMask | padMask | stickMask;
  for (const c in keys) if (keys[c]) m |= KEYMAP[c];
  if (m !== lastMask || pressAcc) {
    ws.send(JSON.stringify({ t: 'in', k: m, p: pressAcc }));
    lastMask = m; pressAcc = 0;
  }
}

// ------------------------------------------------------------------ sonido (sintetizado)
let AC = null, noiseBuf = null;
function ac() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  if (AC && AC.state === 'suspended') AC.resume();
  return AC;
}
function tone(f, d, type = 'square', v = 0.06, slide = 0, delay = 0) {
  const a = AC; if (!a || muted) return;
  const t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.linearRampToValueAtTime(Math.max(30, f + slide), t + d);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + d + 0.02);
}
function noise(d, v = 0.15, freq = 1200, delay = 0) {
  const a = AC; if (!a || muted) return;
  if (!noiseBuf) { noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate); const ch = noiseBuf.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1; }
  const t = a.currentTime + delay, s = a.createBufferSource(), fl = a.createBiquadFilter(), g = a.createGain();
  s.buffer = noiseBuf; fl.type = 'lowpass'; fl.frequency.value = freq;
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
  s.connect(fl).connect(g).connect(a.destination); s.start(t); s.stop(t + d + 0.05);
}
const sfx = {
  hit: b => { noise(b ? 0.18 : 0.09, b ? 0.35 : 0.22, b ? 900 : 2200); tone(b ? 90 : 150, 0.1, 'square', 0.07, -50); },
  hurt: () => tone(220, 0.18, 'sawtooth', 0.07, -120),
  swing: () => noise(0.07, 0.05, 3000),
  jump: () => tone(260, 0.14, 'square', 0.035, 260),
  pick: () => { tone(660, 0.08, 'square', 0.05); tone(990, 0.12, 'square', 0.05, 0, 0.08); },
  gold: () => [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.2, 'triangle', 0.09, 0, i * 0.07)),
  door: () => { tone(784, 0.35, 'sine', 0.1); tone(587, 0.55, 'sine', 0.1, 0, 0.3); },
  foam: () => noise(0.45, 0.12, 1500),
  wind: () => noise(1.8, 0.14, 450),
  slam: () => { noise(0.3, 0.4, 300); tone(60, 0.3, 'sine', 0.2, -30); },
  ko: () => tone(400, 0.6, 'square', 0.06, -350),
};

// ------------------------------------------------------------------ partículas y eventos
function burst(x, y, z, col, n) {
  for (let i = 0; i < n; i++) { const a = rnd(0, Math.PI * 2), s = rnd(80, 260); parts.push({ t: 'dot', x, y, z, vx: Math.cos(a) * s, vy: 0, vz: Math.sin(a) * s, life: rnd(.25, .45), max: .45, col, sz: rnd(2, 4) }); }
  parts.push({ t: 'star', x, y, z, life: .18, max: .18, col });
}
function addText(x, y, z, text, col, sz) { parts.push({ t: 'text', x, y, z, vz: 70, life: .9, max: .9, text, col, sz }); }
function toast(msg) { toasts.push({ msg, t: 4 }); if (toasts.length > 4) toasts.shift(); }

function handleEvents(evs) {
  for (const e of evs || []) switch (e.e) {
    case 'hit':
      burst(e.x, e.y, e.z, e.big ? '#fff59d' : '#ffffff', e.big ? 14 : 8);
      addText(e.x, e.y, e.z + 12, e.big ? pick(['¡POW!', '¡CRASH!', '¡ZASCA!', '¡TOMA!', '¡CATAPUM!']) : String(e.d), e.big ? '#ffeb3b' : '#ffffff', e.big ? 30 : 18);
      sfx.hit(e.big); if (e.big) shake = Math.max(shake, .15); break;
    case 'hurt': burst(e.x, e.y, e.z, '#ff5252', 10); addText(e.x, e.y, e.z + 10, '-' + e.d, '#ff8a80', 18); sfx.hurt(); break;
    case 'foam':
      for (let i = 0; i < 38; i++) parts.push({ t: 'foam', x: e.x + e.f * 92, y: e.y + rnd(-6, 6), z: 66 + rnd(-4, 4), vx: e.f * rnd(150, 430), vy: rnd(-40, 40), vz: rnd(-30, 110), life: rnd(.35, .6), max: .6, sz: rnd(4, 9) });
      sfx.foam(); break;
    case 'gold':
      parts.push({ t: 'ring', x: e.x, y: e.y, z: 40, life: .6, max: .6 });
      for (let i = 0; i < 50; i++) { const a = rnd(0, Math.PI * 2), s = rnd(100, 380); parts.push({ t: 'dot', x: e.x, y: e.y, z: 50, vx: Math.cos(a) * s, vy: 0, vz: Math.sin(a) * s, life: rnd(.5, .9), max: .9, col: pick(['#ffd54f', '#fff59d', '#ffb300']), sz: rnd(2, 5) }); }
      addText(e.x, e.y, 120, '¡DE ORO!', '#ffd54f', 40);
      sfx.gold(); shake = .3; flashScr = .35; break;
    case 'pick': sfx.pick(); addText(e.x, e.y, 40, e.ty === 'gold' ? '+ORO' : '+30 VIDA', e.ty === 'gold' ? '#ffd54f' : '#9cff57', 20); break;
    case 'jump': sfx.jump(); break;
    case 'swing': sfx.swing(); break;
    case 'door': sfx.door(); break;
    case 'wind': sfx.wind(); windFx = 1.9; break;
    case 'slam': shake = .35; burst(e.x, e.y, 5, '#cfd8dc', 16); sfx.slam(); break;
    case 'bossdown': sfx.gold(); shake = .6; flashScr = .5; break;
    case 'ko': sfx.ko(); break;
    case 'mount': sfx.pick(); break;
    case 'join': toast('🍺 ' + e.n + ' se ha subido al tranvía'); break;
  }
}

function updParts(dt, cam) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life -= dt;
    if (p.life <= 0) { parts.splice(i, 1); continue; }
    if (p.t === 'dot' || p.t === 'foam') { p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vz -= 600 * dt; if (p.z < 0) { p.z = 0; p.vz *= -.3; p.vx *= .6; } }
    if (p.t === 'text') { p.z += p.vz * dt; p.vz *= .94; }
    if (p.t === 'spark') { p.z += 20 * dt; }
    const sx = p.x - cam, sy = FLOOR + p.y - p.z, a = p.life / p.max;
    ctx.globalAlpha = Math.min(1, a * 1.5);
    if (p.t === 'dot') { ctx.fillStyle = p.col; ctx.fillRect(sx - p.sz / 2, sy - p.sz / 2, p.sz, p.sz); }
    else if (p.t === 'foam') { ctx.fillStyle = '#fffdf2'; ctx.beginPath(); ctx.arc(sx, sy, p.sz * (1.6 - a * .6), 0, 7); ctx.fill(); }
    else if (p.t === 'spark') { star(sx, sy, 4 * a + 1, '#fff8c4'); }
    else if (p.t === 'star') { star(sx, sy, 26 * (1 - a) + 10, p.col); }
    else if (p.t === 'ring') { ctx.strokeStyle = '#ffd54f'; ctx.lineWidth = 8 * a; ctx.beginPath(); ctx.ellipse(sx, FLOOR + p.y - 10, 340 * (1 - a) + 10, 120 * (1 - a) + 4, 0, 0, 7); ctx.stroke(); }
    else if (p.t === 'text') {
      ctx.font = `${p.sz}px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = '#000';
      ctx.strokeText(p.text, sx, sy); ctx.fillStyle = p.col; ctx.fillText(p.text, sx, sy);
    }
  }
  ctx.globalAlpha = 1;
}
function star(x, y, r, col) {
  ctx.fillStyle = col; ctx.beginPath();
  for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, rr = i % 2 ? r * .4 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill();
}

// ------------------------------------------------------------------ interpolación
function renderState(now) {
  if (!snaps.length) return null;
  const rt = now - 70;
  let a = snaps[snaps.length - 1], b = a;
  for (let i = snaps.length - 1; i > 0; i--) if (snaps[i - 1].tm <= rt) { a = snaps[i - 1]; b = snaps[i]; break; }
  const span = b.tm - a.tm, k = span > 0 ? clamp((rt - a.tm) / span, 0, 1) : 1;
  const L = (la, lb) => {
    const ma = new Map(la.map(o => [o.i, o]));
    return lb.map(o => { const p = ma.get(o.i); if (!p) return o; return { ...o, x: p.x + (o.x - p.x) * k, y: p.y + (o.y - p.y) * k, z: p.z + (o.z - p.z) * k }; });
  };
  const S = b.s;
  return { ...S, cam: a.s.cam + (S.cam - a.s.cam) * k, P: L(a.s.P, S.P), E: L(a.s.E, S.E), M: L(a.s.M, S.M) };
}

// ------------------------------------------------------------------ primitivas de dibujo
function rr(x, y, w, h, r, col, stroke = true) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fillStyle = col; ctx.fill(); if (stroke) ctx.stroke();
}
function circ(x, y, r, col, stroke = true) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill(); if (stroke) ctx.stroke(); }
function limb(x, y, len, w, ang, col, cb) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  rr(-w / 2, -w * .3, w, len + w * .3, w / 2, col);
  if (cb) { ctx.translate(0, len); cb(); }
  ctx.restore();
}
function shadow(x, y, r) { ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(x, y, r, r * .3, 0, 0, Math.PI * 2); ctx.fill(); }

// Aspecto de cada tipo (h = altura, w = anchura)
const PV = { h: 1.05, w: 1.1, skin: '#e9a77a', shirt: '#f4f4f4', tank: 1, pants: '#e53935', hair: '#3e2723', hat: 'laurel', nose: 1, chain: 1, acc: 'beer', belly: 1, drunk: 1, stain: 1 };
const VIS = {
  nino:       { h: .62, w: .85, skin: '#f1c27d', shirt: '#ff7043', pants: '#3949ab', hair: '#4e342e', hat: 'cap', hatC: '#fdd835', acc: 'backpack' },
  abuela:     { h: .82, w: 1,   skin: '#f0c8a0', shirt: '#8e5aa8', pants: '#5d4037', hair: '#cfd8dc', bun: 1, acc: 'cart', glasses: 1, skirt: 1 },
  revisor:    { h: 1,   w: 1,   skin: '#e0ac69', shirt: '#1f2a6b', pants: '#121a45', hair: '#212121', hat: 'peak', hatC: '#1f2a6b', acc: 'machine', badge: 1 },
  turista:    { h: 1.08, w: .95, skin: '#ffcdb2', shirt: '#26c6da', flowers: 1, pants: '#f5deb3', hair: '#ffe082', hat: 'sun', hatC: '#fff3c4', acc: 'selfie' },
  patinete:   { h: 1,   w: .95, skin: '#c68642', shirt: '#263238', pants: '#546e7a', hair: '#111111', hat: 'helmet', hatC: '#76ff03', acc: 'scooter' },
  cachas:     { h: 1.22, w: 1.35, skin: '#d79b6b', shirt: '#e53935', tank: 1, pants: '#263238', hair: null, bigArms: 1 },
  baturro:    { h: 1.04, w: 1.05, skin: '#e8b88a', shirt: '#fafafa', vest: '#212121', sash: '#c62828', pants: '#212121', hair: '#3e2723', hat: 'cachirulo' },
  repartidor: { h: .95, w: .95, skin: '#a1665e', shirt: '#00bfa5', pants: '#37474f', hair: '#1b1b1b', hat: 'cap', hatC: '#00bfa5', acc: 'box' },
  cierzo:     { h: 1.65, w: 1.6, skin: '#b3e5fc', shirt: '#e1f5fe', pants: '#81d4fa', hair: null, cloud: 1, boss: 1 },
};

function drawPerson(v, x, y, z, f, s, st, o = {}) {
  const S = v.h, Wd = v.w;
  let C = { skin: v.skin, shirt: v.shirt, pants: v.pants, hair: v.hair || '#000', hat: v.hatC || '#333', vest: v.vest, sash: v.sash, bottle: '#2e7d32' };
  if (o.gold) C = { skin: '#ffd54f', shirt: '#ffe57f', pants: '#ffb300', hair: '#ff8f00', hat: '#ffca28', vest: '#ffa000', sash: '#ffc107', bottle: '#ffca28' };
  if (o.flash) for (const k in C) C[k] = '#ffffff';
  ctx.save();
  ctx.translate(x, y - z);
  ctx.globalAlpha = o.alpha ?? 1;
  ctx.scale(f, 1);
  ctx.lineWidth = 2; ctx.strokeStyle = '#1c140c'; ctx.lineJoin = 'round';
  if (o.gold) { ctx.shadowColor = 'rgba(255,200,40,.95)'; ctx.shadowBlur = 20; }

  const seed = o.seed || 0, wt = T * 11 + seed;
  let legF = 0, legB = 0, armF = .25, armB = -.2, rot = 0, bob = 0, hip = -36;
  switch (s) {
    case 'walk': legF = Math.sin(wt) * .55; legB = -legF; armF = -Math.sin(wt) * .55; armB = -armF; bob = Math.abs(Math.cos(wt)) * 2;
      if (v.acc === 'scooter') { legF = .1; legB = -.1; armF = -1.1; armB = -1; bob = 0; } break;
    case 'idle': armF = .2 + Math.sin(T * 3 + seed) * .08; rot = Math.sin(T * 2 + seed) * (v.drunk ? .09 : .03); break;
    case 'attack':
      if (o.combo === 3) { const k = Math.min(1, st / .12); armF = -2.9 + k * 2.1; rot = .12 * k; }
      else if (o.charge) { armF = -1.3; armB = -1.2; rot = .25; legF = Math.sin(T * 20) * .6; legB = -legF; }
      else { armF = -1.55; armB = .5; rot = .08; }
      break;
    case 'windup': armF = .9; armB = .6; rot = -.12; break;
    case 'jump': legF = -.7; legB = .5; armF = -2.2; armB = -2.6; if (o.air) { legF = -1.45; legB = .3; armF = -.6; rot = -.15; } break;
    case 'hurt': rot = -.28; armF = -2.4; armB = -2; break;
    case 'getup': hip = -24; legF = -1.1; legB = .9; armF = -.6; rot = .3; break;
    case 'special': armF = -2.95; armB = -2.95; legF = .25; legB = -.25; break;
    case 'ride': legF = -.9; legB = .6; armF = -1.2; armB = -.9; break;
    case 'blow': rot = st < .4 ? -st * .6 : .3; armF = -1.9; armB = -1.3; break;
  }
  if (s === 'down') { ctx.translate(0, -9 * S); ctx.rotate(-Math.PI / 2); armF = -2.6; armB = -2.8; legF = .1; legB = -.1; }
  else { ctx.translate(0, -bob); ctx.rotate(rot); }

  const hy = hip * S, shY = hy - 30 * S, headR = 11 * Math.pow(S, .6) * (v.boss ? 1.2 : 1), headY = shY - headR - 2 * S;
  const tw = 12 * Wd * S, legW = 9 * Wd * S, armW = 8 * S * (v.bigArms ? 1.9 : 1) * (v.boss ? 1.4 : 1);
  const armCol = v.tank ? C.skin : C.shirt;

  // detrás
  if (v.acc === 'scooter') {
    ctx.strokeStyle = '#1c140c';
    rr(-20 * S, -6, 50 * S, 5, 2, '#37474f'); circ(-14 * S, 0, 4, '#111'); circ(26 * S, 0, 4, '#111');
    ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(26 * S, -5); ctx.lineTo(30 * S, shY + 6 * S); ctx.lineTo(22 * S, shY + 6 * S); ctx.stroke(); ctx.lineWidth = 2;
  }
  if (v.acc === 'backpack') rr(-tw - 9 * S, shY + 2 * S, 11 * S, 24 * S, 4, '#43a047');
  if (v.acc === 'box') { rr(-tw - 26 * S, shY - 10 * S, 30 * S, 34 * S, 3, '#00bfa5'); ctx.fillStyle = '#004d40'; ctx.fillRect(-tw - 20 * S, shY + 2 * S, 18 * S, 4 * S); }

  limb(-3 * Wd * S, hy, -hy, legW, legB, shade(C.pants, -28));
  limb(0, shY + 4 * S, 28 * S, armW, armB, shade(armCol, -25));
  limb(3 * Wd * S, hy, -hy, legW, legF, C.pants);
  // zapatos
  if (s !== 'down' && v.acc !== 'scooter' && s !== 'ride') { ctx.fillStyle = '#2b1d12'; }

  // torso
  rr(-tw, shY - 2 * S, tw * 2, hy - shY + 6 * S, 6 * S, C.shirt);
  if (v.belly) { ctx.beginPath(); ctx.ellipse(tw * .45, hy - 10 * S, tw * .75, 11 * S, 0, 0, 7); ctx.fillStyle = C.shirt; ctx.fill(); ctx.stroke(); }
  if (v.stain && !o.gold) { ctx.fillStyle = 'rgba(190,140,40,.55)'; ctx.beginPath(); ctx.ellipse(tw * .3, hy - 16 * S, 5 * S, 4 * S, .4, 0, 7); ctx.fill(); }
  if (v.flowers && !o.flash) { ctx.fillStyle = o.gold ? '#fff8e1' : '#ff4081'; for (let i = 0; i < 6; i++) ctx.fillRect(-tw + 3 + (i * 7 % (tw * 2 - 6)), shY + 4 + (i * 9 % 22) * S, 4, 4); }
  if (v.vest) { ctx.fillStyle = C.vest; ctx.fillRect(-tw, shY - 1, tw * .9, hy - shY + 3); ctx.fillRect(tw * .35, shY - 1, tw * .65, hy - shY + 3); }
  if (v.sash) { rr(-tw - 1, hy - 7 * S, tw * 2 + 2, 8 * S, 2, C.sash); }
  if (v.skirt) { ctx.beginPath(); ctx.moveTo(-tw, hy - 4 * S); ctx.lineTo(tw, hy - 4 * S); ctx.lineTo(tw + 5 * S, hy + 16 * S); ctx.lineTo(-tw - 5 * S, hy + 16 * S); ctx.closePath(); ctx.fillStyle = C.pants; ctx.fill(); ctx.stroke(); }
  if (v.badge) circ(tw * .5, shY + 8 * S, 3 * S, '#ffd54f', false);
  if (v.chain) { ctx.strokeStyle = '#ffc400'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(2 * S, shY - 2 * S, 8 * S, .3, Math.PI - .3); ctx.stroke(); circ(2 * S, shY + 7 * S, 2.5, '#ffc400', false); ctx.strokeStyle = '#1c140c'; ctx.lineWidth = 2; }

  // cabeza
  const hx = 2 * S;
  if (v.bun) circ(hx - headR * .8, headY - headR * .6, headR * .55, C.hair);
  circ(hx, headY, headR, C.skin);
  if (v.hair) { ctx.beginPath(); ctx.arc(hx, headY, headR, Math.PI * 1.05, Math.PI * 1.95); ctx.lineTo(hx - headR * .9, headY - 1); ctx.closePath(); ctx.fillStyle = C.hair; ctx.fill(); ctx.stroke(); }
  if (v.cloud) {
    ctx.fillStyle = o.flash ? '#fff' : '#ffffff';
    for (let i = 0; i < 7; i++) { const a = Math.PI + i * Math.PI / 6; circ(hx + Math.cos(a) * headR * 1.05, headY + Math.sin(a) * headR * 1.05, headR * .45, '#fafdff'); }
    for (let i = 0; i < 4; i++) circ(hx - headR * .6 + i * headR * .45, headY + headR * .95, headR * .4, '#fafdff');
  }
  // cara
  const ko = s === 'down' || s === 'hurt';
  ctx.fillStyle = '#111';
  if (ko) { ctx.font = `bold ${7 * S + 3}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText('x', hx + headR * .5, headY + 1); }
  else if (v.drunk) { ctx.fillRect(hx + headR * .3, headY - 2, 5 * S, 1.8); ctx.fillRect(hx + headR * .3, headY - 5, 5 * S, 1.2); }
  else ctx.fillRect(hx + headR * .4, headY - 3, 2.6 * S + 1, 2.6 * S + 1);
  if (v.nose) circ(hx + headR * .95, headY + 1, 3 * S, o.gold ? '#ff8f00' : '#e53935', false);
  if (v.glasses) { ctx.strokeStyle = '#111'; ctx.beginPath(); ctx.arc(hx + headR * .5, headY - 2, 3.2, 0, 7); ctx.stroke(); ctx.strokeStyle = '#1c140c'; }
  if (v.boss && s === 'blow') circ(hx + headR * .85, headY + headR * .35, headR * .3, '#283593', false);
  else if (v.boss) { ctx.fillStyle = '#283593'; ctx.fillRect(hx + headR * .4, headY + headR * .4, headR * .5, 2.5); }
  if (v.drunk && !ko) { ctx.strokeStyle = '#5d2a14'; ctx.beginPath(); ctx.arc(hx + headR * .55, headY + 4 * S, 3 * S, .2, 2.4); ctx.stroke(); ctx.strokeStyle = '#1c140c'; }

  // sombreros
  switch (v.hat) {
    case 'laurel':
      for (let i = 0; i < 7; i++) { const a = Math.PI * 1.05 + i * Math.PI * .15; ctx.save(); ctx.translate(hx + Math.cos(a) * headR, headY + Math.sin(a) * headR); ctx.rotate(a + Math.PI / 2); ctx.beginPath(); ctx.ellipse(0, 0, 2.6 * S, 5.5 * S, 0, 0, 7); ctx.fillStyle = o.gold ? '#fff59d' : (i % 2 ? '#43a047' : '#66bb6a'); ctx.fill(); ctx.restore(); }
      if (o.band) { ctx.fillStyle = o.band; ctx.fillRect(hx - headR, headY - 2, headR * .7, 3); }
      break;
    case 'cap': ctx.beginPath(); ctx.arc(hx, headY - 1, headR, Math.PI, 0); ctx.closePath(); ctx.fillStyle = C.hat; ctx.fill(); ctx.stroke(); rr(hx, headY - 3, headR * 1.3, 3.5, 2, C.hat); break;
    case 'peak': rr(hx - headR, headY - headR - 4 * S, headR * 2.1, headR * .9, 2, C.hat); rr(hx + headR * .5, headY - headR * .35, headR * .9, 3, 1, '#111'); circ(hx + headR * .3, headY - headR - 0 * S, 2, '#ffd54f', false); break;
    case 'sun': ctx.beginPath(); ctx.ellipse(hx, headY - headR * .6, headR * 1.9, headR * .38, 0, 0, 7); ctx.fillStyle = C.hat; ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.arc(hx, headY - headR * .6, headR * .85, Math.PI, 0); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#e53935'; ctx.fillRect(hx - headR * .85, headY - headR * .8, headR * 1.7, 2.5); break;
    case 'helmet': ctx.beginPath(); ctx.arc(hx, headY - 1, headR * 1.12, Math.PI * 1.02, -.05); ctx.closePath(); ctx.fillStyle = C.hat; ctx.fill(); ctx.stroke(); break;
    case 'cachirulo': {
      ctx.beginPath(); ctx.arc(hx, headY - 1, headR * 1.04, Math.PI * 1.02, -.02); ctx.closePath(); ctx.fillStyle = o.gold ? C.hat : '#c62828'; ctx.fill(); ctx.stroke();
      if (!o.gold) { ctx.fillStyle = '#111'; for (let i = -2; i <= 2; i++) for (let j = 1; j <= 2; j++) ctx.fillRect(hx + i * headR * .38 - 1.5, headY - j * headR * .42 - 1, 3, 3); }
      rr(hx - headR * 1.25, headY - headR * .5, headR * .45, headR * .6, 2, o.gold ? C.hat : '#c62828'); break;
    }
  }

  // brazo delantero con objeto en mano
  limb(0, shY + 4 * S, 28 * S, armW, armF, armCol, () => {
    circ(0, 0, armW * .55, C.skin);
    if (v.acc === 'beer') { rr(-2, 0, 4, 8, 1, C.bottle); rr(-4.5, 6, 9, 17, 3, C.bottle); ctx.fillStyle = o.gold ? '#fff8e1' : '#fff3d6'; ctx.fillRect(-4, 11, 8, 5); }
    else if (v.acc === 'machine') rr(-5, -1, 10, 9, 2, '#90a4ae');
    else if (v.acc === 'selfie') {
      const L = (s === 'attack' || s === 'windup') ? 74 : 16;
      ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, L); ctx.stroke(); ctx.lineWidth = 2;
      rr(-6, L, 12, 8, 2, '#111'); ctx.fillStyle = '#80deea'; ctx.fillRect(-4, L + 2, 8, 4);
    }
  });
  if (v.acc === 'cart') {
    const cx = (s === 'attack' ? 22 : 16) * S;
    ctx.beginPath(); ctx.moveTo(cx, -30 * S); ctx.lineTo(8 * S, shY + 18 * S); ctx.stroke();
    rr(cx, -34 * S, 26 * S, 28 * S, 4, o.gold ? '#ffc107' : '#b71c1c');
    ctx.strokeStyle = 'rgba(0,0,0,.45)'; for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(cx + i * 6.5 * S, -34 * S); ctx.lineTo(cx + i * 6.5 * S, -6 * S); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx, -34 * S + i * 7 * S); ctx.lineTo(cx + 26 * S, -34 * S + i * 7 * S); ctx.stroke(); }
    ctx.strokeStyle = '#1c140c'; circ(cx + 6 * S, -3, 4, '#222'); circ(cx + 20 * S, -3, 4, '#222');
  }
  if (v.boss) { // remolinos de viento
    ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) { const a = T * 3 + i * 2.1; ctx.beginPath(); ctx.arc(Math.cos(a) * 34 * S, shY + 20 * S + Math.sin(a) * 18 * S, 10, a, a + 3.5); ctx.stroke(); }
  }
  ctx.restore();
}

function drawBottleMount(x, y, z, f, walking, spray, gold) {
  ctx.save(); ctx.translate(x, y - z); ctx.scale(f * 1.35, 1.35);
  ctx.lineWidth = 2; ctx.strokeStyle = '#1c140c';
  if (gold) { ctx.shadowColor = 'rgba(255,200,40,.9)'; ctx.shadowBlur = 18; }
  const glass = gold ? '#ffc107' : '#8a531a';
  [-32, -14, 8, 24].forEach((lx, i) => limb(lx, -17, 15, 7, walking ? Math.sin(T * 14 + i * 1.6) * .55 : 0, shade(glass, -35)));
  rr(-52, -52, 80, 38, 17, glass);
  ctx.beginPath(); ctx.moveTo(24, -50); ctx.quadraticCurveTo(42, -48, 47, -39); ctx.lineTo(66, -38); ctx.lineTo(66, -27); ctx.lineTo(47, -26);
  ctx.quadraticCurveTo(42, -17, 24, -16); ctx.closePath(); ctx.fillStyle = glass; ctx.fill(); ctx.stroke();
  rr(65, -40, 7, 15, 2, '#d4a017');
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.fillRect(-42, -47, 58, 5);
  rr(-32, -47, 38, 27, 3, '#fff3d6');
  ctx.fillStyle = '#b71c1c'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('BIRRA', -13, -36);
  ctx.fillStyle = '#ffc400'; ctx.beginPath(); ctx.moveTo(-10, -33); ctx.lineTo(-17, -26); ctx.lineTo(-12, -26); ctx.lineTo(-16, -21); ctx.lineTo(-8, -28); ctx.lineTo(-13, -28); ctx.closePath(); ctx.fill();
  circ(35, -40, 6, '#fff'); circ(37, -40, 2.6, '#000', false);
  ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(28, -49); ctx.lineTo(41, -45); ctx.stroke();
  if (spray) for (let i = 0; i < 5; i++) circ(76 + i * 6, -33 + Math.sin(T * 30 + i) * 4, 6 - i * .6, '#fffdf2', false);
  ctx.restore();
}

// ------------------------------------------------------------------ entidades
function headTop(ent, h, rideZ) { return FLOOR + ent.y - ent.z - rideZ - 96 * h; }

function drawPlayerEnt(p, cam, rideZ = 0) {
  const sx = p.x - cam, sy = FLOOR + p.y, gold = p.gt > 0;
  if (!rideZ) shadow(sx, sy, Math.max(12, 26 - p.z / 10));
  let alpha = 1;
  if (p.iv && p.s !== 'down' && !gold) alpha = (Math.floor(T * 18) % 2) ? .45 : 1;
  if (gold && Math.random() < .6) parts.push({ t: 'spark', x: p.x + rnd(-22, 22), y: p.y, z: p.z + rideZ + rnd(5, 100), life: .4, max: .4 });
  drawPerson({ ...PV, pants: p.c }, sx, sy, p.z + rideZ, p.f, rideZ ? 'ride' : p.s, p.st,
    { gold, alpha, combo: p.cb, air: p.ak, seed: p.i, flash: p.s === 'hurt' && p.st < .08, band: p.c });
  const ty = headTop(p, 1.05, rideZ) - 4;
  ctx.font = 'bold 12px "Trebuchet MS", sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#000';
  const label = p.i === myId ? '▼ ' + p.n : p.n;
  ctx.strokeText(label, sx, ty); ctx.fillStyle = p.i === myId ? '#ffe57f' : p.c; ctx.fillText(label, sx, ty);
}

function drawEnemyEnt(e, cam, rideZ = 0) {
  const v = VIS[e.ty], sx = e.x - cam, sy = FLOOR + e.y;
  if (!rideZ) shadow(sx, sy, 24 * v.w);
  let alpha = 1;
  if (e.d && e.st > .9) alpha = (Math.floor(T * 20) % 2) ? .2 : .8;
  const charge = e.ty === 'abuela' || e.ty === 'patinete';
  drawPerson(v, sx, sy, e.z + rideZ, e.f, rideZ ? 'ride' : e.s, e.st, { alpha, seed: e.i, flash: e.fl || (e.s === 'hurt' && e.st < .08), charge });
  if (!e.d && e.hp < e.mh && e.ty !== 'cierzo' && e.ty !== 'repartidor') {
    const w = 34, ty = headTop(e, v.h, rideZ) - 2;
    ctx.fillStyle = '#000'; ctx.fillRect(sx - w / 2 - 1, ty - 1, w + 2, 6);
    ctx.fillStyle = '#ff5252'; ctx.fillRect(sx - w / 2, ty, w * e.hp / e.mh, 4);
  }
}

function drawItem(it, cam) {
  const x = it.x - cam, y = FLOOR + it.y, gold = it.ty === 'gold', bob = Math.abs(Math.sin(T * 4 + it.i)) * 4;
  shadow(x, y, 10);
  ctx.save(); ctx.translate(x, y - 2 - bob); ctx.lineWidth = 2; ctx.strokeStyle = '#1c140c';
  if (gold) {
    const g = ctx.createRadialGradient(0, -16, 2, 0, -16, 30); g.addColorStop(0, 'rgba(255,220,80,.8)'); g.addColorStop(1, 'rgba(255,220,80,0)');
    ctx.fillStyle = g; ctx.fillRect(-30, -46, 60, 60);
  }
  const col = gold ? '#ffca28' : '#2e7d32';
  rr(-6, -22, 12, 22, 4, col); rr(-2.5, -32, 5, 11, 2, col); rr(-3, -35, 6, 4, 1, gold ? '#fff59d' : '#d4a017');
  ctx.fillStyle = gold ? '#fff8e1' : '#fff3d6'; ctx.fillRect(-5, -16, 10, 7);
  ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(-4, -20, 2, 16);
  if (gold && Math.floor(T * 4 + it.i) % 2) star(7, -30, 5, '#fffde7');
  ctx.restore();
}

function drawMountEnt(m, rider, cam) {
  const sx = m.x - cam, sy = FLOOR + m.y;
  shadow(sx, sy, 64);
  const gold = rider && m.rk === 'p' && rider.gt > 0;
  drawBottleMount(sx, sy, m.z, m.f, m.mv, m.s === 'spray', gold);
  if (rider) {
    const r = { ...rider, x: m.x - m.f * 10, y: m.y, z: m.z };
    if (m.rk === 'p') drawPlayerEnt(r, cam, 32); else drawEnemyEnt(r, cam, 32);
  }
}

function drawBubble(text, x, y) {
  ctx.font = 'bold 14px "Trebuchet MS", sans-serif';
  const w = ctx.measureText(text).width + 18, bx = clamp(x - w / 2, 4, VW - w - 4), by = Math.max(4, y - 34);
  ctx.lineWidth = 2; ctx.strokeStyle = '#1c140c';
  ctx.beginPath(); ctx.moveTo(clamp(x - 6, bx + 8, bx + w - 16), by + 22); ctx.lineTo(clamp(x, bx + 10, bx + w - 10), by + 34); ctx.lineTo(clamp(x + 6, bx + 14, bx + w - 8), by + 22); ctx.fillStyle = '#fff'; ctx.fill(); ctx.stroke();
  rr(bx, by, w, 24, 10, '#fff');
  ctx.fillStyle = '#fff'; ctx.fillRect(clamp(x - 5, bx + 8, bx + w - 16), by + 20, 12, 4);
  ctx.fillStyle = '#1c140c'; ctx.textAlign = 'center'; ctx.fillText(text, bx + w / 2, by + 17);
}

// ------------------------------------------------------------------ escenario
const BCOL = ['#2c2638', '#352c3a', '#2a2a40', '#3a3040', '#30283a', '#262438'];
function drawPilar(x, b) {
  const fl = ctx.createRadialGradient(x + 118, b - 40, 20, x + 118, b - 40, 190); fl.addColorStop(0, 'rgba(255,190,90,.35)'); fl.addColorStop(1, 'rgba(255,190,90,0)');
  ctx.fillStyle = fl; ctx.fillRect(x - 80, b - 200, 400, 210);
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(80,50,20,.5)';
  ctx.fillStyle = '#e8b56a'; ctx.fillRect(x, b - 50, 236, 50);
  ctx.fillStyle = '#a8712f'; for (let i = 0; i < 9; i++) ctx.fillRect(x + 10 + i * 25, b - 38, 8, 16);
  for (const tx of [x - 6, x + 226]) {
    ctx.fillStyle = '#e0a95c'; ctx.fillRect(tx, b - 126, 16, 126);
    ctx.fillStyle = '#b48c5c'; ctx.fillRect(tx + 4, b - 110, 8, 12); ctx.fillRect(tx + 4, b - 80, 8, 12);
    ctx.fillStyle = '#2f7d62'; ctx.beginPath(); ctx.moveTo(tx - 2, b - 126); ctx.lineTo(tx + 8, b - 150); ctx.lineTo(tx + 18, b - 126); ctx.fill();
  }
  const dome = (cx, r) => {
    ctx.fillStyle = '#2f7d62'; ctx.beginPath(); ctx.arc(cx, b - 50, r, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = '#f2c94c'; ctx.lineWidth = 2;
    for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(cx, b - 50 - r); ctx.quadraticCurveTo(cx - r + i * r / 2 - r * .1, b - 50 - r * .5, cx - r + i * r / 2, b - 50); ctx.stroke(); }
    ctx.fillStyle = '#e8d9b5'; ctx.fillRect(cx - 2, b - 50 - r - 8, 4, 8);
  };
  dome(x + 118, 32); dome(x + 50, 17); dome(x + 186, 17); dome(x + 84, 11); dome(x + 152, 11);
}

function drawScenery(cam) {
  const ox = scen + cam * .55;
  const g = ctx.createLinearGradient(0, 70, 0, 215); g.addColorStop(0, '#060b24'); g.addColorStop(.7, '#1a2350'); g.addColorStop(1, '#3a2f55');
  ctx.fillStyle = g; ctx.fillRect(0, 70, VW, FLOOR - 70);
  for (let j = 0; j < 90; j++) { const sx = posmod(hash(j) * 1400 - ox * .03, VW), sy = 74 + hash(j * 9) * 110; ctx.globalAlpha = .4 + .6 * Math.abs(Math.sin(T * (1 + hash(j * 4) * 3) + j)); ctx.fillStyle = '#fff'; ctx.fillRect(sx, sy, 1.6, 1.6); }
  ctx.globalAlpha = 1;
  const mx = posmod(780 - ox * .02, VW + 160) - 80;
  const mg = ctx.createRadialGradient(mx, 104, 8, mx, 104, 60); mg.addColorStop(0, 'rgba(255,250,220,.35)'); mg.addColorStop(1, 'rgba(255,250,220,0)');
  ctx.fillStyle = mg; ctx.fillRect(mx - 60, 44, 120, 120);
  circ(mx, 104, 16, '#fff8dc', false); circ(mx - 6, 99, 3.5, 'rgba(0,0,0,.08)', false); circ(mx + 5, 109, 2.5, 'rgba(0,0,0,.08)', false);
  ctx.fillStyle = 'rgba(40,40,70,.7)';
  for (let j = 0; j < 4; j++) { const cx = posmod(j * 300 - ox * .08, VW + 200) - 100; ctx.beginPath(); ctx.ellipse(cx, 100 + j * 9, 46, 8, 0, 0, 7); ctx.fill(); }
  const fo = ox * .35, bw = 120, j0 = Math.floor(fo / bw) - 2;
  for (let j = j0; j < j0 + VW / bw + 4; j++) {
    const bx = j * bw - fo, k = posmod(j, 11);
    if (k === 5) { drawPilar(bx, 207); continue; }
    if (k === 6) continue;
    const h = 45 + hash(j) * 85;
    ctx.fillStyle = BCOL[Math.floor(hash(j * 3) * BCOL.length)]; ctx.fillRect(bx + 4, 207 - h, bw - 8, h);
    let wi = 0;
    for (let wy = 207 - h + 8; wy < 195; wy += 16) for (let wx = bx + 12; wx < bx + bw - 16; wx += 18) { const hv = hash(j * 31 + wi++); ctx.fillStyle = hv < .45 ? '#ffd27a' : hv < .55 ? '#9fd3ff' : 'rgba(0,0,0,.35)'; ctx.fillRect(wx, wy, 8, 9); }
  }
  const no = ox, sp = 170, n0 = Math.floor(no / sp) - 1;
  for (let j = n0; j < n0 + VW / sp + 3; j++) {
    const x = j * sp - no + hash(j * 5) * 60;
    if (hash(j * 7) < .65) {
      ctx.fillStyle = '#2a1d18'; ctx.fillRect(x - 3, 160, 6, 50);
      for (const [dx, dy, r] of [[0, 150, 22], [-16, 162, 16], [16, 160, 17]]) circ(x + dx, dy, r, hash(j) < .5 ? '#1f3d2a' : '#183222', false);
    } else { ctx.fillStyle = '#455a64'; ctx.fillRect(x - 2, 120, 4, 90); ctx.fillRect(x - 2, 120, 18, 3); ctx.fillStyle = '#fff59d'; ctx.fillRect(x + 12, 123, 6, 4);
      const lg = ctx.createRadialGradient(x + 15, 126, 2, x + 15, 150, 80); lg.addColorStop(0, 'rgba(255,220,120,.55)'); lg.addColorStop(1, 'rgba(255,220,120,0)');
      ctx.fillStyle = lg; ctx.beginPath(); ctx.moveTo(x + 12, 126); ctx.lineTo(x - 30, 215); ctx.lineTo(x + 60, 215); ctx.closePath(); ctx.fill(); }
  }
  ctx.strokeStyle = '#37474f'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, 86); ctx.lineTo(VW, 86); ctx.stroke();
  ctx.fillStyle = '#3d3f4a'; ctx.fillRect(0, 207, VW, FLOOR - 207);
  ctx.fillStyle = '#5c5f6b'; ctx.fillRect(0, 207, VW, 4);
  ctx.fillStyle = '#b39b2a'; ctx.fillRect(0, 216, VW, 6);
}

function segType(i) { const k = posmod(i, 12); return k === 9 ? 'art' : k === 3 ? 'door' : 'win'; }

function drawBackground(cam, S) {
  ctx.fillStyle = '#aeb4bc'; ctx.fillRect(0, 0, VW, 62);
  ctx.fillStyle = '#fbfbf2'; ctx.fillRect(0, 8, VW, 8);
  ctx.fillStyle = 'rgba(255,255,230,.35)'; ctx.fillRect(0, 16, VW, 6);
  ctx.fillStyle = '#cfd2d6'; ctx.fillRect(0, 62, VW, FLOOR - 62);
  const seg = 200, i0 = Math.floor(cam / seg) - 1, i1 = Math.floor((cam + VW) / seg) + 1;

  ctx.save(); ctx.beginPath();
  for (let i = i0; i <= i1; i++) {
    const x = i * seg - cam, t = segType(i);
    if (t === 'win') ctx.rect(x + 14, 78, seg - 28, 132);
    else if (t === 'door') ctx.rect(x + 30, 74, seg - 60, FLOOR - 74);
  }
  ctx.clip(); drawScenery(cam); ctx.restore();

  ctx.lineWidth = 2; ctx.strokeStyle = '#1c140c';
  for (let i = i0; i <= i1; i++) {
    const x = i * seg - cam, t = segType(i);
    if (t === 'win') {
      ctx.strokeStyle = '#8d969e'; ctx.lineWidth = 6; ctx.strokeRect(x + 14, 78, seg - 28, 132); ctx.lineWidth = 2;
      ctx.fillStyle = 'rgba(200,220,255,.08)'; ctx.beginPath(); ctx.moveTo(x + 30, 80); ctx.lineTo(x + 70, 80); ctx.lineTo(x + 30, 150); ctx.fill();
      ctx.strokeStyle = '#1c140c';
      for (const s0 of [26, 110]) {
        rr(x + s0, 226, 62, 50, 9, '#b71c1c'); ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.fillRect(x + s0 + 6, 232, 50, 6);
        rr(x + s0 - 3, 272, 68, 16, 6, '#8e0000');
        ctx.fillStyle = '#5d636a'; ctx.fillRect(x + s0 + 28, 288, 6, FLOOR - 288);
      }
      rr(x + seg - 9, 150, 8, 12, 2, '#d32f2f');
    } else if (t === 'door') {
      const o = doorOpen * 62;
      const panel = (px, w) => {
        ctx.fillStyle = '#a5adb5'; ctx.fillRect(px, 74, w, 12); ctx.fillRect(px, 74, 8, FLOOR - 74); ctx.fillRect(px + w - 8, 74, 8, FLOOR - 74);
        ctx.fillRect(px, 226, w, FLOOR - 226); ctx.strokeRect(px, 74, w, FLOOR - 74);
      };
      ctx.save(); ctx.beginPath(); ctx.rect(x + 30, 70, seg - 60, FLOOR - 66); ctx.clip();
      panel(x + 30 - o, 70); panel(x + 100 + o, 70);
      ctx.fillStyle = '#fbc02d'; ctx.fillRect(x + 94 - o, 74, 6, FLOOR - 74); ctx.fillRect(x + 100 + o, 74, 6, FLOOR - 74);
      circ(x + 124 + o, 250, 6, doorOpen > .5 ? '#43a047' : '#e53935');
      ctx.restore();
      ctx.fillStyle = '#d5dade'; ctx.fillRect(x, 62, 30, FLOOR - 62); ctx.fillRect(x + seg - 30, 62, 30, FLOOR - 62);
      ctx.fillStyle = '#5d636a'; ctx.fillRect(x + 30, 66, seg - 60, 8);
      ctx.fillStyle = '#fdd835'; ctx.fillRect(x + 30, FLOOR - 2, seg - 60, 5);
    } else {
      ctx.fillStyle = '#7b8189'; ctx.fillRect(x + 20, 62, seg - 40, FLOOR - 62);
      ctx.fillStyle = '#5e646b'; for (let k = 0; k < 14; k++) ctx.fillRect(x + 24 + k * 11.5, 62, 5, FLOOR - 62);
    }
  }
  // barra y asideros
  ctx.fillStyle = '#9ea4aa'; ctx.fillRect(0, 63, VW, 4);
  const sway = .05 + scenSpeed / 260 * .2;
  ctx.strokeStyle = '#eceff1'; ctx.lineWidth = 3;
  for (let i = Math.floor(cam / 70) - 1; i < Math.floor((cam + VW) / 70) + 2; i++) {
    const x = i * 70 - cam, a = Math.sin(T * 2.4 + i) * sway;
    const ex = x + Math.sin(a) * 26, ey = 67 + Math.cos(a) * 26;
    ctx.beginPath(); ctx.moveTo(x, 67); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.beginPath(); ctx.arc(ex, ey + 6, 6, 0, 7); ctx.stroke();
  }
  // pantallas LED
  const txt = (S.ph === 'travel' ? 'Próxima parada: ' : 'Parada: ') + S.nx + '   ·   Vuelta ' + S.lap + '   ·   No olvide validar su billete   ·   ';
  ctx.font = 'bold 14px "Courier New", monospace';
  const tw = ctx.measureText(txt).width;
  for (let i = Math.floor(cam / 600) - 1; i < Math.floor((cam + VW) / 600) + 2; i++) {
    const x = i * 600 + 300 - cam;
    ctx.fillStyle = '#111'; ctx.fillRect(x - 110, 24, 220, 26); ctx.strokeStyle = '#555'; ctx.lineWidth = 2; ctx.strokeRect(x - 110, 24, 220, 26);
    ctx.save(); ctx.beginPath(); ctx.rect(x - 106, 26, 212, 22); ctx.clip();
    ctx.fillStyle = '#ffa726'; ctx.textAlign = 'left'; const off = (T * 70) % tw;
    ctx.fillText(txt, x - 106 - off, 42); ctx.fillText(txt, x - 106 - off + tw, 42);
    ctx.restore();
  }
  // barras verticales del fondo
  for (let i = Math.floor(cam / 400) - 1; i < Math.floor((cam + VW) / 400) + 2; i++) {
    const x = i * 400 + 100 - cam;
    ctx.fillStyle = '#f9a825'; ctx.fillRect(x - 4, 66, 8, FLOOR - 54);
    ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fillRect(x - 2, 66, 2, FLOOR - 54);
  }
  // suelo
  const fg = ctx.createLinearGradient(0, FLOOR, 0, VH); fg.addColorStop(0, '#6c717a'); fg.addColorStop(1, '#33363c');
  ctx.fillStyle = fg; ctx.fillRect(0, FLOOR, VW, VH - FLOOR);
  ctx.fillStyle = '#5d636a'; ctx.fillRect(0, FLOOR - 4, VW, 7);
  ctx.fillStyle = '#f9a825'; ctx.fillRect(0, FLOOR + 9, VW, 3);
  ctx.fillStyle = 'rgba(0,0,0,.16)';
  for (let r = 0; r < 7; r++) {
    const yy = FLOOR + 26 + r * 24, sp = 34 + r * 3, off = posmod(cam * (1 + r * .04), sp);
    for (let xx = -off; xx < VW; xx += sp) { ctx.beginPath(); ctx.arc(xx, yy, 2 + r * .3, 0, 7); ctx.fill(); }
  }
  ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 2;
  for (let i = Math.floor(cam / 200) - 2; i < Math.floor((cam + VW) / 200) + 3; i++) {
    const x0 = i * 200 - cam, x1 = x0 + (x0 - VW / 2) * .3;
    ctx.beginPath(); ctx.moveTo(x0, FLOOR + 12); ctx.lineTo(x1, VH); ctx.stroke();
    if (segType(i) === 'art') { ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(x0 + 100, FLOOR + 95, 95, 70, 0, 0, 7); ctx.stroke(); ctx.strokeStyle = 'rgba(0,0,0,.18)'; }
  }
}

function drawFrontPoles(cam) {
  const fc = cam * 1.3;
  for (let k = Math.floor((fc - 200) / 1100); k < Math.floor((fc + VW + 200) / 1100) + 1; k++) {
    const x = k * 1100 + 520 - fc;
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(x + 6, VH - 6, 20, 5, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#f9a825'; ctx.fillRect(x - 8, 0, 16, VH);
    ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(x - 4, 0, 3, VH);
    ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(x + 4, 0, 4, VH);
  }
}

// ------------------------------------------------------------------ HUD
function goldIcon(x, y, full) {
  ctx.lineWidth = 1.5; ctx.strokeStyle = '#1c140c';
  ctx.globalAlpha = full ? 1 : .3;
  rr(x - 4, y + 6, 8, 13, 3, full ? '#ffca28' : '#666'); rr(x - 1.8, y, 3.6, 7, 1, full ? '#ffca28' : '#666');
  ctx.globalAlpha = 1;
}
function bigText(text, x, y, size, col, stroke = '#000') {
  ctx.font = `${size}px ${FONT}`; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
  ctx.lineWidth = size / 6; ctx.strokeStyle = stroke; ctx.strokeText(text, x, y);
  ctx.fillStyle = col; ctx.fillText(text, x, y);
}
function drawHUD(S) {
  ctx.fillStyle = 'rgba(12,9,5,.82)'; ctx.fillRect(0, VH - 50, VW, 50);
  ctx.fillStyle = '#ffcf3a'; ctx.fillRect(0, VH - 51, VW, 2);
  const n = Math.max(1, S.P.length), w = Math.min(238, (VW - 12) / n);
  S.P.forEach((p, i) => {
    const x = 6 + i * w, y = VH - 46;
    if (p.i === myId) { ctx.strokeStyle = '#ffcf3a'; ctx.lineWidth = 2; ctx.strokeRect(x, y - 1, w - 6, 44); }
    ctx.font = 'bold 13px "Trebuchet MS", sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = p.c;
    ctx.fillText(p.n.slice(0, 14), x + 6, y + 13);
    const bw = Math.max(50, w - 70), ratio = p.hp / 100;
    ctx.fillStyle = '#3a0d0d'; ctx.fillRect(x + 6, y + 18, bw, 9);
    ctx.fillStyle = p.gt > 0 ? '#ffd54f' : ratio > .5 ? '#7cdc4a' : ratio > .25 ? '#ffc107' : '#ff3d3d';
    ctx.fillRect(x + 6, y + 18, bw * ratio, 9);
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.strokeRect(x + 6, y + 18, bw, 9);
    ctx.fillStyle = '#ff5252'; ctx.font = '13px sans-serif'; ctx.fillText('♥'.repeat(Math.max(0, p.l)), x + 6, y + 41);
    for (let j = 0; j < 3; j++) goldIcon(x + w - 52 + j * 14, y + 3, j < p.g);
    ctx.textAlign = 'right'; ctx.fillStyle = '#ffe082'; ctx.font = 'bold 12px "Trebuchet MS", sans-serif';
    ctx.fillText(p.sc, x + w - 12, y + 41);
    if (p.s === 'dead') { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x, y - 1, w - 6, 44); bigText(p.l > 0 ? 'Vuelve en ' + p.rs : 'K.O.', x + w / 2, y + 30, 22, '#ff8a80'); }
  });
  // indicador de parada
  const label = (S.ph === 'travel' ? 'Próxima: ' : 'Parada: ') + S.nx;
  ctx.font = 'bold 13px "Trebuchet MS", sans-serif'; const lw = ctx.measureText(label).width + 52;
  rr(8, 66, lw, 24, 12, 'rgba(20,20,20,.75)', false);
  ctx.fillStyle = '#e53935'; ctx.beginPath(); ctx.arc(24, 78, 7, 0, 7); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('L1', 24, 81);
  ctx.font = 'bold 13px "Trebuchet MS", sans-serif'; ctx.textAlign = 'left'; ctx.fillText(label, 38, 83);
  // jefe
  const boss = S.E.find(e => e.ty === 'cierzo' && !e.d);
  if (boss) {
    const bw = 420, bx = (VW - bw) / 2, by = VH - 74;
    ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(bx - 4, by - 4, bw + 8, 20);
    ctx.fillStyle = '#4fc3f7'; ctx.fillRect(bx, by, bw * boss.hp / boss.mh, 12);
    bigText('EL CIERZO', VW / 2, by - 8, 22, '#e1f5fe', '#01579b');
  }
  if (S.ban) {
    const k = Math.min(1, (performance.now() % 100000) / 1);
    bigText(S.ban, VW / 2, 200, 62, '#ffcf3a');
    if (S.bs) bigText(S.bs, VW / 2, 238, 26, '#ffffff');
  }
  if (S.go && Math.floor(T * 3) % 2) bigText('¡SIGUE! ➜', VW - 120, 260, 48, '#ffffff', '#c62828');
  const me = S.P.find(p => p.i === myId);
  if (me && me.s === 'dead' && !S.ov) bigText(me.l > 0 ? `Volviendo del Olimpo en ${me.rs}…` : 'Sin vidas: ¡anima a tus colegas!', VW / 2, 300, 32, '#ffd54f');
  if (!joined) { ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'right'; ctx.fillStyle = '#fff'; ctx.fillText('Modo espectador', VW - 10, 82); }
  toasts.forEach((t, i) => {
    t.t -= 1 / 60; ctx.globalAlpha = clamp(t.t, 0, 1);
    ctx.font = 'bold 13px "Trebuchet MS", sans-serif'; ctx.textAlign = 'right'; ctx.fillStyle = '#fff';
    ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.strokeText(t.msg, VW - 10, 110 + i * 18); ctx.fillText(t.msg, VW - 10, 110 + i * 18);
  });
  ctx.globalAlpha = 1;
  for (let i = toasts.length - 1; i >= 0; i--) if (toasts[i].t <= 0) toasts.splice(i, 1);
  if (S.ov) {
    ctx.fillStyle = 'rgba(0,0,0,.72)'; ctx.fillRect(0, 0, VW, VH);
    bigText('FIN DEL TRAYECTO', VW / 2, 150, 72, '#ffcf3a');
    bigText('Los dioses también se marean…', VW / 2, 192, 26, '#fff');
    [...S.P].sort((a, b) => b.sc - a.sc).forEach((p, i) => bigText(`${i + 1}. ${p.n} — ${p.sc}`, VW / 2, 250 + i * 32, 26, p.c));
    bigText(`Nuevo viaje en ${S.ov}…`, VW / 2, VH - 70, 28, '#fff');
  }
}

// ------------------------------------------------------------------ bucle principal
function draw(S, dt) {
  ctx.setTransform(K, 0, 0, K, 0, 0);
  if (!S) {
    ctx.fillStyle = '#111'; ctx.fillRect(0, 0, VW, VH);
    bigText('Esperando al tranvía…', VW / 2, VH / 2, 40, '#ffcf3a');
    return;
  }
  scenSpeed += ((S.ph === 'travel' ? 260 : 0) - scenSpeed) * Math.min(1, dt * 1.2);
  scen += scenSpeed * dt;
  doorOpen += ((S.ph === 'fight' ? 1 : 0) - doorOpen) * Math.min(1, dt * 3);
  let ox = 0, oy = 0;
  if (shake > 0) { shake -= dt; ox = rnd(-6, 6); oy = rnd(-4, 4); }
  if (S.ph === 'travel') oy += Math.sin(T * 9) * .8; // traqueteo
  ctx.save(); ctx.translate(ox, oy);
  const cam = S.cam;
  drawBackground(cam, S);

  const list = [], riders = new Set();
  for (const it of S.I) list.push({ y: it.y - .5, f: () => drawItem(it, cam) });
  for (const m of S.M) {
    const rider = m.rk === 'p' ? S.P.find(p => p.i === m.ri) : m.rk === 'e' ? S.E.find(e => e.i === m.ri) : null;
    if (rider) riders.add(m.rk + rider.i);
    list.push({ y: m.y, f: () => drawMountEnt(m, rider, cam) });
  }
  for (const p of S.P) if (p.s !== 'dead' && !riders.has('p' + p.i)) list.push({ y: p.y + .1, f: () => drawPlayerEnt(p, cam) });
  for (const e of S.E) if (!riders.has('e' + e.i)) list.push({ y: e.y, f: () => drawEnemyEnt(e, cam) });
  list.sort((a, b) => a.y - b.y).forEach(o => o.f());

  updParts(dt, cam);
  for (const p of S.P) if (p.sy && p.s !== 'dead') drawBubble(p.sy, p.x - cam, headTop(p, 1.05, riders.has('p' + p.i) ? 32 : 0) - 14);
  for (const e of S.E) if (e.sy && !e.d) drawBubble(e.sy, e.x - cam, headTop(e, VIS[e.ty].h, riders.has('e' + e.i) ? 32 : 0) - 8);
  drawFrontPoles(cam);
  if (windFx > 0) {
    windFx -= dt; ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2;
    for (let i = 0; i < 26; i++) { const y = 80 + hash(i) * 420, x = posmod(hash(i * 3) * VW - T * 1400 * (hash(i * 7) + .5), VW + 200) - 100; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 60 + hash(i) * 80, y); ctx.stroke(); }
  }
  ctx.restore();
  const vg = ctx.createRadialGradient(VW / 2, VH / 2, 250, VW / 2, VH / 2, 620); vg.addColorStop(0, 'rgba(10,10,40,0)'); vg.addColorStop(1, 'rgba(10,10,40,.45)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, VW, VH);
  if (flashScr > 0) { flashScr -= dt; ctx.fillStyle = `rgba(255,220,90,${flashScr})`; ctx.fillRect(0, 0, VW, VH); }
  drawHUD(S);
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now; T += dt;
  pollPad(); sendInput();
  draw(renderState(now), dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
