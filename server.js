'use strict';
// ¡SOY DE ORO! — servidor autoritativo del beat'em up cooperativo en el tranvía de Zaragoza
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const { WebSocketServer } = require('ws');

const PORT = +process.env.PORT || 3000;
const PUB = path.join(__dirname, 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.ico': 'image/x-icon' };

function lanIps() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) for (const n of list || [])
    if (n.family === 'IPv4' && !n.internal) out.push(n.address);
  return out;
}

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/info') {
    const local = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(req.headers.host || '') && !req.headers['cf-connecting-ip'];
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ips: local ? lanIps() : [], port: PORT }));
  }
  if (p === '/') p = '/index.html';
  const f = path.join(PUB, path.normalize(p));
  if (!f.startsWith(PUB)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(d);
  });
});
const wss = new WebSocketServer({ server });

// ---------------------------------------------------------------- constantes
const TICK = 30, DT = 1 / TICK, VIEW_W = 960, DEPTH = 170, GRAV = 1500;
const FIRST_STOP = 700, STOP_GAP = 1500, MAX_PLAYERS = 8;
const STOPS = ['Avenida de la Academia', 'Parque Goya', 'Juslibol', 'Plaza del Pilar - Murallas', 'César Augusto',
  'Plaza España', 'Plaza Aragón', 'Gran Vía', 'Romareda', 'Casablanca', 'Valdespartera', 'Mago de Oz'];
const COLORS = ['#e53935', '#1e88e5', '#43a047', '#8e24aa', '#fb8c00', '#00acc1', '#d81b60', '#6d4c41'];
const LINES = {
  player: ['¡SOY DE ORO!', '¡Soy el hijo de Zeus!', '¡Hic! ¿Esto para en el Pilar?', '¡Mi padre lanza rayos, yo lanzo botellines!',
    '¡Arrodillaos, mortales!', '¡Que alguien avise al Olimpo!', '¡Brillooo!', 'Hic... ¡soy inmortal!', '¡Este tranvía es mi carro de guerra!',
    '¡El cierzo no puede conmigo!', '¡Papá Zeus, mira qué bien lo hago!', '¿Quién ha movido el suelo?', '¡Oro de 24 quilates, chaval!'],
  respawn: ['¡Los dioses no mueren!', '¡He vuelto del Olimpo!', '¡Resucitado! Hic.', '¡Papá me ha devuelto!'],
  beer: ['¡Glu glu glu!', '¡Néctar del Olimpo!', '¡Ambrosía!', 'Hic... ¡qué rica!', '¡Esto me cura todo!'],
  gold: ['¡SOY DE OROOOO!', '¡PAPÁ ZEUS, MÍRAME!', '¡BRILLO DIVINO!', '¡24 QUILATES DE DIOS!'],
  ouch: ['¡Ay!', '¡Auch!', '¡Mi espalda!', '¡Socorro!', '¡Animal!'],
};
// Atributos de cada tipo de pasajero: vida, velocidad, daño, alcance, preparación del golpe, cadencia, altura (h) y anchura (w)
const ET = {
  nino:       { hp: 22,  spd: 150, dmg: 4,  range: 38, windup: 0.18, cd: 0.8, h: 0.62, w: 0.85, score: 50,  lines: ['¡Mamaaá, un borracho!', '¡Jajaja, qué pintas!', '¡Te voy a grabar!'] },
  abuela:     { hp: 45,  spd: 70,  dmg: 12, range: 50, windup: 0.5,  cd: 2.2, h: 0.82, w: 1.0,  score: 120, behav: 'charge', chargeSpd: 330, lines: ['¡Sinvergüenza!', '¡A tu edad!', '¡Que llego tarde al mercado!', '¡Ese asiento es mío!'] },
  revisor:    { hp: 60,  spd: 95,  dmg: 9,  range: 46, windup: 0.35, cd: 1.3, h: 1.0,  w: 1.0,  score: 100, lines: ['¡Billete, por favor!', '¡Eso es multa!', '¡Validar es obligatorio!'] },
  turista:    { hp: 40,  spd: 105, dmg: 8,  range: 92, windup: 0.4,  cd: 1.5, h: 1.08, w: 0.95, score: 90,  lines: ['Excuse me! Selfie!', 'Where is El Pilar?', '#Zaragoza #tram', '¡Qué auténtico!'] },
  baturro:    { hp: 70,  spd: 90,  dmg: 11, range: 50, windup: 0.35, cd: 1.4, h: 1.04, w: 1.05, score: 130, lines: ['¡Maño, que te doy!', '¡Ni oro ni leches!', '¡Pues no te digo que no!', '¡Cagüen!'] },
  patinete:   { hp: 35,  spd: 120, dmg: 11, range: 44, windup: 0.3,  cd: 2.0, h: 1.0,  w: 0.95, score: 110, behav: 'dash', chargeSpd: 430, lines: ['¡Apartaaa!', '¡Que voy por el carril!', '¡Me quedan 3% de batería!'] },
  cachas:     { hp: 120, spd: 65,  dmg: 18, range: 56, windup: 0.6,  cd: 1.9, h: 1.22, w: 1.35, score: 200, knock: true, lines: ['¿Tú de oro? Yo de proteína.', '¡Hoy toca pierna!', '¡Mira estos bíceps!'] },
  repartidor: { hp: 3,   spd: 190, dmg: 0,  range: 0,  h: 0.95, w: 0.95, score: 300, behav: 'flee', lines: ['¡Mi pedido!', '¡Que llego tarde!', '¡Eso no es tuyo!'] },
  cierzo:     { hp: 600, spd: 80,  dmg: 20, range: 72, windup: 0.6,  cd: 1.6, h: 1.65, w: 1.6,  score: 2000, behav: 'boss', knock: true, lines: ['¡SOPLOOOO!', '¡Nadie aguanta en pie en Zaragoza!', '¡Fuuuuuuu!', '¡Soy el viento del Moncayo!'] },
};
const POOL = ['nino', 'revisor', 'abuela', 'turista', 'baturro', 'patinete', 'cachas'];

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.random() * a.length | 0];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const R = v => Math.round(v);

let nextId = 1;
const players = new Map();
let W;

function stopName(i) { return STOPS[i % STOPS.length]; }
function setBanner(t, s, d) { W.banner = t; W.bannerSub = s || ''; W.bannerT = d || 2.5; }
function ev(o) { W.events.push(o); }
function say(ent, text, d = 2.2) { ent.say = text; ent.sayT = d; }
function alivePlayers() { return [...players.values()].filter(p => p.state !== 'dead'); }
function poolNow() { return POOL.slice(0, Math.min(POOL.length, 2 + W.stopIdx)); }

function resetWorld() {
  W = { t: 0, cam: 0, stopIdx: 0, phase: 'travel', lockX: FIRST_STOP, wavesLeft: 0, enemies: [], mounts: [], items: [], events: [],
    banner: '', bannerSub: '', bannerT: 0, goT: 0, overT: 0, ambushT: 6, minionT: 8 };
  for (const p of players.values()) resetPlayer(p, true);
  setBanner('¡AL TRANVÍA!', 'Próxima parada: ' + stopName(0), 3);
}

function resetPlayer(p, full) {
  Object.assign(p, { x: W.cam + 120 + rnd(0, 160), y: rnd(40, DEPTH - 40), z: 380, vz: 0, vx: 0, hp: 100, maxHp: 100, state: 'jump', stateT: 0,
    inv: 2.5, goldT: 0, mount: null, combo: 0, comboT: 0, windT: 0, windDir: 0, airAtk: false, kickHit: new Set(), dying: false, mountCd: 0, hitDone: true });
  if (full) { p.lives = 3; p.gold = 1; p.score = 0; }
}

function createPlayer(name) {
  const used = new Set([...players.values()].map(p => p.color));
  const p = { id: nextId++, name: (name.replace(/[<>]/g, '').trim().slice(0, 14)) || 'Zeus Jr.', color: COLORS.find(c => !used.has(c)) || pick(COLORS),
    inp: 0, press: 0, say: '', sayT: 0, facing: 1, respawnT: 0 };
  resetPlayer(p, true);
  players.set(p.id, p);
  say(p, '¡He llegado, mortales!', 2.5);
  ev({ e: 'join', n: p.name });
  return p;
}

// ---------------------------------------------------------------- spawns
function spawnEnemy(type, side, opts = {}) {
  const d = ET[type];
  const hpMul = 1 + 0.1 * W.stopIdx + 0.35 * Math.floor(W.stopIdx / STOPS.length);
  const pc = Math.max(1, alivePlayers().length);
  const e = { id: nextId++, type, x: side > 0 ? W.cam + VIEW_W + rnd(40, 260) : W.cam - rnd(40, 260), y: rnd(10, DEPTH - 10), z: 0, vz: 0, vx: 0,
    facing: -side, state: 'walk', stateT: 0, atkCd: rnd(0.6, 1.6), say: '', sayT: -rnd(0, 4), hitCnt: 0, hitCntT: 0, mount: null,
    entered: false, dead: false, slot: rnd(-16, 16), flash: 0, dir: -side };
  let hp = d.hp;
  if (type === 'cierzo') hp = d.hp * hpMul * (1 + 0.5 * (pc - 1));
  else if (type !== 'repartidor') hp = d.hp * hpMul;
  e.hp = e.maxHp = R(hp);
  Object.assign(e, opts);
  W.enemies.push(e);
  return e;
}

function spawnWave() {
  const pc = Math.max(1, alivePlayers().length);
  const n = Math.min(12, 3 + Math.floor(W.stopIdx * 0.6) + (pc - 1) * 2);
  const pool = poolNow();
  for (let i = 0; i < n; i++) spawnEnemy(pick(pool), Math.random() < 0.65 ? 1 : -1);
  ev({ e: 'door' });
}

function spawnMount(riderType) {
  const m = { id: nextId++, x: W.cam + VIEW_W + 90, y: rnd(30, DEPTH - 30), z: 0, facing: -1, state: 'idle', stateT: 0, atkT: 0, rider: null,
    fleeT: 0, dir: -1, life: 0, entered: false, mv: false, px: 0, py: 0 };
  W.mounts.push(m);
  if (riderType) {
    const e = spawnEnemy(riderType, 1, { x: m.x, y: m.y });
    e.mount = m.id; m.rider = { k: 'e', id: e.id };
  } else { m.fleeT = 2.2; m.dir = -1; }
}

function dropItem(x, y, ty) {
  W.items.push({ id: nextId++, ty, x: clamp(x + rnd(-10, 10), W.cam + 30, W.cam + VIEW_W - 30), y: clamp(y + rnd(-8, 8), 6, DEPTH - 6), t: 0 });
}

function startFight() {
  W.phase = 'fight'; W.cam = W.lockX;
  const si = W.stopIdx, boss = si % 4 === 3;
  if (boss) {
    setBanner('¡ALERTA DE CIERZO!', 'Parada ' + stopName(si) + ' — ¡agarraos a la barra!', 3);
    spawnEnemy('cierzo', 1, { x: W.cam + VIEW_W + 80, y: DEPTH / 2 });
    spawnEnemy('nino', 1); spawnEnemy('nino', -1);
    W.wavesLeft = 0; W.minionT = 9;
    ev({ e: 'door' });
  } else {
    setBanner('PARADA: ' + stopName(si).toUpperCase(), '¡Se abren las puertas!', 2.5);
    W.wavesLeft = 2 + (si >= 6 ? 1 : 0);
    spawnWave(); W.wavesLeft--;
  }
  if (si === 1) spawnMount(null);
  else if (si > 1 && Math.random() < 0.4) spawnMount(pick(['baturro', 'patinete', 'revisor']));
  if (si > 0 && Math.random() < 0.6) spawnEnemy('repartidor', -1, { dir: 1, x: W.cam - 60 });
}

// ---------------------------------------------------------------- combate
function hitEnemy(e, dmg, knock, dir, src) {
  const d = ET[e.type];
  ev({ e: 'hit', x: R(e.x), y: R(e.y), z: R(e.z + 45 * d.h), d: R(dmg), big: knock ? 1 : 0 });
  if (e.type === 'repartidor') {
    e.hits = (e.hits || 0) + 1;
    dropItem(e.x, e.y, e.hits >= 3 ? 'gold' : 'beer');
    e.state = 'hurt'; e.stateT = 0; e.vx = dir * 120; say(e, pick(d.lines), 1.5);
    if (e.hits >= 3) { e.dead = true; e.state = 'down'; e.stateT = 0; e.vz = 280; e.vx = dir * 250; if (src) src.score += d.score; }
    return;
  }
  if (e.mount) { dismountEnemy(e); knock = true; }
  e.hp -= dmg;
  e.hitCnt = e.hitCntT > 0 ? e.hitCnt + 1 : 1; e.hitCntT = 1.0;
  if (src) src.score += R(dmg);
  if (e.hp <= 0) {
    e.hp = 0; e.dead = true; e.state = 'down'; e.stateT = 0; e.vx = dir * 260; e.vz = 320;
    if (src) src.score += d.score;
    if (e.type === 'cierzo') {
      setBanner('¡EL CIERZO HA AMAINADO!', '¡Los hijos de Zeus dominan el tranvía!', 3.5);
      ev({ e: 'bossdown' });
      dropItem(e.x, e.y, 'gold'); dropItem(e.x + 40, e.y, 'beer'); dropItem(e.x - 40, e.y, 'beer');
    } else {
      const r = Math.random();
      if (r < 0.04) dropItem(e.x, e.y, 'gold'); else if (r < 0.2) dropItem(e.x, e.y, 'beer');
    }
    return;
  }
  if (e.type === 'cierzo') { e.flash = 0.15; if (knock) e.vx = dir * 90; return; } // súper armadura
  if (knock || e.hitCnt >= 4) { e.state = 'down'; e.stateT = 0; e.vx = dir * 230; e.vz = 260; e.hitCnt = 0; }
  else { e.state = 'hurt'; e.stateT = 0; e.vx = dir * 70; }
  if (Math.random() < 0.2) say(e, pick(LINES.ouch), 1.2);
}

function hitArea(src, x, y, f, near, far, dyMax, dmg, knock, set) {
  let n = 0;
  for (const e of W.enemies) {
    if (e.dead || e.state === 'down' || e.state === 'getup') continue;
    if (set && set.has(e.id)) continue;
    const d = ET[e.type], rel = (e.x - x) * f;
    if (rel >= near && rel <= far + d.w * 10 && Math.abs(e.y - y) < dyMax + d.w * 4 && Math.abs(e.z - (src.z || 0)) < 60) {
      hitEnemy(e, dmg, knock, f, src); if (set) set.add(e.id); n++;
    }
  }
  return n;
}

function hurtPlayer(p, dmg, knock, dir) {
  if (p.state === 'dead' || p.state === 'down' || p.inv > 0 || p.goldT > 0) return false;
  const m = p.mount && W.mounts.find(q => q.id === p.mount);
  if (m) { m.rider = null; m.fleeT = 1.2; m.dir = -dir; p.mount = null; p.mountCd = 1.5; knock = true; say(p, '¡Mi botellón!'); }
  p.hp -= dmg;
  ev({ e: 'hurt', x: R(p.x), y: R(p.y), z: R(p.z + 50), d: R(dmg) });
  if (p.hp <= 0) { p.hp = 0; p.dying = true; p.state = 'down'; p.stateT = 0; p.vx = dir * 220; p.vz = 320; say(p, 'Hic... papá... ¿eres tú?', 2.5); }
  else if (knock) { p.state = 'down'; p.stateT = 0; p.vx = dir * 200; p.vz = 260; }
  else { p.state = 'hurt'; p.stateT = 0; p.vx = dir * 60; p.inv = 0.5; }
  return true;
}

function hitPlayers(e, near, far, dy, dmg, knock, set) {
  let n = 0;
  for (const p of players.values()) {
    if (set && set.has(p.id)) continue;
    const rel = (p.x - e.x) * e.facing;
    if (rel >= near && rel <= far && Math.abs(p.y - e.y) < dy && p.z < 55 && hurtPlayer(p, dmg, knock, e.facing)) { n++; if (set) set.add(p.id); }
  }
  return n;
}

function dismountEnemy(e) {
  const m = W.mounts.find(q => q.id === e.mount);
  if (m) { m.rider = null; m.fleeT = 1.0; m.dir = Math.random() < 0.5 ? 1 : -1; }
  e.mount = null;
}

// ---------------------------------------------------------------- jugadores
function updPlayer(p) {
  const k = p.inp, pr = p.press; p.press = 0;
  const P = b => (pr & b) !== 0;
  p.stateT += DT; p.inv -= DT; p.sayT -= DT; p.comboT -= DT; p.mountCd -= DT; p.windT -= DT;
  if (p.goldT > 0) { p.goldT -= DT; if (p.goldT <= 0) say(p, 'Hic... se me pasa el brillo'); }
  if (p.state === 'dead') {
    if (p.lives > 0) { p.respawnT -= DT; if (p.respawnT <= 0) { resetPlayer(p, false); say(p, pick(LINES.respawn)); } }
    return;
  }
  let m = p.mount ? W.mounts.find(q => q.id === p.mount) : null;
  if (p.mount && !m) p.mount = null;

  p.z += p.vz * DT;
  if (p.z > 0 || p.vz > 0) p.vz -= GRAV * DT;
  if (p.z <= 0) { p.z = 0; if (p.vz < 0) p.vz = 0; if (p.state === 'jump') { p.state = 'idle'; p.stateT = 0; } }
  p.x += p.vx * DT; p.vx *= p.z > 0 ? 0.98 : 0.82; if (Math.abs(p.vx) < 3) p.vx = 0;
  if (p.windT > 0) p.x += p.windDir * 150 * DT;

  if (p.state === 'down') {
    if (p.stateT > 0.9 && p.z === 0) {
      if (p.dying) {
        p.dying = false; p.lives--; p.state = 'dead'; p.respawnT = 3;
        ev({ e: 'ko', x: R(p.x), y: R(p.y) });
        return;
      }
      p.state = 'idle'; p.stateT = 0; p.inv = 1.0;
    }
  } else if (p.state === 'hurt') {
    if (p.stateT > 0.25) { p.state = 'idle'; p.stateT = 0; }
  } else if (p.state === 'special') {
    if (p.stateT > 0.6) { p.state = 'idle'; p.stateT = 0; }
  } else {
    const gold = p.goldT > 0, mult = gold ? 2 : 1;
    const spd = (m ? 235 : 185) * (gold ? 1.3 : 1);
    const dx = ((k & 8) ? 1 : 0) - ((k & 4) ? 1 : 0), dy = ((k & 2) ? 1 : 0) - ((k & 1) ? 1 : 0);
    const grounded = p.z === 0;
    if (p.state !== 'attack' || !grounded) {
      p.x += dx * spd * DT; p.y += dy * spd * 0.62 * DT;
      if (dx) p.facing = dx;
    }
    if (!m) p.y += Math.sin(W.t * 2.3 + p.id * 1.7) * 14 * DT; // tambaleo etílico
    if (grounded && p.state !== 'attack') p.state = (dx || dy) ? 'walk' : 'idle';

    if (P(32) && grounded) {
      if (m) { m.rider = null; p.mount = null; p.mountCd = 1.2; m = null; p.vz = 430; p.state = 'jump'; p.stateT = 0; p.airAtk = false; }
      else if (p.state !== 'attack') { p.vz = 480; p.state = 'jump'; p.stateT = 0; p.airAtk = false; ev({ e: 'jump', x: R(p.x), y: R(p.y) }); }
    }
    if (P(16)) {
      if (m) {
        if (m.atkT <= 0) {
          m.atkT = 0.65; m.state = 'spray'; m.stateT = 0;
          ev({ e: 'foam', x: R(p.x), y: R(p.y), f: p.facing });
          hitArea(p, p.x, p.y, p.facing, 10, 185, 36, 14 * mult, true);
        }
      } else if (p.state === 'jump' && !p.airAtk) { p.airAtk = true; p.kickHit = new Set(); }
      else if (grounded && (p.state !== 'attack' || p.stateT > 0.16)) {
        p.combo = p.comboT > 0 ? (p.combo % 3) + 1 : 1; p.comboT = 0.6; p.state = 'attack'; p.stateT = 0; p.hitDone = false;
      }
    }
    if (p.state === 'attack') {
      if (!p.hitDone && p.stateT >= 0.07) {
        p.hitDone = true;
        const heavy = p.combo === 3;
        const n = hitArea(p, p.x, p.y, p.facing, -8, heavy ? 72 : 62, 24, (heavy ? 17 : 8) * mult, heavy);
        if (!n) ev({ e: 'swing', x: R(p.x), y: R(p.y) });
      }
      if (p.stateT >= (p.combo === 3 ? 0.34 : 0.24)) { p.state = 'idle'; p.stateT = 0; }
    }
    if (p.state === 'jump' && p.airAtk && p.z > 5) hitArea(p, p.x, p.y, p.facing, -5, 58, 24, 14 * mult, true, p.kickHit);
    if (P(64) && p.gold > 0 && p.goldT <= 0) {
      p.gold--; p.goldT = 9; p.state = 'special'; p.stateT = 0;
      say(p, pick(LINES.gold), 2.5);
      ev({ e: 'gold', x: R(p.x), y: R(p.y), i: p.id });
      for (const e of W.enemies) if (!e.dead && e.type !== 'repartidor' && Math.abs(e.x - p.x) < 340) hitEnemy(e, 28, true, e.x >= p.x ? 1 : -1, p);
    }
  }
  p.y = clamp(p.y, 0, DEPTH);
  p.x = clamp(p.x, W.cam + 25, W.cam + VIEW_W - 25);
  if (m) { m.x = p.x; m.y = p.y; m.facing = p.facing; m.z = p.z; }

  if (!m && p.z === 0 && p.mountCd <= 0 && (p.state === 'idle' || p.state === 'walk')) {
    for (const q of W.mounts) if (!q.rider && Math.abs(q.x - p.x) < 40 && Math.abs(q.y - p.y) < 22) {
      q.rider = { k: 'p', id: p.id }; q.fleeT = 0; p.mount = q.id; p.x = q.x; p.y = q.y;
      say(p, '¡Mi corcel espumoso!'); ev({ e: 'mount', x: R(q.x), y: R(q.y) }); break;
    }
  }
  for (const it of W.items) if (!it.taken && Math.abs(it.x - p.x) < 30 && Math.abs(it.y - p.y) < 20 && p.z < 30) {
    it.taken = true;
    if (it.ty === 'beer') { p.hp = Math.min(p.maxHp, p.hp + 30); say(p, pick(LINES.beer)); }
    else { p.gold = Math.min(3, p.gold + 1); say(p, '¡Botella dorada! ¡Néctar de papá!'); }
    ev({ e: 'pick', x: R(it.x), y: R(it.y), ty: it.ty });
  }
  if (p.sayT < -5 && Math.random() < 0.006) say(p, pick(LINES.player));
}

// ---------------------------------------------------------------- enemigos
function nearestPlayer(e) {
  let best = null, bd = 1e9;
  for (const p of players.values()) {
    if (p.state === 'dead') continue;
    const d = Math.abs(p.x - e.x) + Math.abs(p.y - e.y) * 2;
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}
function endAttack(e, d) { e.state = 'walk'; e.stateT = 0; e.atkCd = (d.cd || 1.5) * rnd(0.7, 1.3); }

function updEnemy(e) {
  const d = ET[e.type];
  e.stateT += DT; e.atkCd -= DT; e.sayT -= DT; e.hitCntT -= DT; if (e.flash > 0) e.flash -= DT;
  e.z += e.vz * DT; if (e.z > 0 || e.vz > 0) e.vz -= GRAV * DT; if (e.z <= 0) { e.z = 0; if (e.vz < 0) e.vz = 0; }
  e.x += e.vx * DT; e.vx *= e.z > 0 ? 0.98 : 0.85; if (Math.abs(e.vx) < 3) e.vx = 0;

  if (e.state === 'down') {
    if (e.dead) { if (e.stateT > 1.6) e.remove = true; return; }
    if (e.stateT > 1.0 && e.z === 0) { e.state = 'getup'; e.stateT = 0; }
    return;
  }
  if (e.state === 'getup') { if (e.stateT > 0.45) { e.state = 'walk'; e.stateT = 0; e.atkCd = Math.max(e.atkCd, 0.4); } return; }
  if (e.state === 'hurt') { if (e.stateT > 0.32) { e.state = 'walk'; e.stateT = 0; } return; }
  if (e.x > W.cam + 20 && e.x < W.cam + VIEW_W - 20) e.entered = true;

  if (d.behav === 'flee') {
    e.x += e.dir * d.spd * DT; e.facing = e.dir;
    e.y = clamp(e.y + Math.sin(W.t * 3 + e.id) * 50 * DT, 5, DEPTH - 5);
    if (e.sayT < -3 && Math.random() < 0.02) say(e, pick(d.lines), 1.5);
    if (e.x > W.cam + VIEW_W + 150 || e.x < W.cam - 220) e.remove = true;
    return;
  }
  if (e.x < W.cam - 320) { e.remove = true; return; }

  const t = nearestPlayer(e);
  if (e.sayT < -4 && Math.random() < 0.004) say(e, pick(d.lines), 2);
  if (!t) { e.state = 'walk'; return; }
  let m = e.mount ? W.mounts.find(q => q.id === e.mount) : null;
  if (e.mount && !m) e.mount = null;
  const range = m ? 150 : d.range, spd = m ? 140 : d.spd;
  const dxT = t.x - e.x, dyT = t.y - e.y;

  if (e.state === 'walk') {
    const side = dxT > 0 ? -1 : 1;
    const wantX = t.x + side * range * 0.8, wantY = t.y + (m ? 0 : e.slot);
    const mx = wantX - e.x, my = wantY - e.y;
    if (Math.abs(mx) > 6) e.x += Math.sign(mx) * Math.min(Math.abs(mx), spd * DT);
    if (Math.abs(my) > 3) e.y += Math.sign(my) * Math.min(Math.abs(my), spd * 0.6 * DT);
    e.facing = dxT >= 0 ? 1 : -1;
    for (const o of W.enemies) if (o !== e && !o.dead) {
      const ox = e.x - o.x, oy = e.y - o.y;
      if (Math.abs(ox) < 26 && Math.abs(oy) < 12) { e.y += (oy >= 0 ? 1 : -1) * 30 * DT; e.x += (ox >= 0 ? 1 : -1) * 20 * DT; }
    }
    if (d.behav === 'boss' && e.atkCd <= 0 && e.entered && (Math.abs(dxT) > 230 || Math.random() < 0.012)) {
      e.state = 'blow'; e.stateT = 0; say(e, pick(d.lines), 2); ev({ e: 'wind' });
    } else if (e.atkCd <= 0 && e.entered && Math.abs(dxT) <= range + 10 && Math.abs(dyT) < 18 && t.z < 50) {
      e.state = 'windup'; e.stateT = 0;
    }
  } else if (e.state === 'windup') {
    e.facing = dxT >= 0 ? 1 : -1;
    if (e.stateT >= (m ? 0.4 : d.windup)) {
      e.state = 'attack'; e.stateT = 0; e.hitSet = new Set();
      if (m) { m.state = 'spray'; m.stateT = 0; ev({ e: 'foam', x: R(e.x), y: R(e.y), f: e.facing }); }
    }
  } else if (e.state === 'attack') {
    if (m) {
      if (e.stateT < DT * 1.5) hitPlayers(e, 10, 180, 34, 10, true);
      if (e.stateT > 0.5) endAttack(e, d);
    } else if (d.behav === 'charge' || d.behav === 'dash') {
      e.x += e.facing * d.chargeSpd * DT;
      hitPlayers(e, -20, 40, 22, d.dmg, true, e.hitSet);
      if (e.stateT > (d.behav === 'dash' ? 0.55 : 0.7)) endAttack(e, d);
    } else {
      if (e.stateT < DT * 1.5) {
        hitPlayers(e, -10, d.range + 12, 22, d.dmg, !!d.knock);
        if (d.behav === 'boss') {
          const ix = e.x + e.facing * 70;
          ev({ e: 'slam', x: R(ix), y: R(e.y) });
          for (const p of players.values()) if (Math.abs(p.x - ix) < 140 && Math.abs(p.y - e.y) < 45 && p.z < 20) hurtPlayer(p, 12, true, p.x >= ix ? 1 : -1);
        }
      }
      if (e.stateT > 0.3) endAttack(e, d);
    }
  } else if (e.state === 'blow') {
    for (const p of players.values()) if (p.state !== 'dead') {
      p.windT = 0.1; p.windDir = p.x >= e.x ? 1 : -1;
      if (Math.random() < 0.035) hurtPlayer(p, 3, false, p.windDir);
    }
    if (e.stateT > 1.8) endAttack(e, d);
  }
  e.y = clamp(e.y, 0, DEPTH);
  if (e.entered && W.phase !== 'travel') e.x = clamp(e.x, W.cam + 20, W.cam + VIEW_W - 20);
  if (m) { m.x = e.x; m.y = e.y; m.facing = e.facing; }
}

// ---------------------------------------------------------------- monturas (botellones)
function updMount(m) {
  m.stateT += DT; m.atkT -= DT;
  m.mv = Math.hypot(m.x - m.px, m.y - m.py) > 0.5;
  if (m.state === 'spray' && m.stateT > 0.5) m.state = 'idle';
  if (m.rider) {
    const ok = m.rider.k === 'p' ? players.get(m.rider.id)?.mount === m.id : W.enemies.some(e => e.id === m.rider.id && e.mount === m.id && !e.dead);
    if (!ok) m.rider = null;
  }
  if (!m.rider) {
    m.life += DT; m.z = 0;
    if (m.fleeT > 0) { m.fleeT -= DT; m.x += m.dir * 190 * DT; m.facing = m.dir; }
    else if (Math.random() < 0.01) { m.fleeT = rnd(0.3, 0.8); m.dir = Math.random() < 0.5 ? 1 : -1; }
    m.y = clamp(m.y, 5, DEPTH - 5);
    if (m.x > W.cam + 30 && m.x < W.cam + VIEW_W - 30) m.entered = true;
    if (m.entered) m.x = clamp(m.x, W.cam + 30, W.cam + VIEW_W - 30);
    if (m.life > 50 || m.x < W.cam - 250) m.remove = true;
  } else m.life = 0;
  m.px = m.x; m.py = m.y;
}

// ---------------------------------------------------------------- bucle
function tick() {
  W.t += DT; W.bannerT -= DT; W.goT -= DT;
  if (W.phase === 'over') { W.overT -= DT; if (W.overT <= 0) resetWorld(); return; }
  for (const p of players.values()) updPlayer(p);
  for (const e of W.enemies) updEnemy(e);
  for (const m of W.mounts) updMount(m);
  for (const it of W.items) { it.t += DT; if (it.t > 25 || it.x < W.cam - 60) it.taken = true; }
  W.enemies = W.enemies.filter(e => !e.remove);
  W.mounts = W.mounts.filter(m => !m.remove);
  W.items = W.items.filter(i => !i.taken);

  const al = alivePlayers();
  if (al.length) {
    const maxX = Math.max(...al.map(p => p.x));
    const target = maxX - VIEW_W * 0.6;
    if (target > W.cam) W.cam = Math.min(target, W.cam + 280 * DT);
    if (W.phase === 'travel' && W.cam >= W.lockX) startFight();
    if (W.phase !== 'travel') W.cam = Math.min(W.cam, W.lockX);
  }

  if (W.phase === 'travel' && W.stopIdx > 0) {
    W.ambushT -= DT;
    if (W.ambushT <= 0) {
      W.ambushT = rnd(5, 9);
      const cnt = W.enemies.filter(e => !e.dead && e.type !== 'repartidor').length;
      if (cnt < 2 + W.stopIdx / 3) spawnEnemy(pick(poolNow()), 1);
    }
  }
  if (W.phase === 'fight') {
    const hostile = W.enemies.filter(e => !e.dead && e.type !== 'repartidor');
    const boss = hostile.find(e => e.type === 'cierzo');
    if (boss) {
      W.minionT -= DT;
      if (W.minionT <= 0 && hostile.length < 3) { W.minionT = 10; spawnEnemy(pick(poolNow()), 1); spawnEnemy(pick(poolNow()), -1); }
    } else if (hostile.length <= 1 && W.wavesLeft > 0) { spawnWave(); W.wavesLeft--; }
    else if (hostile.length === 0 && W.wavesLeft <= 0) {
      W.stopIdx++; W.lockX = W.cam + STOP_GAP; W.phase = 'travel'; W.goT = 4; W.ambushT = rnd(4, 7);
      const lap = Math.floor(W.stopIdx / STOPS.length);
      setBanner('¡PARADA DESPEJADA!', 'Próxima parada: ' + stopName(W.stopIdx) + (lap && W.stopIdx % STOPS.length === 0 ? ' — ¡Vuelta ' + (lap + 1) + '!' : ''), 2.8);
      for (const p of players.values()) if (p.state !== 'dead') p.hp = Math.min(p.maxHp, p.hp + 15);
    }
  }
  if (players.size > 0 && [...players.values()].every(p => p.state === 'dead' && p.lives <= 0)) {
    W.phase = 'over'; W.overT = 8;
    setBanner('FIN DEL TRAYECTO', 'Los dioses también se marean...', 8);
  }
}

function snapshot() {
  return JSON.stringify({
    t: 's', cam: R(W.cam), ph: W.phase, si: W.stopIdx, lap: Math.floor(W.stopIdx / STOPS.length) + 1,
    nx: stopName(W.stopIdx), go: W.goT > 0 ? 1 : 0, ban: W.bannerT > 0 ? W.banner : '', bs: W.bannerT > 0 ? W.bannerSub : '',
    ov: W.phase === 'over' ? Math.ceil(W.overT) : 0,
    P: [...players.values()].map(p => ({ i: p.id, n: p.name, c: p.color, x: R(p.x), y: R(p.y), z: R(p.z), f: p.facing, s: p.state, st: +p.stateT.toFixed(2),
      hp: R(p.hp), l: p.lives, g: p.gold, gt: p.goldT > 0 ? +p.goldT.toFixed(1) : 0, m: p.mount ? 1 : 0, sc: p.score, cb: p.combo,
      sy: p.sayT > 0 ? p.say : '', iv: p.inv > 0 ? 1 : 0, rs: p.state === 'dead' && p.lives > 0 ? Math.ceil(p.respawnT) : 0, ak: p.airAtk ? 1 : 0 })),
    E: W.enemies.map(e => ({ i: e.id, ty: e.type, x: R(e.x), y: R(e.y), z: R(e.z), f: e.facing, s: e.state, st: +e.stateT.toFixed(2), hp: R(e.hp), mh: e.maxHp,
      m: e.mount ? 1 : 0, sy: e.sayT > 0 ? e.say : '', d: e.dead ? 1 : 0, fl: e.flash > 0 ? 1 : 0 })),
    M: W.mounts.map(m => ({ i: m.id, x: R(m.x), y: R(m.y), z: R(m.z || 0), f: m.facing, s: m.state, mv: m.mv ? 1 : 0, rk: m.rider ? m.rider.k : '', ri: m.rider ? m.rider.id : 0 })),
    I: W.items.map(i => ({ i: i.id, ty: i.ty, x: R(i.x), y: R(i.y) })),
    ev: W.events,
  });
}

// ---------------------------------------------------------------- red
wss.on('connection', ws => {
  ws.pid = null;
  ws.on('message', raw => {
    let msg; try { msg = JSON.parse(raw); } catch { return; }
    if (msg.t === 'join' && !ws.pid) {
      if (players.size >= MAX_PLAYERS) return ws.send(JSON.stringify({ t: 'full' }));
      const p = createPlayer(String(msg.n || ''));
      ws.pid = p.id;
      ws.send(JSON.stringify({ t: 'welcome', id: p.id }));
    } else if (msg.t === 'in' && ws.pid) {
      const p = players.get(ws.pid);
      if (p) { p.inp = msg.k | 0; p.press |= msg.p | 0; }
    }
  });
  ws.on('close', () => {
    if (!ws.pid) return;
    const p = players.get(ws.pid);
    if (p && p.mount) { const m = W.mounts.find(q => q.id === p.mount); if (m) m.rider = null; }
    players.delete(ws.pid);
    if (players.size === 0) resetWorld();
  });
});

resetWorld();
setInterval(() => {
  tick();
  const s = snapshot();
  W.events = [];
  for (const c of wss.clients) if (c.readyState === 1) c.send(s);
}, 1000 / TICK);

server.listen(PORT, () => {
  console.log(`\n  🍺  ¡SOY DE ORO! — tranvía en marcha\n`);
  console.log(`  Local:      http://localhost:${PORT}`);
  for (const ip of lanIps()) console.log(`  Tu red:     http://${ip}:${PORT}   <- pásaselo a tus colegas`);
  console.log('');
});
