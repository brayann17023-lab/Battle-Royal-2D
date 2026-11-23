'use strict';
/* BATTLE ROYALE 2D - Servidor autoritativo (Node.js + Express + Socket.IO).
   El servidor simula TODO: movimiento, disparos, daño, zona, loot, bots y victoria.
   El cliente solo envía entradas (teclas, ángulo, disparo) y dibuja lo que el servidor le dice. */
const express = require('express'), http = require('http'), path = require('path'), os = require('os');
const { Server } = require('socket.io');
const Wp = require('./public/weapons.js'), W = Wp.WEAPONS, GR = Wp.GRENADE;
const GM = require('./public/map.js'), PL = require('./public/player.js'), Inventory = require('./public/inventory.js');
const MAP = GM.generate(), DT = PL.DT, MAX = 10;
const app = express();
app.use(express.static(path.join(__dirname, 'public')));
const server = http.createServer(app);
const io = new Server(server);
const rooms = new Map();
const rnd = (a, b) => a + Math.random() * (b - a);
const clean = s => String(s == null ? '' : s).replace(/[<>&"'`\\]/g, '').trim().slice(0, 14);
const ok = (cb, o) => { if (typeof cb === 'function') cb(o); };
const MODES = ['solo', 'teams', 'training', 'survival'];
const BOTN = ['Sombra', 'Viper', 'Nova', 'Rex', 'Luna', 'Kilo', 'Dash', 'Orion', 'Zeta', 'Bruno'];
/* Fases de la zona segura: espera, tiempo de reducción, radio final, daño por segundo */
const PH = [{ w: 40, s: 25, r: 1300, d: 2 }, { w: 25, s: 20, r: 800, d: 4 }, { w: 20, s: 15, r: 450, d: 7 }, { w: 15, s: 15, r: 200, d: 10 }, { w: 10, s: 12, r: 30, d: 14 }];
const TABLE = [['weapon', 'pistol', 9], ['weapon', 'shotgun', 7], ['weapon', 'smg', 8], ['weapon', 'assault', 7], ['weapon', 'sniper', 3], ['ammo', 'light', 12], ['ammo', 'shell', 8], ['ammo', 'rifle', 10], ['ammo', 'sniper', 5], ['med', null, 14], ['nade', null, 9], ['vest', null, 8]];
const AMT = { light: 24, shell: 8, rifle: 30, sniper: 6 };
function rollLoot() { let r = Math.random() * 100; for (const [t, k, w] of TABLE) { if ((r -= w) <= 0) return { type: t, key: k, amt: AMT[k] || 1 }; } return { type: 'med', amt: 1 }; }

/* ---------- Salas ---------- */
function newRoom(hostId, mode, pub) {
  const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; let code;
  do { code = ''; for (let i = 0; i < 5; i++) code += A[(Math.random() * A.length) | 0]; } while (rooms.has(code));
  const r = { code, host: hostId, mode, pub: !!pub, state: 'lobby', members: new Map(), players: new Map(), autoT: null, tickN: 0, bullets: [], nades: [], loot: new Map(), ev: [], cd: 0 };
  rooms.set(code, r); return r;
}
function info(r) { return { code: r.code, mode: r.mode, host: r.host, state: r.state, pub: r.pub, max: MAX, members: [...r.members.values()].map((m, i) => ({ id: m.id, name: m.name, char: m.char, team: i % 2 + 1 })) }; }
function pushInfo(r) { io.to(r.code).emit('room:update', info(r)); }
function joinRoom(sock, r, name, char) {
  sock.join(r.code); sock.data.room = r.code; sock.data.name = clean(name) || sock.data.name || 'Jugador';
  r.members.set(sock.id, { id: sock.id, name: sock.data.name, char: Math.max(0, Math.min(7, char | 0)) });
  pushInfo(r);
}
function leaveRoom(sock) {
  const r = rooms.get(sock.data.room); sock.data.room = null; if (!r) return;
  sock.leave(r.code);
  if (r.state === 'playing') { const p = r.players.get(sock.id); if (p) { if (p.alive) kill(r, p, null, 'desconexión'); p.sock = null; p.left = true; } }
  r.members.delete(sock.id);
  if (!r.members.size) { rooms.delete(r.code); return; }
  if (r.host === sock.id) r.host = r.members.keys().next().value;
  pushInfo(r);
}
const canStart = r => r.state === 'lobby' && (r.mode === 'training' || r.mode === 'survival' ? r.members.size >= 1 : r.members.size >= 2);

io.on('connection', sock => {
  sock.data = { name: '', room: null };
  sock.on('hello', n => { sock.data.name = clean(n); });
  sock.on('friends:check', (names, cb) => {
    if (!Array.isArray(names)) return;
    const want = new Set(names.slice(0, 40).map(n => String(n).toLowerCase())), res = [];
    for (const s of io.sockets.sockets.values()) {
      const n = (s.data.name || '').toLowerCase(); if (!n || !want.has(n)) continue;
      const r = rooms.get(s.data.room);
      res.push({ name: s.data.name, code: r && r.state === 'lobby' ? r.code : null, busy: !!(r && r.state !== 'lobby') });
    }
    ok(cb, res);
  });
  sock.on('room:create', (d, cb) => {
    d = d || {}; if (sock.data.room) leaveRoom(sock);
    const r = newRoom(sock.id, MODES.includes(d.mode) ? d.mode : 'solo', false);
    joinRoom(sock, r, d.name, d.char); ok(cb, { ok: true, code: r.code });
  });
  sock.on('room:join', (d, cb) => {
    d = d || {}; const r = rooms.get(String(d.code || '').toUpperCase().trim());
    if (!r) return ok(cb, { ok: false, err: 'No existe una sala con ese código.' });
    if (r.state !== 'lobby') return ok(cb, { ok: false, err: 'La partida ya comenzó.' });
    if (r.members.size >= MAX) return ok(cb, { ok: false, err: 'La sala está llena (10/10).' });
    if (sock.data.room) leaveRoom(sock);
    joinRoom(sock, r, d.name, d.char); ok(cb, { ok: true, code: r.code });
  });
  sock.on('quick:play', (d, cb) => {
    d = d || {}; if (sock.data.room) leaveRoom(sock);
    let r = [...rooms.values()].find(x => x.pub && x.state === 'lobby' && x.mode === 'solo' && x.members.size < MAX);
    if (!r) r = newRoom(sock.id, 'solo', true);
    joinRoom(sock, r, d.name, d.char); ok(cb, { ok: true, code: r.code });
  });
  sock.on('room:mode', m => { const r = rooms.get(sock.data.room); if (r && r.host === sock.id && r.state === 'lobby' && MODES.includes(m)) { r.mode = m; pushInfo(r); } });
  sock.on('room:char', c => { const r = rooms.get(sock.data.room); const m = r && r.members.get(sock.id); if (m) { m.char = Math.max(0, Math.min(7, c | 0)); pushInfo(r); } });
  sock.on('room:start', () => { const r = rooms.get(sock.data.room); if (r && r.host === sock.id && canStart(r)) startGame(r); });
  sock.on('room:lobby', () => { const r = rooms.get(sock.data.room); if (r && r.state === 'ended') { r.state = 'lobby'; r.players = new Map(); r.autoT = null; pushInfo(r); } });
  sock.on('room:leave', () => leaveRoom(sock));
  sock.on('disconnect', () => leaveRoom(sock));
  sock.on('in', d => {
    const r = rooms.get(sock.data.room); if (!r || r.state !== 'playing' || !d) return;
    const p = r.players.get(sock.id); if (!p || !p.alive) return;
    const a = +d.a; if (Number.isFinite(a)) p.a = a;
    p.in.f = !!d.f;
    if (p.q.length < 5) p.q.push({ s: d.s | 0, x: Math.max(-1, Math.min(1, +d.x || 0)), y: Math.max(-1, Math.min(1, +d.y || 0)), r: d.r ? 1 : 0 });
  });
  sock.on('act', d => {
    const r = rooms.get(sock.data.room); if (!r || r.state !== 'playing' || r.cd > 0 || !d) return;
    const p = r.players.get(sock.id); if (!p || !p.alive) return;
    if (d.t === 'pick') pickup(r, p);
    else if (d.t === 'reload') startReload(p);
    else if (d.t === 'sw') switchTo(p, d.i | 0);
    else if (d.t === 'nade') throwNade(r, p, +d.d || 200);
    else if (d.t === 'heal') healStart(p);
  });
});

/* ---------- Inicio de partida ---------- */
function mk(id, name, char, team, kind, x, y, sock) {
  return { id, name, char, team, kind, x, y, a: 0, hp: 100, max: 100, alive: true, inv: new Inventory(), q: [], in: { f: false, a: 0 }, sq: 0, fireCd: 0, reloadT: 0, healT: 0, flash: 0, mv: 0, kills: 0, dmg: 0, place: 0, dirty: true, sock };
}
function pickSpawns(n) {
  const pts = []; let tries = 0;
  while (pts.length < n && tries < 600) { tries++; const q = MAP.spawns[(Math.random() * MAP.spawns.length) | 0]; if (pts.every(p => Math.hypot(p.x - q.x, p.y - q.y) > (tries < 300 ? 350 : 120))) pts.push({ x: q.x, y: q.y }); }
  while (pts.length < n) pts.push(MAP.randFree());
  return pts;
}
function putLoot(r, it, x, y) {
  it.id = r.lootId++; const a = Math.random() * 6.283, d = rnd(14, 34); it.x = x + Math.cos(a) * d; it.y = y + Math.sin(a) * d;
  r.loot.set(it.id, it); r.ev.push(['la', it]);
}
function startGame(r) {
  const mem = [...r.members.values()];
  Object.assign(r, { state: 'playing', players: new Map(), bullets: [], nades: [], loot: new Map(), ev: [], lootId: 1, tickN: 0, cd: 3.5, t0: Date.now(), wave: 0, waveT: 2, zid: 1, autoT: null });
  const nBots = r.mode === 'training' ? MAX - mem.length : 0;
  const sp = pickSpawns(mem.length + nBots);
  mem.forEach((m, i) => {
    const team = r.mode === 'teams' ? i % 2 + 1 : r.mode === 'survival' ? 1 : i + 1;
    r.players.set(m.id, mk(m.id, m.name, m.char, team, 'human', sp[i].x, sp[i].y, io.sockets.sockets.get(m.id)));
  });
  for (let i = 0; i < nBots; i++) { const b = mk('b' + i, BOTN[i % BOTN.length], (Math.random() * 8) | 0, 100 + i, 'bot', sp[mem.length + i].x, sp[mem.length + i].y, null); r.players.set(b.id, b); }
  for (const s of MAP.lootSpots) { for (let k = 0; k < (Math.random() < 0.5 ? 2 : 1); k++) { const it = rollLoot(); it.id = r.lootId++; it.x = s.x + rnd(-14, 14); it.y = s.y + rnd(-14, 14); r.loot.set(it.id, it); } }
  for (let i = 0; i < 120; i++) { const q = MAP.randFree(), it = rollLoot(); it.id = r.lootId++; it.x = q.x; it.y = q.y; r.loot.set(it.id, it); }
  zoneInit(r);
  const roster = [...r.players.values()].map(p => ({ id: p.id, name: p.name, char: p.char, team: p.team, kind: p.kind }));
  const loot = [...r.loot.values()];
  for (const m of mem) { const s = io.sockets.sockets.get(m.id); if (s) s.emit('game:start', { mode: r.mode, you: m.id, roster, loot, cd: r.cd }); }
}

/* ---------- Zona segura ---------- */
function zoneInit(r) {
  const z = { cx: 1500, cy: 1500, r: 2150, ph: 0, st: 'wait', t: PH[0].w, tcx: 1500, tcy: 1500, tr: PH[0].r, fcx: 1500, fcy: 1500, fr: 2150, dmg: PH[0].d };
  if (r.mode === 'survival') { z.r = 1e5; z.st = 'off'; }
  r.zone = z; if (z.st !== 'off') planNext(z);
}
function planNext(z) { const p = PH[z.ph]; z.tr = p.r; const a = Math.random() * 6.283, off = Math.random() * Math.max(0, z.r - p.r) * 0.8; z.tcx = z.cx + Math.cos(a) * off; z.tcy = z.cy + Math.sin(a) * off; z.dmg = p.d; }
function zoneTick(r) {
  const z = r.zone; if (z.st === 'off' || z.st === 'hold') return; z.t -= DT;
  if (z.st === 'wait') { if (z.t <= 0) { z.st = 'shrink'; z.t = PH[z.ph].s; z.fcx = z.cx; z.fcy = z.cy; z.fr = z.r; } }
  else {
    const k = 1 - Math.max(0, z.t) / PH[z.ph].s;
    z.cx = z.fcx + (z.tcx - z.fcx) * k; z.cy = z.fcy + (z.tcy - z.fcy) * k; z.r = z.fr + (z.tr - z.fr) * k;
    if (z.t <= 0) { z.cx = z.tcx; z.cy = z.tcy; z.r = z.tr; if (z.ph >= PH.length - 1) z.st = 'hold'; else { z.ph++; z.st = 'wait'; z.t = PH[z.ph].w; planNext(z); } }
  }
}

/* ---------- Acciones ---------- */
function switchTo(p, i) { if (i < 0 || i > 1 || p.inv.cur === i) return; p.inv.cur = i; p.reloadT = 0; p.dirty = true; }
function startReload(p) {
  const w = p.inv.cw(); if (!w || p.reloadT > 0 || p.healT > 0) return; const wd = W[w.k];
  if (w.mag >= wd.mag || p.inv.ammo[wd.ammo] <= 0) return; p.reloadT = wd.reload;
}
function finishReload(p) {
  const w = p.inv.cw(); if (!w) return; const wd = W[w.k]; const take = Math.min(wd.mag - w.mag, p.inv.ammo[wd.ammo]);
  w.mag += take; p.inv.ammo[wd.ammo] -= take; p.dirty = true;
}
function healStart(p) { if (p.inv.meds > 0 && p.hp < p.max && p.healT <= 0 && p.reloadT <= 0) p.healT = 1.6; }
function pickup(r, p) {
  let best = null, bd = 75 * 75;
  for (const it of r.loot.values()) { const d = (it.x - p.x) ** 2 + (it.y - p.y) ** 2; if (d < bd) { bd = d; best = it; } }
  if (!best) return false;
  const res = p.inv.pick(best); if (!res.ok) return false;
  r.loot.delete(best.id); r.ev.push(['lr', best.id]); res.drops.forEach(it => putLoot(r, it, p.x, p.y)); p.dirty = true; p.reloadT = 0; return true;
}
function dropAll(r, p) {
  const inv = p.inv, out = [];
  for (const s of inv.slots) if (s) out.push({ type: 'weapon', key: s.k, mag: s.mag });
  for (const k in inv.ammo) if (inv.ammo[k] > 0) out.push({ type: 'ammo', key: k, amt: inv.ammo[k] });
  if (inv.meds) out.push({ type: 'med', amt: inv.meds }); if (inv.nades) out.push({ type: 'nade', amt: inv.nades }); if (inv.armor > 0) out.push({ type: 'vest' });
  p.inv = new Inventory(); out.forEach(it => putLoot(r, it, p.x, p.y));
}
function throwNade(r, p, d) {
  if (p.inv.nades <= 0 || p.nadeCd > 0 || p.healT > 0) return;
  p.inv.nades--; p.nadeCd = 1; p.dirty = true;
  r.nades.push({ x: p.x, y: p.y, a: p.a, dist: Math.max(60, Math.min(GR.range, d)), tr: 0, t: GR.fuse, own: p.id });
}
function damage(r, t, amt, att, wn) {
  if (!t.alive) return;
  if (att && att !== t && att.team === t.team) return;
  let a = amt;
  if (t.inv.armor > 0) { const ab = Math.min(t.inv.armor, a * 0.5); t.inv.armor -= ab; a -= ab; }
  t.hp -= a; if (att && att !== t) att.dmg += amt; t.dirty = true;
  if (t.hp <= 0) kill(r, t, att, wn);
}
function kill(r, p, att, wn) {
  if (!p.alive) return; p.alive = false; p.hp = 0;
  const by = att && att !== p ? att : null; if (by) by.kills++;
  r.ev.push(['k', by ? by.name : '', p.name, wn || 'zona']);
  if (p.kind === 'zombie') return;
  let al = 0; for (const q of r.players.values()) if (q.alive && q.kind !== 'zombie') al++;
  p.place = al + 1; dropAll(r, p);
  if (p.sock) p.sock.emit('dead', { place: p.place, by: by ? by.name : null });
}
function melee(r, p, wd) {
  p.fireCd = wd.interval; p.flash = 0.1; let best = null, bd = 1e9;
  for (const q of r.players.values()) {
    if (!q.alive || q === p || q.team === p.team) continue;
    const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy); if (d > wd.range || d >= bd) continue;
    let da = Math.abs(Math.atan2(dy, dx) - p.a); if (da > Math.PI) da = 2 * Math.PI - da; if (da > 1.1 && d > 20) continue;
    bd = d; best = q;
  }
  if (best) { damage(r, best, p.kind === 'zombie' ? p.zd : wd.dmg, p, p.kind === 'zombie' ? 'infectado' : 'Puños'); r.ev.push(['h', best.x, best.y, 1]); }
}
function tryFire(r, p) {
  if (p.fireCd > 0 || p.reloadT > 0 || p.healT > 0) return;
  const w = p.inv.cw(), wd = p.inv.wdef();
  if (!w) return melee(r, p, wd);
  if (w.mag <= 0) return startReload(p);
  w.mag--; p.fireCd = wd.interval; p.flash = 0.08; p.dirty = true;
  for (let i = 0; i < wd.pellets; i++) {
    const a = p.a + (Math.random() - 0.5) * 2 * wd.spread;
    r.bullets.push({ x: p.x, y: p.y, vx: Math.cos(a) * wd.speed, vy: Math.sin(a) * wd.speed, a, d: 0, range: wd.range, dmg: wd.dmg, own: p.id, wn: wd.name });
  }
  r.ev.push(['s', Math.round(p.x), Math.round(p.y), +p.a.toFixed(2), w.k]);
  if (w.mag <= 0 && p.inv.ammo[wd.ammo] > 0) startReload(p);
}

/* ---------- Bots (entrenamiento) e infectados (supervivencia) ---------- */
function nearestEnemy(r, p, range) {
  let best = null, bd = range * range;
  for (const q of r.players.values()) { if (!q.alive || q === p || q.team === p.team) continue; const d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2; if (d < bd) { bd = d; best = q; } }
  return best;
}
function findLoot(r, p, range) {
  if (range <= 0) return null; let best = null, bd = range * range; const inv = p.inv;
  const want = new Set(); inv.slots.forEach(s => { if (s) want.add(W[s.k].ammo); });
  for (const it of r.loot.values()) {
    const d = (it.x - p.x) ** 2 + (it.y - p.y) ** 2; if (d >= bd) continue;
    const good = (it.type === 'weapon' && (inv.slots.includes(null) || Math.random() < 0.02)) || (it.type === 'ammo' && want.has(it.key) && inv.ammo[it.key] < 60) || (it.type === 'med' && inv.meds < 3) || (it.type === 'vest' && inv.armor < 50) || (it.type === 'nade' && inv.nades < 3);
    if (good) { bd = d; best = it; }
  }
  return best;
}
function botThink(r, p) {
  const ai = p.ai || (p.ai = { t: 0, tx: p.x, ty: p.y, tg: null, lx: p.x, ly: p.y, st: 0, jt: 0, jd: 0, rx: 0, sd: 1, last: null, pk: 0 });
  const z = r.zone, zom = p.kind === 'zombie', hasW = p.inv.slots.some(Boolean);
  ai.t -= DT; ai.jt -= DT; ai.st -= DT; ai.pk -= DT;
  if (ai.t <= 0) {
    ai.t = 0.3 + Math.random() * 0.3;
    ai.tg = nearestEnemy(r, p, zom ? 6000 : (hasW ? 560 : 200));
    if (!ai.tg && !zom) {
      const out = z.r < 5000 && Math.hypot(p.x - z.cx, p.y - z.cy) > z.r - 100;
      const L = findLoot(r, p, out ? 0 : 520);
      if (out) { ai.tx = z.cx + rnd(-50, 50); ai.ty = z.cy + rnd(-50, 50); }
      else if (L) { ai.tx = L.x; ai.ty = L.y; }
      else if (Math.hypot(ai.tx - p.x, ai.ty - p.y) < 50 || Math.random() < 0.1) {
        const a = Math.random() * 6.283, d = Math.random() * Math.min(z.r, 700) * 0.9, cx = z.r < 5000 ? z.cx : 1500, cy = z.r < 5000 ? z.cy : 1500;
        ai.tx = Math.max(60, Math.min(2940, cx + Math.cos(a) * d)); ai.ty = Math.max(60, Math.min(2940, cy + Math.sin(a) * d));
      }
    }
  }
  let dx = 0, dy = 0, run = 0; p.in.f = false; const tg = ai.tg;
  if (tg !== ai.last) { ai.last = tg; ai.rx = 0.4; } ai.rx -= DT;
  if (tg && tg.alive) {
    const ex = tg.x - p.x, ey = tg.y - p.y, d = Math.hypot(ex, ey) || 1, wd = p.inv.wdef(), w = p.inv.cw();
    p.a = Math.atan2(ey, ex) + (zom ? 0 : (Math.random() - 0.5) * 0.2);
    if (zom) { dx = ex / d; dy = ey / d; run = 1; if (d < 34) p.in.f = true; }
    else {
      const los = MAP.segHit(p.x, p.y, tg.x, tg.y) > 1;
      if (ai.rx <= 0) { if (w && los && d < wd.range * 0.9) p.in.f = true; if (!w && d < 44) p.in.f = true; }
      const want = w ? Math.min(wd.range * 0.6, 300) : 0;
      if (d > want || !los) { dx = ex / d; dy = ey / d; } else { dx = -ey / d * ai.sd; dy = ex / d * ai.sd; if (Math.random() < 0.01) ai.sd = -ai.sd; }
      run = d > want + 100 ? 1 : 0;
      if (p.inv.nades > 0 && d > 150 && d < 340 && los && Math.random() < 0.004) throwNade(r, p, d);
    }
  } else if (!zom) {
    const ex = ai.tx - p.x, ey = ai.ty - p.y, d = Math.hypot(ex, ey);
    if (d > 8) { dx = ex / d; dy = ey / d; p.a = Math.atan2(dy, dx); } run = 1;
    if (d < 60 && ai.pk <= 0) { pickup(r, p); ai.pk = 0.5; }
  }
  const w = p.inv.cw();
  if (w && w.mag <= 0 && p.inv.ammo[W[w.k].ammo] <= 0) { const o = 1 - p.inv.cur; if (p.inv.slots[o]) switchTo(p, o); }
  if (!zom && p.hp < 55 && p.inv.meds > 0 && !(tg && tg.alive)) healStart(p);
  if (ai.st <= 0) { ai.st = 0.6; if ((dx || dy) && Math.hypot(p.x - ai.lx, p.y - ai.ly) < 6) { ai.jt = 0.5; ai.jd = Math.random() * 6.283; } ai.lx = p.x; ai.ly = p.y; }
  if (ai.jt > 0) { dx = Math.cos(ai.jd); dy = Math.sin(ai.jd); }
  p.mv = PL.step(MAP, p, dx, dy, run, zom ? p.spd : 1);
  if (p.in.f) tryFire(r, p);
}
function waves(r) {
  let z = 0; for (const p of r.players.values()) if (p.kind === 'zombie' && p.alive) z++;
  if (z > 0) return; r.waveT -= DT; if (r.waveT > 0) return;
  r.wave++; r.waveT = 6;
  const hs = [...r.players.values()].filter(p => p.kind === 'human' && p.alive), n = Math.min(36, 5 + r.wave * 3);
  for (let i = 0; i < n; i++) {
    let q, t = 0; do { q = MAP.randFree(); t++; } while (t < 20 && hs.some(h => Math.hypot(h.x - q.x, h.y - q.y) < 600));
    const zb = mk('z' + r.zid++, 'Infectado', 0, 99, 'zombie', q.x, q.y, null);
    zb.max = zb.hp = 40 + r.wave * 8; zb.zd = 8 + r.wave; zb.spd = 0.5 + Math.min(0.35, r.wave * 0.03); r.players.set(zb.id, zb);
  }
  r.ev.push(['w', r.wave]);
}

/* ---------- Bucle de juego ---------- */
function tickRoom(r) {
  r.tickN++;
  const all = [...r.players.values()];
  if (r.cd > 0) { r.cd -= DT; for (const p of all) if (p.kind === 'human') { p.q.length = 0; } sendSnap(r); return; }
  zoneTick(r); if (r.mode === 'survival') waves(r);
  const z = r.zone;
  for (const p of all) {
    if (!p.alive) continue;
    if (p.fireCd > 0) p.fireCd -= DT; if (p.flash > 0) p.flash -= DT; if (p.nadeCd > 0) p.nadeCd -= DT;
    if (p.reloadT > 0) { p.reloadT -= DT; if (p.reloadT <= 0) finishReload(p); }
    if (p.healT > 0) { p.healT -= DT; if (p.healT <= 0) { p.hp = Math.min(p.max, p.hp + 50); p.inv.meds--; p.dirty = true; } }
    if (p.kind === 'human') {
      let n = p.q.length > 3 ? 2 : 1, moved = 0;
      while (n-- && p.q.length) { const i = p.q.shift(); moved = PL.step(MAP, p, i.x, i.y, i.r); p.sq = i.s; }
      p.mv = moved; if (p.in.f) tryFire(r, p);
    } else botThink(r, p);
    if (!p.alive) continue;
    if (z.r < 5000 && p.kind !== 'zombie' && Math.hypot(p.x - z.cx, p.y - z.cy) > z.r) { p.hp -= z.dmg * DT; p.dirty = true; if (p.hp <= 0) kill(r, p, null, 'zona'); }
  }
  /* Balas */
  for (let i = r.bullets.length - 1; i >= 0; i--) {
    const b = r.bullets[i], nx = b.x + b.vx * DT, ny = b.y + b.vy * DT, own = r.players.get(b.own);
    let tb = MAP.segHit(b.x, b.y, nx, ny), hit = null;
    for (const p of r.players.values()) {
      if (!p.alive || p.id === b.own || (own && own.team === p.team)) continue;
      const t = GM.segCircle(b.x, b.y, nx, ny, p.x, p.y, PL.RADIUS); if (t < tb) { tb = t; hit = p; }
    }
    if (tb <= 1) { if (hit) damage(r, hit, b.dmg, own, b.wn); r.ev.push(['h', Math.round(b.x + (nx - b.x) * tb), Math.round(b.y + (ny - b.y) * tb), hit ? 1 : 0]); r.bullets.splice(i, 1); }
    else { b.x = nx; b.y = ny; b.d += Math.hypot(b.vx, b.vy) * DT; if (b.d >= b.range) r.bullets.splice(i, 1); }
  }
  /* Granadas */
  for (let i = r.nades.length - 1; i >= 0; i--) {
    const n = r.nades[i]; n.t -= DT;
    if (n.tr < n.dist) { const st = Math.min(GR.speed * DT, n.dist - n.tr), nx = n.x + Math.cos(n.a) * st, ny = n.y + Math.sin(n.a) * st; if (MAP.segHit(n.x, n.y, nx, ny) > 1) { n.x = nx; n.y = ny; n.tr += st; } else n.tr = n.dist; }
    if (n.t <= 0) {
      const own = r.players.get(n.own); r.ev.push(['x', Math.round(n.x), Math.round(n.y), GR.radius]);
      for (const p of [...r.players.values()]) {
        if (!p.alive) continue; const d = Math.hypot(p.x - n.x, p.y - n.y); if (d > GR.radius || MAP.segHit(n.x, n.y, p.x, p.y) <= 1) continue;
        damage(r, p, GR.dmg * (1 - 0.8 * d / GR.radius), own, GR.name);
      }
      r.nades.splice(i, 1);
    }
  }
  for (const [id, p] of r.players) if (p.kind === 'zombie' && !p.alive) r.players.delete(id);
  checkEnd(r);
  if (r.state === 'playing') sendSnap(r);
}
function checkEnd(r) {
  if (r.state !== 'playing') return;
  const pl = [...r.players.values()], hu = pl.filter(p => p.kind === 'human' && p.alive);
  if (r.mode === 'survival') { if (!hu.length) endGame(r, null); return; }
  const teams = new Set(pl.filter(p => p.alive).map(p => p.team));
  if (teams.size <= 1 || (r.mode === 'training' && !hu.length)) endGame(r, teams.size === 1 ? [...teams][0] : null);
}
function endGame(r, winTeam) {
  r.state = 'ended';
  const list = [...r.players.values()].filter(p => p.kind !== 'zombie').map(p => ({ id: p.id, name: p.name, char: p.char, team: p.team, kills: p.kills, dmg: Math.round(p.dmg), place: (winTeam != null && p.team === winTeam) ? 1 : (p.alive ? 1 : p.place), win: winTeam != null && p.team === winTeam, bot: p.kind === 'bot' }));
  list.sort((a, b) => (b.win - a.win) || (a.place - b.place) || (b.kills - a.kills));
  io.to(r.code).emit('game:end', { mode: r.mode, winTeam, results: list, wave: r.wave, dur: Math.round((Date.now() - r.t0) / 1000) });
  r.bullets = []; r.nades = [];
}
function sendSnap(r) {
  const z = r.zone, P = []; let al = 0;
  for (const p of r.players.values()) {
    if (!p.alive) continue; if (p.kind !== 'zombie') al++;
    P.push({ id: p.id, x: Math.round(p.x), y: Math.round(p.y), a: +p.a.toFixed(2), hp: Math.ceil(p.hp * 100 / p.max), ar: Math.round(p.inv.armor), w: p.inv.cw() ? p.inv.cw().k : 'fists', rl: p.reloadT > 0 ? 1 : 0, mv: p.mv, f: p.flash > 0 ? 1 : 0, hl: p.healT > 0 ? 1 : 0, sq: p.sq });
  }
  const s = { n: r.tickN, cd: Math.max(0, +r.cd.toFixed(1)), p: P, b: r.bullets.map(b => [Math.round(b.x), Math.round(b.y), +b.a.toFixed(2)]), g: r.nades.map(n => [Math.round(n.x), Math.round(n.y)]), z: [Math.round(z.cx), Math.round(z.cy), Math.round(z.r), Math.round(z.tcx), Math.round(z.tcy), Math.round(z.tr), z.st === 'shrink' ? 1 : 0, Math.max(0, Math.ceil(z.t)), z.ph], ev: r.ev, al, wv: r.wave };
  if (r.tickN % 5 === 0) s.lb = [...r.players.values()].filter(p => p.kind !== 'zombie').map(p => [p.id, p.kills, p.alive ? 1 : 0]);
  r.ev = []; io.to(r.code).emit('snap', s);
  for (const p of r.players.values()) if (p.dirty && p.sock) { p.dirty = false; p.sock.emit('inv', p.inv.toJSON()); }
}
setInterval(() => { for (const r of rooms.values()) if (r.state === 'playing') { try { tickRoom(r); } catch (e) { console.error('Error en sala', r.code, e); } } }, DT * 1000);
/* Salas públicas (JUGAR): cuenta atrás automática al haber 2 o más jugadores */
setInterval(() => {
  for (const r of rooms.values()) {
    if (!r.pub || r.state !== 'lobby') continue;
    if (r.members.size >= 2) { if (r.autoT == null) r.autoT = 20; else r.autoT--; if (r.members.size >= MAX) r.autoT = Math.min(r.autoT, 3); io.to(r.code).emit('room:timer', r.autoT); if (r.autoT <= 0) startGame(r); }
    else if (r.autoT != null) { r.autoT = null; io.to(r.code).emit('room:timer', null); }
  }
}, 1000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log('\n  BATTLE ROYALE 2D listo.\n  En esta computadora:  http://localhost:' + PORT);
  for (const list of Object.values(os.networkInterfaces())) for (const i of list) if (i.family === 'IPv4' && !i.internal) console.log('  En tu red local:      http://' + i.address + ':' + PORT);
  console.log('');
});
