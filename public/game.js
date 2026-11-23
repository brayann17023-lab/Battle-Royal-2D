'use strict';
/* BATTLE ROYALE 2D - Cliente: menús, render Canvas 2D, entrada, predicción y HUD. */
const $ = id => document.getElementById(id);
const CH = PlayerLib.CHARACTERS, PL = PlayerLib, W = Weapons.WEAPONS, AN = Weapons.AMMO_NAME, DT = PL.DT;
const MAP = GameMap.generate();
const cv = $('cv'), ctx = cv.getContext('2d'), mctx = $('mini').getContext('2d');
const cfg = { q: 1, fps: 60, vol: 0.5, showfps: false, name: '', char: 0, friends: [] };
try { Object.assign(cfg, JSON.parse(localStorage.getItem('br2d') || '{}')); } catch (e) { }
const save = () => { try { localStorage.setItem('br2d', JSON.stringify(cfg)); } catch (e) { } };
/* Calidad: resolución interna, partículas, texturas de suelo, sombras, temblor de pantalla */
const QS = [{ res: .6, parts: 14, pat: 0, shadow: 0, shake: 0 }, { res: .8, parts: 45, pat: 1, shadow: 1, shake: 0 }, { res: 1, parts: 110, pat: 1, shadow: 1, shake: 1 }];
const MODES = [['solo', 'Battle Royale individual', 'Todos contra todos. Gana el último en pie (2 a 10 jugadores).'], ['teams', 'Equipos 5 contra 5', 'Dos equipos; gana el que elimine al otro (2 a 10 jugadores).'], ['training', 'Entrenamiento contra bots', 'Practica con bots que completan la sala hasta 10.'], ['survival', 'Supervivencia', 'Cooperativo: resiste oleadas de infectados cada vez más fuertes.']];
const MODE_NAME = { solo: 'Battle Royale individual', teams: 'Equipos 5 contra 5', training: 'Entrenamiento contra bots', survival: 'Supervivencia' };
const ZCH = { body: '#5f7f45', trim: '#34502a', hair: '#222', hat: 'none', skin: '#9cc080' };
const S = { screen: 'menu', modal: null, room: null, id: null, mode: 'solo', roster: new Map(), pl: new Map(), loot: new Map(), bul: [], nad: [], inv: null, zone: null, cd: 0, dead: false, spec: null, pend: [], seq: 0, acc: 0, ready: false, pp: { x: 0, y: 0 }, rp: { x: 0, y: 0 }, aim: 0, lb: [], alive: 0, wave: 0, parts: [], rings: [], shake: 0, t: 0, near: null, createMode: 'solo', fstat: {}, bannerT: 0 };
const keys = {}, mouse = { x: 0, y: 0, down: false }, cam = { x: 1500, y: 1500 };
let sel = 'solo';

/* ---------- Pantallas ---------- */
function base(n) { S.screen = n; $('menu').classList.toggle('hide', n !== 'menu'); $('lobby').classList.toggle('hide', n !== 'lobby'); $('hud').classList.toggle('hide', n !== 'game'); modal(null); cv.style.display = n === 'game' ? 'block' : 'none'; if (n === 'game') resize(); }
function modal(id) { for (const m of ['create', 'join', 'chars', 'settings', 'inv', 'pause', 'results']) $(m).classList.toggle('hide', m !== id); S.modal = id; }
document.querySelectorAll('[data-back]').forEach(b => b.onclick = () => modal(null));
function say(t) { $('msg').textContent = t || ''; }
function myName() { const n = $('pname').value.trim() || 'Jugador'; cfg.name = n; save(); return n; }

/* ---------- Audio (WebAudio, sin archivos) ---------- */
let ac = null, nb = null, sndN = 0;
function initAudio() { if (ac) return; try { ac = new (window.AudioContext || window.webkitAudioContext)(); nb = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate); const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } catch (e) { ac = null; } }
function snd(kind, x, y) {
  if (!ac || cfg.vol <= 0 || sndN > 5) return; const dist = Math.hypot(x - cam.x, y - cam.y); if (dist > 1000) return;
  sndN++; const v = cfg.vol * (1 - dist / 1000), dur = kind === 'boom' ? 0.45 : kind === 'shotgun' ? 0.22 : 0.12;
  const g = ac.createGain(), f = ac.createBiquadFilter(), s = ac.createBufferSource(); s.buffer = nb; f.type = 'lowpass';
  f.frequency.value = kind === 'boom' ? 350 : kind === 'shotgun' ? 1500 : kind === 'sniper' ? 900 : 2800;
  g.gain.setValueAtTime(v * (kind === 'boom' ? 1.2 : 0.55), ac.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
  s.connect(f); f.connect(g); g.connect(ac.destination); s.start(); s.stop(ac.currentTime + dur);
}

/* ---------- Dibujo de personajes ---------- */
function drawChar(c, ch, o) {
  c.save(); c.rotate(o.a || 0);
  const wd = W[o.w || 'fists'], armed = o.w && o.w !== 'fists', ph = o.mv ? Math.sin((o.t || 0) * (o.mv === 2 ? 17 : 11)) : 0, skin = ch.skin || '#f2c9a0';
  c.fillStyle = ch.trim; c.beginPath(); c.arc(-2, -7 + ph * 5, 5, 0, 7); c.arc(-2, 7 - ph * 5, 5, 0, 7); c.fill();           // pies (animación de caminar/correr)
  if (armed) { c.fillStyle = wd.col; c.fillRect(8, -3, wd.len, 6); c.fillStyle = '#111'; c.fillRect(8 + wd.len - 3, -2, 3, 4); }
  c.fillStyle = skin; c.beginPath();
  if (armed) { c.arc(11, -5, 4, 0, 7); c.arc(8 + Math.min(wd.len, 14), 4, 4, 0, 7); } else { const e = o.f ? 9 : 0; c.arc(11 + e, -7, 4.5, 0, 7); c.arc(11 + (o.f ? 0 : 3), 7, 4.5, 0, 7); }
  c.fill();
  c.fillStyle = ch.body; c.beginPath(); c.arc(0, 0, 13, 0, 7); c.fill(); c.lineWidth = 2; c.strokeStyle = ch.trim; c.stroke();
  c.fillStyle = skin; c.beginPath(); c.arc(2, 0, 7, 0, 7); c.fill();
  switch (ch.hat) {
    case 'cap': c.fillStyle = ch.trim; c.beginPath(); c.arc(1, 0, 7.5, 0, 7); c.fill(); c.fillStyle = ch.body; c.fillRect(6, -4, 6, 8); break;
    case 'beanie': c.fillStyle = ch.body; c.beginPath(); c.arc(1, 0, 7.8, 0, 7); c.fill(); c.strokeStyle = ch.trim; c.lineWidth = 2; c.stroke(); c.fillStyle = '#fff'; c.beginPath(); c.arc(1, 0, 2.6, 0, 7); c.fill(); break;
    case 'mohawk': c.fillStyle = ch.hair; c.fillRect(-6, -2.5, 14, 5); break;
    case 'helmet': c.fillStyle = '#6b7a5a'; c.beginPath(); c.arc(1, 0, 8.6, 0, 7); c.fill(); c.strokeStyle = ch.trim; c.lineWidth = 2; c.stroke(); break;
    case 'hood': c.fillStyle = ch.trim; c.beginPath(); c.arc(0, 0, 9, 0, 7); c.fill(); c.fillStyle = skin; c.beginPath(); c.arc(4, 0, 4, 0, 7); c.fill(); break;
    case 'bun': c.fillStyle = ch.hair; c.beginPath(); c.arc(0, 0, 7.6, 0, 7); c.fill(); c.beginPath(); c.arc(-9, 0, 4.2, 0, 7); c.fill(); break;
    case 'headband': c.fillStyle = ch.hair; c.beginPath(); c.arc(-1, 0, 6, 0, 7); c.fill(); c.strokeStyle = '#ff3b3b'; c.lineWidth = 3; c.beginPath(); c.arc(2, 0, 7, 0, 7); c.stroke(); break;
    case 'visor': c.fillStyle = ch.hair; c.beginPath(); c.arc(1, 0, 7.6, 0, 7); c.fill(); c.fillStyle = 'rgba(60,200,255,.85)'; c.fillRect(5, -6, 4, 12); break;
  }
  if (o.f && armed) { c.fillStyle = '#ffd35a'; c.beginPath(); c.arc(8 + wd.len + 5, 0, 5 + Math.random() * 3, 0, 7); c.fill(); }
  c.restore();
}

/* ---------- Dibujo del mapa ---------- */
const PATS = []; let patsReady = false;
function makePats() {
  const defs = [['#6f747a', ['#5a5f65', '#858a91']], ['#3f7d3a', ['#2f6a2c', '#58983f']], ['#8ab35a', ['#76a04a', '#a0c46c']], ['#6b6f4a', ['#575b3a', '#7e8358']], ['#77716a', ['#625d57', '#8b857d']], ['#7fb069', ['#6a9c56', '#94c47e']]];
  defs.forEach(([b, dots], i) => {
    const c = document.createElement('canvas'); c.width = c.height = 96; const g = c.getContext('2d'); g.fillStyle = b; g.fillRect(0, 0, 96, 96); let s = 12345 + i * 77; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < 46; k++) { g.fillStyle = dots[k % 2]; g.globalAlpha = .45; g.fillRect(r() * 96, r() * 96, 2 + r() * 4, 2 + r() * 4); }
    PATS[i] = ctx.createPattern(c, 'repeat');
  }); patsReady = true;
}
const CONT = ['#c0392b', '#2980b9', '#27ae60', '#d68910'];
function drawWorld(vx, vy, vw, vh, q) {
  const vis = (x, y, w, h) => x < vx + vw && x + w > vx && y < vy + vh && y + h > vy;
  if (q.pat && !patsReady) makePats();
  for (const z of MAP.zones) if (vis(z.x, z.y, z.w, z.h)) { ctx.fillStyle = q.pat ? PATS[z.id] : z.g; ctx.fillRect(z.x, z.y, z.w, z.h); }
  const L = MAP.lake; if (vis(L.cx - L.rx - 20, L.cy - L.ry - 20, L.rx * 2 + 40, L.ry * 2 + 40)) {
    ctx.fillStyle = '#d8c58a'; ctx.beginPath(); ctx.ellipse(L.cx, L.cy, L.rx + 16, L.ry + 16, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#3a86c8'; ctx.beginPath(); ctx.ellipse(L.cx, L.cy, L.rx, L.ry, 0, 0, 7); ctx.fill();
    if (q.pat) { ctx.fillStyle = 'rgba(255,255,255,.10)'; ctx.beginPath(); ctx.ellipse(L.cx - 40, L.cy - 30, L.rx * .6, L.ry * .55, 0, 0, 7); ctx.fill(); }
  }
  ctx.fillStyle = '#43464b'; for (const r of MAP.roads) if (vis(r.x, r.y, r.w, r.h)) ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = '#cdbf5a'; ctx.lineWidth = 3; ctx.setLineDash([30, 26]); ctx.beginPath(); ctx.moveTo(0, 1500); ctx.lineTo(3000, 1500); ctx.moveTo(1000, 0); ctx.lineTo(1000, 3000); ctx.moveTo(2000, 0); ctx.lineTo(2000, 3000); ctx.stroke(); ctx.setLineDash([]);
  ctx.font = 'bold 56px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,.13)';
  for (const z of MAP.zones) if (vis(z.x, z.y, z.w, z.h)) ctx.fillText(z.n.toUpperCase(), z.x + z.w / 2, z.y + 90);
  for (const b of MAP.buildings) if (vis(b.x, b.y, b.w, b.h)) { ctx.fillStyle = b.col; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.fillRect(b.x + 12, b.y + 12, b.w - 24, b.h - 24); }
  MAP.crates.forEach((c, i) => {
    if (!vis(c.x, c.y, c.w, c.h)) return; const big = c.w > 60;
    ctx.fillStyle = big ? CONT[i % 4] : '#a9793a'; ctx.fillRect(c.x, c.y, c.w, c.h); ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 2; ctx.strokeRect(c.x + 1, c.y + 1, c.w - 2, c.h - 2);
    ctx.beginPath(); if (big) { for (let x = c.x + 10; x < c.x + c.w; x += 10) { ctx.moveTo(x, c.y); ctx.lineTo(x, c.y + c.h); } } else { ctx.moveTo(c.x, c.y); ctx.lineTo(c.x + c.w, c.y + c.h); ctx.moveTo(c.x + c.w, c.y); ctx.lineTo(c.x, c.y + c.h); } ctx.stroke();
  });
  ctx.fillStyle = '#2b2f36'; for (const c of MAP.cols) if (c.w !== undefined && !c.c && vis(c.x, c.y, c.w, c.h)) ctx.fillRect(c.x, c.y, c.w, c.h);
}
function drawTrees(vx, vy, vw, vh, q) {
  ctx.globalAlpha = .92;
  for (const t of MAP.trees) {
    if (t.x < vx - 40 || t.x > vx + vw + 40 || t.y < vy - 40 || t.y > vy + vh + 40) continue;
    const f = t.x > 1000 && t.x < 2000 && t.y < 1500;
    ctx.fillStyle = f ? '#256b2a' : '#2f7d32'; ctx.beginPath(); ctx.arc(t.x, t.y, f ? 36 : 30, 0, 7); ctx.fill();
    if (q.shadow) { ctx.fillStyle = f ? '#3a8f3c' : '#43a047'; ctx.beginPath(); ctx.arc(t.x - 7, t.y - 8, f ? 19 : 15, 0, 7); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
}
function drawLoot(it) {
  ctx.save(); ctx.translate(it.x, it.y);
  if (it.type === 'weapon') { const w = W[it.key]; ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(-13, -7, 26, 14); ctx.fillStyle = w.col; ctx.fillRect(-11, -4, 22, 8); ctx.fillStyle = '#fff'; ctx.fillRect(-11, -4, 22, 2); }
  else if (it.type === 'ammo') { ctx.fillStyle = '#e8b830'; ctx.fillRect(-7, -5, 14, 10); ctx.fillStyle = '#7a5a10'; ctx.fillRect(-5, -2, 10, 4); }
  else if (it.type === 'med') { ctx.fillStyle = '#fff'; ctx.fillRect(-8, -8, 16, 16); ctx.fillStyle = '#e03030'; ctx.fillRect(-2, -6, 4, 12); ctx.fillRect(-6, -2, 12, 4); }
  else if (it.type === 'nade') { ctx.fillStyle = '#3b5d2e'; ctx.beginPath(); ctx.arc(0, 1, 6, 0, 7); ctx.fill(); ctx.fillStyle = '#ccc'; ctx.fillRect(-1, -8, 3, 4); }
  else if (it.type === 'vest') { ctx.fillStyle = '#4aa3ff'; ctx.fillRect(-7, -8, 14, 16); ctx.fillStyle = '#1e5a96'; ctx.fillRect(-7, -1, 14, 3); }
  if (S.near === it) { ctx.strokeStyle = '#ffc12e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 16, 0, 7); ctx.stroke(); }
  ctx.restore();
}
function lootName(it) { return it.type === 'weapon' ? W[it.key].name : it.type === 'ammo' ? AN[it.key] + ' x' + it.amt : it.type === 'med' ? 'Botiquín' + (it.amt > 1 ? ' x' + it.amt : '') : it.type === 'nade' ? 'Granada' + (it.amt > 1 ? ' x' + it.amt : '') : 'Chaleco antibalas'; }

/* ---------- Estado de partida ---------- */
function particles(x, y, n, cols, sp) {
  const max = QS[cfg.q].parts; n = Math.min(n, 5 + max / 6);
  for (let i = 0; i < n && S.parts.length < max; i++) { const a = Math.random() * 6.283, v = (30 + Math.random() * sp); S.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: .3 + Math.random() * .3, m: .6, c: cols[i % cols.length], s: 2 + Math.random() * 2 }); }
}
function feed(t) { const f = $('feed'), d = document.createElement('div'); d.textContent = t; f.appendChild(d); while (f.children.length > 5) f.removeChild(f.firstChild); setTimeout(() => d.remove(), 6000); }
function handleEv(e) {
  switch (e[0]) {
    case 's': snd(e[4] === 'shotgun' ? 'shotgun' : e[4] === 'sniper' ? 'sniper' : 'shot', e[1], e[2]); break;
    case 'h': particles(e[1], e[2], e[3] ? 5 : 3, e[3] ? ['#c0201c', '#ff5a36'] : ['#ddd', '#ffd35a'], 120); break;
    case 'x': S.rings.push({ x: e[1], y: e[2], r: e[3], t: 0 }); particles(e[1], e[2], 18, ['#ff8a1c', '#ffd35a', '#555'], 260); snd('boom', e[1], e[2]); if (QS[cfg.q].shake && Math.hypot(e[1] - cam.x, e[2] - cam.y) < 500) S.shake = 10; break;
    case 'k': feed(e[1] ? e[1] + ' eliminó a ' + e[2] + ' (' + e[3] + ')' : e[2] + (e[3] === 'zona' ? ' cayó fuera de la zona' : ' se desconectó')); break;
    case 'la': S.loot.set(e[1].id, e[1]); break;
    case 'lr': S.loot.delete(e[1]); break;
    case 'w': S.bannerT = 3; S.bannerText = 'OLEADA ' + e[1]; break;
  }
}
function handleSnap(s) {
  S.cd = s.cd; S.zone = s.z; S.alive = s.al; S.wave = s.wv; S.bul = s.b; S.nad = s.g; if (s.lb) S.lb = s.lb;
  const seen = new Set();
  for (const q of s.p) {
    seen.add(q.id); let e = S.pl.get(q.id);
    if (!e) { e = { id: q.id, rx: q.x, ry: q.y, ra: q.a }; S.pl.set(q.id, e); }
    e.x = q.x; e.y = q.y; e.ta = q.a; e.hp = q.hp; e.ar = q.ar; e.w = q.w; e.rl = q.rl; e.mv = q.mv; e.f = q.f; e.hl = q.hl; e.sq = q.sq;
  }
  for (const id of [...S.pl.keys()]) if (!seen.has(id)) S.pl.delete(id);
  const me = S.pl.get(S.id);
  if (me && !S.dead) {                         // reconciliación: posición del servidor + entradas aún no confirmadas
    const p = { x: me.x, y: me.y }; S.pend = S.pend.filter(i => i.s > me.sq); for (const i of S.pend) PL.step(MAP, p, i.x, i.y, i.r);
    if (!S.ready || Math.hypot(p.x - S.pp.x, p.y - S.pp.y) > 120) { S.rp.x = p.x; S.rp.y = p.y; }
    S.pp.x = p.x; S.pp.y = p.y; S.ready = true;
  }
  s.ev.forEach(handleEv); updateHud();
}
function updateHud() {
  const me = S.pl.get(S.id), hp = me ? me.hp : 0;
  $('hpf').style.width = hp + '%'; $('hpt').textContent = hp + ' / 100'; $('arf').style.width = (me ? me.ar : 0) + '%';
  const kl = S.lb.find(l => l[0] === S.id); $('alive').textContent = 'Vivos: ' + S.alive; $('kills').textContent = 'Eliminaciones: ' + (kl ? kl[1] : 0);
  $('zname').textContent = MAP.zoneAt(S.pp.x, S.pp.y).n;
  const z = S.zone; let zi = '';
  if (S.mode === 'survival') zi = 'Oleada ' + S.wave; else if (z[2] < 5000) zi = z[6] ? '¡La zona segura se está reduciendo!' : (z[8] === 4 && z[7] === 0 ? 'Zona final' : 'Zona segura se reduce en ' + z[7] + ' s');
  $('zinfo').textContent = zi;
  const out = z[2] < 5000 && Math.hypot(S.pp.x - z[0], S.pp.y - z[1]) > z[2]; $('warn').textContent = out && !S.dead ? '¡FUERA DE LA ZONA SEGURA!' : '';
  const inv = S.inv;
  if (inv) {
    const w = inv.s[inv.c], wd = w ? W[w.k] : W.fists;
    $('wname').textContent = wd.name + (me && me.rl ? '  (recargando…)' : '') + (me && me.hl ? '  (curando…)' : '');
    $('wammo').innerHTML = w ? w.mag + ' <small>/ ' + inv.a[wd.ammo] + '</small>' : '<small>Sin arma</small>';
    $('wextra').textContent = 'Granadas ' + inv.n + '  ·  Botiquines ' + inv.m + '  ·  [1][2] cambiar arma';
  }
  const rows = S.lb.slice().sort((a, b) => b[1] - a[1] || b[2] - a[2]).slice(0, 5);
  $('board').innerHTML = '<h4>Tabla de posiciones</h4>' + rows.map(r => { const ro = S.roster.get(r[0]); return '<div class="' + (r[0] === S.id ? 'me ' : '') + (r[2] ? '' : 'dead') + '"><span>' + (ro ? ro.name : '?') + '</span><span>' + r[1] + '</span></div>'; }).join('');
  if (S.modal === 'inv') renderInv();
  updateBanner();
}
function updateBanner() {
  let t = '';
  if (S.cd > 0) t = 'Comienza en ' + Math.ceil(S.cd);
  else if (S.dead) { const sp = S.roster.get(S.spec); t = 'Eliminado' + (S.place ? ' · puesto #' + S.place : '') + (sp ? '<br><small style="font-size:18px">Espectando a ' + sp.name + ' (clic o ← → para cambiar)</small>' : ''); }
  else if (S.bannerT > 0) t = S.bannerText;
  $('banner').innerHTML = t;
}

/* ---------- Red ---------- */
Net.on('connect', () => { Net.emit('hello', cfg.name); say(''); });
Net.on('error', () => say('No se pudo conectar al servidor.'));
Net.on('disconnect', () => { if (S.screen !== 'menu') { base('menu'); } say('Conexión perdida con el servidor.'); });
Net.on('room:update', i => { S.room = i; if (S.screen === 'lobby') renderLobby(); });
Net.on('room:timer', t => { S.timer = t; if (S.screen === 'lobby') renderLobby(); });
Net.on('inv', i => { S.inv = i; updateHud(); });
Net.on('snap', s => { if (S.screen === 'game') handleSnap(s); });
Net.on('dead', d => { S.dead = true; S.place = d.place; S.pend = []; S.spec = null; pickSpec(0); updateBanner(); });
Net.on('game:start', d => {
  Object.assign(S, { id: d.you, mode: d.mode, roster: new Map(d.roster.map(r => [r.id, r])), pl: new Map(), loot: new Map(d.loot.map(i => [i.id, i])), bul: [], nad: [], inv: null, zone: [0, 0, 1e5, 0, 0, 1e5, 0, 0, 0], cd: d.cd, dead: false, spec: null, place: 0, pend: [], seq: 0, acc: 0, ready: false, parts: [], rings: [], lb: [], alive: d.roster.length, wave: 0, bannerT: 0 });
  $('feed').innerHTML = ''; base('game'); updateBanner(); initAudio();
});
Net.on('game:end', d => {
  const me = d.results.find(r => r.id === S.id);
  $('rtitle').textContent = d.mode === 'survival' ? 'Fin de la supervivencia · Oleada ' + d.wave : (me && me.win ? '¡VICTORIA!' : (d.mode === 'teams' && d.winTeam ? 'Ganó el equipo ' + d.winTeam : 'Partida terminada'));
  $('rsub').textContent = MODE_NAME[d.mode] + ' · duración ' + Math.floor(d.dur / 60) + ':' + String(d.dur % 60).padStart(2, '0') + (me && d.mode !== 'survival' ? ' · tu puesto: #' + me.place : '');
  $('rtable').innerHTML = '<table><tr><th>#</th><th>Jugador</th>' + (d.mode === 'teams' ? '<th>Equipo</th>' : '') + '<th>Elim.</th><th>Daño</th></tr>' + d.results.map((r, i) => '<tr class="' + (r.id === S.id ? 'me' : '') + '"><td>' + (d.mode === 'survival' ? i + 1 : r.place) + '</td><td>' + r.name + (r.bot ? ' (bot)' : '') + '</td>' + (d.mode === 'teams' ? '<td>' + r.team + '</td>' : '') + '<td>' + r.kills + '</td><td>' + r.dmg + '</td></tr>').join('') + '</table>';
  modal('results');
});

/* ---------- Menú, salas y amigos ---------- */
function enterLobby(res, errEl) { if (!res || !res.ok) { (errEl || $('msg')).textContent = res ? res.err : 'Sin conexión con el servidor.'; return; } modal(null); base('lobby'); renderLobby(); }
$('pname').value = cfg.name; $('pname').onchange = () => { Net.emit('hello', myName()); };
$('bPlay').onclick = () => { initAudio(); const n = myName(); Net.emit('hello', n); say(''); if (!Net.ok) return say('Sin conexión con el servidor.'); Net.emit('quick:play', { name: n, char: cfg.char }, r => enterLobby(r)); };
$('bCreate').onclick = () => { sel = 'solo'; renderModes(); modal('create'); };
$('bCreateGo').onclick = () => { const n = myName(); Net.emit('hello', n); Net.emit('room:create', { name: n, char: cfg.char, mode: sel }, r => enterLobby(r)); };
$('bJoin').onclick = () => { $('jerr').textContent = ''; $('jcode').value = ''; modal('join'); setTimeout(() => $('jcode').focus(), 50); };
$('bJoinGo').onclick = () => { const n = myName(); Net.emit('hello', n); $('jerr').textContent = ''; Net.emit('room:join', { code: $('jcode').value, name: n, char: cfg.char }, r => enterLobby(r, $('jerr'))); };
$('jcode').onkeydown = e => { if (e.key === 'Enter') $('bJoinGo').click(); };
$('bChars').onclick = () => { renderChars(); modal('chars'); };
$('bCfg').onclick = () => { initSettings(); modal('settings'); };
function renderModes() { $('modes').innerHTML = ''; MODES.forEach(([id, n, d]) => { const el = document.createElement('div'); el.className = 'mode' + (id === sel ? ' sel' : ''); el.innerHTML = '<b>' + n + '</b><span>' + d + '</span>'; el.onclick = () => { sel = id; renderModes(); }; $('modes').appendChild(el); }); }
function miniChar(canvas, id, px) { const c = canvas.getContext('2d'); canvas.width = canvas.height = px; c.clearRect(0, 0, px, px); c.save(); c.translate(px / 2, px / 2); const k = px / 54; c.scale(k, k); drawChar(c, CH[id], { a: -0.5, w: id % 2 ? 'assault' : 'pistol', mv: 0 }); c.restore(); }
function renderChars() {
  const g = $('cgrid'); g.innerHTML = '';
  CH.forEach(ch => { const d = document.createElement('div'); d.className = 'cc' + (cfg.char === ch.id ? ' sel' : ''); const c = document.createElement('canvas'); d.appendChild(c); d.insertAdjacentHTML('beforeend', '<div>' + ch.name + '</div>'); d.onclick = () => { cfg.char = ch.id; save(); Net.emit('room:char', ch.id); renderChars(); }; g.appendChild(d); miniChar(c, ch.id, 84); });
}
function initSettings() { $('sq').value = cfg.q; $('sfps').value = cfg.fps; $('svol').value = Math.round(cfg.vol * 100); $('sshow').checked = cfg.showfps; }
$('sq').onchange = () => { cfg.q = +$('sq').value; save(); resize(); }; $('sfps').onchange = () => { cfg.fps = +$('sfps').value; save(); };
$('svol').oninput = () => { cfg.vol = $('svol').value / 100; save(); }; $('sshow').onchange = () => { cfg.showfps = $('sshow').checked; save(); $('fps').textContent = ''; };
function renderLobby() {
  const r = S.room; if (!r) return; const host = r.host === Net.id;
  $('lcode').textContent = r.code; $('lcount').textContent = r.members.length + ' / ' + r.max;
  $('lmode').innerHTML = host && !r.pub ? '<label>Modo de juego</label>' : '<span class="small">Modo:</span> ';
  if (host && !r.pub) { const s = document.createElement('select'); MODES.forEach(([id, n]) => { const o = document.createElement('option'); o.value = id; o.textContent = n; if (id === r.mode) o.selected = true; s.appendChild(o); }); s.onchange = () => Net.emit('room:mode', s.value); $('lmode').appendChild(s); }
  else $('lmode').insertAdjacentHTML('beforeend', '<b>' + MODE_NAME[r.mode] + '</b>');
  const pl = $('lplayers'); pl.innerHTML = '';
  for (let i = 0; i < r.max; i++) {
    const m = r.members[i], d = document.createElement('div'); d.className = 'pl' + (m ? '' : ' empty');
    if (m) { const c = document.createElement('canvas'); d.appendChild(c); miniChar(c, m.char, 34); const tm = r.mode === 'teams' ? '<span class="tag t' + m.team + '">Equipo ' + m.team + '</span>' : (m.id === r.host ? '<span class="tag">Anfitrión</span>' : ''); d.insertAdjacentHTML('beforeend', '<span class="nm">' + m.name + (m.id === Net.id ? ' (tú)' : '') + '</span>' + tm); }
    else d.innerHTML = '<span class="nm">Esperando jugador…</span>';
    pl.appendChild(d);
  }
  const need = r.mode === 'training' || r.mode === 'survival' ? 1 : 2, can = r.members.length >= need;
  $('bStart').disabled = !host || !can; $('bStart').textContent = host ? 'COMENZAR PARTIDA' : 'Esperando al anfitrión…';
  $('ltimer').textContent = r.pub && S.timer != null ? 'La partida comienza automáticamente en ' + S.timer + ' s' : (!can ? 'Se necesitan al menos ' + need + ' jugadores. Comparte el código con tus amigos.' : (host ? 'Todo listo. Pulsa COMENZAR cuando quieras.' : ''));
}
$('bCopy').onclick = () => { const c = S.room && S.room.code; if (!c) return; if (navigator.clipboard) navigator.clipboard.writeText(c).catch(() => { }); $('bCopy').textContent = '¡Copiado!'; setTimeout(() => $('bCopy').textContent = 'Copiar código', 1200); };
$('bStart').onclick = () => Net.emit('room:start');
$('bLeave').onclick = () => { Net.emit('room:leave'); S.room = null; base('menu'); };
$('bRMenu').onclick = () => { Net.emit('room:leave'); S.room = null; base('menu'); };
$('bRLobby').onclick = () => { Net.emit('room:lobby'); base('lobby'); renderLobby(); };
$('bResume').onclick = () => modal(null);
$('bPCfg').onclick = () => { initSettings(); modal('settings'); };
$('bQuit').onclick = () => { Net.emit('room:leave'); S.room = null; base('menu'); };
/* Amigos */
function renderFriends() {
  const l = $('flist'); l.innerHTML = '';
  if (!cfg.friends.length) l.innerHTML = '<div class="hint">Aún no tienes amigos añadidos.</div>';
  cfg.friends.forEach(n => {
    const st = S.fstat[n.toLowerCase()], d = document.createElement('div'); d.className = 'fr';
    d.innerHTML = '<span class="dot' + (st ? ' on' : '') + '"></span><span>' + n + '<div class="st">' + (!st ? 'Sin conexión' : st.busy ? 'En partida' : st.code ? 'En una sala' : 'En línea') + '</div></span>';
    if (st && st.code) { const b = document.createElement('button'); b.className = 'btn sm'; b.textContent = 'Unirse'; b.onclick = () => { const nm = myName(); Net.emit('room:join', { code: st.code, name: nm, char: cfg.char }, r => enterLobby(r)); }; d.appendChild(b); }
    const x = document.createElement('button'); x.className = 'x'; x.textContent = '✕'; x.title = 'Quitar'; x.onclick = () => { cfg.friends = cfg.friends.filter(f => f !== n); save(); renderFriends(); }; d.appendChild(x); l.appendChild(d);
  });
}
$('fadd').onclick = () => { const n = $('fname').value.trim().slice(0, 14); if (n && !cfg.friends.some(f => f.toLowerCase() === n.toLowerCase())) { cfg.friends.push(n); save(); } $('fname').value = ''; renderFriends(); pollFriends(); };
$('fname').onkeydown = e => { if (e.key === 'Enter') $('fadd').click(); };
function pollFriends() { if (S.screen !== 'menu' || !Net.ok || !cfg.friends.length) return; Net.emit('friends:check', cfg.friends, res => { S.fstat = {}; (res || []).forEach(f => S.fstat[f.name.toLowerCase()] = f); renderFriends(); }); }
setInterval(pollFriends, 4000);

/* ---------- Inventario y acciones ---------- */
function renderInv() {
  const i = S.inv; if (!i) { $('invbody').textContent = 'Cargando…'; return; }
  let h = '<div class="inv-slots">';
  for (let k = 0; k < 2; k++) { const w = i.s[k]; h += '<div class="slot' + (i.c === k ? ' cur' : '') + '" data-a="sw" data-i="' + k + '"><b>' + (w ? W[w.k].name : 'Vacía') + '</b><span>' + (w ? W[w.k].cls + ' · ' + w.mag + '/' + W[w.k].mag : 'Ranura ' + (k + 1)) + '</span></div>'; }
  h += '</div>';
  for (const k in i.a) h += '<div class="irow"><span>' + AN[k] + '</span><b>' + i.a[k] + '</b></div>';
  h += '<div class="irow"><span>Granadas [G]</span><b>' + i.n + '</b></div><div class="irow"><span>Botiquines [H]</span><b>' + i.m + ' <button class="btn sm" data-a="heal">Usar</button></b></div><div class="irow"><span>Chaleco</span><b>' + i.ar + '%</b></div>';
  $('invbody').innerHTML = h;
}
$('invbody').onclick = e => { const t = e.target.closest('[data-a]'); if (!t) return; if (t.dataset.a === 'sw') Net.emit('act', { t: 'sw', i: +t.dataset.i }); else Net.emit('act', { t: 'heal' }); };
function pickSpec(dir) {
  const ids = [...S.pl.keys()].filter(id => id !== S.id && !String(id).startsWith('z')); if (!ids.length) { S.spec = null; return; }
  const i = ids.indexOf(S.spec); S.spec = ids[((i < 0 ? (dir < 0 ? 0 : -1) : i) + (dir || 1) + ids.length) % ids.length];
}
function act(o) { if (!S.dead && S.cd <= 0) Net.emit('act', o); }
addEventListener('keydown', e => {
  if (S.screen !== 'game') { if (e.key === 'Escape' && S.modal) modal(null); return; }
  if (e.code === 'Tab') e.preventDefault();
  if (e.repeat) return; keys[e.code] = true;
  switch (e.code) {
    case 'Tab': if (S.modal === 'inv') modal(null); else if (!S.modal && !S.dead) { renderInv(); modal('inv'); } break;
    case 'Escape': if (S.modal === 'inv' || S.modal === 'settings' || S.modal === 'pause') modal(null); else if (!S.modal) modal('pause'); break;
    case 'KeyR': act({ t: 'reload' }); break; case 'KeyE': act({ t: 'pick' }); break;
    case 'Digit1': act({ t: 'sw', i: 0 }); break; case 'Digit2': act({ t: 'sw', i: 1 }); break;
    case 'KeyH': act({ t: 'heal' }); break;
    case 'KeyG': act({ t: 'nade', d: Math.hypot(mouse.x - cv.width / 2, mouse.y - cv.height / 2) / zoom() }); break;
    case 'ArrowLeft': if (S.dead) { pickSpec(-1); updateBanner(); } break; case 'ArrowRight': if (S.dead) { pickSpec(1); updateBanner(); } break;
  }
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.down = false; });
cv.addEventListener('mousemove', e => { mouse.x = e.clientX * cv.width / innerWidth; mouse.y = e.clientY * cv.height / innerHeight; });
cv.addEventListener('mousedown', e => { if (e.button !== 0) return; initAudio(); mouse.down = true; if (S.dead) { pickSpec(1); updateBanner(); } });
addEventListener('mouseup', () => { mouse.down = false; });
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('wheel', e => { if (S.screen === 'game' && S.inv) act({ t: 'sw', i: 1 - S.inv.c }); }, { passive: true });

/* ---------- Bucle principal ---------- */
function resize() { const r = QS[cfg.q].res; cv.width = Math.round(innerWidth * r); cv.height = Math.round(innerHeight * r); }
addEventListener('resize', resize);
const zoom = () => Math.max(.5, Math.sqrt(cv.width * cv.height) / 950);
const angd = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
function update(dt) {
  S.t += dt; sndN = 0; if (S.bannerT > 0) { S.bannerT -= dt; if (S.bannerT <= 0) updateBanner(); }
  const k = 1 - Math.exp(-dt * 18);
  for (const e of S.pl.values()) { e.rx += (e.x - e.rx) * k; e.ry += (e.y - e.ry) * k; e.ra += angd(e.ta, e.ra) * k; }
  if (!S.ready) return;
  if (!S.dead) {
    const kk = 1 - Math.exp(-dt * 30); S.rp.x += (S.pp.x - S.rp.x) * kk; S.rp.y += (S.pp.y - S.rp.y) * kk;
    S.aim = Math.atan2(mouse.y - cv.height / 2, mouse.x - cv.width / 2);
    S.acc += dt; let n = 0;                                    // paso fijo de 40 ms = mismo ritmo que el servidor
    while (S.acc >= DT && n < 3) {
      S.acc -= DT; n++; if (S.cd > 0) continue;
      const blk = S.modal === 'pause' || S.modal === 'results' || S.modal === 'settings';
      const mx = blk ? 0 : (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0), my = blk ? 0 : (keys.KeyS ? 1 : 0) - (keys.KeyW ? 1 : 0), run = !blk && (keys.ShiftLeft || keys.ShiftRight) ? 1 : 0;
      const inp = { s: ++S.seq, x: mx, y: my, r: run, a: +S.aim.toFixed(2), f: mouse.down && !S.modal ? 1 : 0 };
      PL.step(MAP, S.pp, mx, my, run); S.pend.push(inp); if (S.pend.length > 40) S.pend.shift(); Net.emit('in', inp);
    }
    if (S.acc > DT * 3) S.acc = 0;
    let best = null, bd = 75 * 75; for (const it of S.loot.values()) { const d = (it.x - S.pp.x) ** 2 + (it.y - S.pp.y) ** 2; if (d < bd) { bd = d; best = it; } }
    S.near = best; $('prompt').textContent = best ? '[E] Recoger ' + lootName(best) : ''; $('prompt').style.display = best ? 'block' : 'none';
  } else { S.near = null; $('prompt').style.display = 'none'; if (!S.spec || !S.pl.has(S.spec)) { pickSpec(1); updateBanner(); } }
  for (let i = S.parts.length - 1; i >= 0; i--) { const p = S.parts[i]; p.l -= dt; if (p.l <= 0) { S.parts.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .92; p.vy *= .92; }
  for (let i = S.rings.length - 1; i >= 0; i--) { S.rings[i].t += dt; if (S.rings[i].t > .45) S.rings.splice(i, 1); }
  if (S.shake > 0) S.shake = Math.max(0, S.shake - dt * 40);
}
function drawEntity(e, id) {
  const ro = S.roster.get(id), zom = ro && ro.kind === 'zombie', ch = zom ? ZCH : CH[ro ? ro.char : 0], isMe = id === S.id && !S.dead;
  const x = isMe ? S.rp.x : e.rx, y = isMe ? S.rp.y : e.ry, a = isMe ? S.aim : e.ra, q = QS[cfg.q];
  if (q.shadow) { ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(x + 3, y + 5, 15, 12, 0, 0, 7); ctx.fill(); }
  const ally = ro && S.roster.get(S.id) && ro.team === S.roster.get(S.id).team;
  if ((S.mode === 'teams' || S.mode === 'survival') && !zom) { ctx.strokeStyle = ally ? 'rgba(90,200,255,.85)' : 'rgba(255,90,60,.85)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, y, 18, 0, 7); ctx.stroke(); }
  ctx.save(); ctx.translate(x, y); drawChar(ctx, ch, { a, mv: e.mv, t: S.t + (String(id).charCodeAt(1) || 0), w: zom ? 'fists' : e.w, f: e.f }); ctx.restore();
  if (zom) { ctx.fillStyle = '#400'; ctx.fillRect(x - 12, y - 24, 24, 3); ctx.fillStyle = '#e44'; ctx.fillRect(x - 12, y - 24, 24 * e.hp / 100, 3); return; }
  ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.fillStyle = ally || isMe ? '#9be7ff' : '#fff';
  const nm = ro ? ro.name : ''; ctx.strokeText(nm, x, y - 34); ctx.fillText(nm, x, y - 34);
  ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(x - 17, y - 29, 34, 5); ctx.fillStyle = e.hp > 50 ? '#7fd35a' : e.hp > 25 ? '#ffc12e' : '#ff5a36'; ctx.fillRect(x - 16, y - 28, 32 * e.hp / 100, 3);
  if (e.rl || e.hl) { ctx.font = '11px sans-serif'; ctx.fillStyle = '#ffd35a'; ctx.fillText(e.hl ? 'curando…' : 'recargando…', x, y + 32); }
}
function render() {
  const q = QS[cfg.q], z = zoom(); if (!S.ready) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#0d120b'; ctx.fillRect(0, 0, cv.width, cv.height); return; }
  const spec = S.dead ? S.pl.get(S.spec) : null;
  cam.x = spec ? spec.rx : S.rp.x; cam.y = spec ? spec.ry : S.rp.y;
  const sx = S.shake ? (Math.random() - .5) * S.shake : 0, sy = S.shake ? (Math.random() - .5) * S.shake : 0;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#14200f'; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.setTransform(z, 0, 0, z, cv.width / 2 - cam.x * z + sx, cv.height / 2 - cam.y * z + sy);
  const vw = cv.width / z + 120, vh = cv.height / z + 120, vx = cam.x - vw / 2, vy = cam.y - vh / 2;
  drawWorld(vx, vy, vw, vh, q);
  for (const it of S.loot.values()) if (it.x > vx && it.x < vx + vw && it.y > vy && it.y < vy + vh) drawLoot(it);
  for (const [id, e] of S.pl) if (e.rx > vx - 40 && e.rx < vx + vw + 40 && e.ry > vy - 40 && e.ry < vy + vh + 40) drawEntity(e, id);
  ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = 2.5; ctx.beginPath();
  for (const b of S.bul) { ctx.moveTo(b[0], b[1]); ctx.lineTo(b[0] - Math.cos(b[2]) * 30, b[1] - Math.sin(b[2]) * 30); } ctx.stroke();
  for (const n of S.nad) { ctx.fillStyle = '#2b3f22'; ctx.beginPath(); ctx.arc(n[0], n[1], 6, 0, 7); ctx.fill(); ctx.fillStyle = (S.t * 8 | 0) % 2 ? '#f33' : '#fa0'; ctx.fillRect(n[0] - 1.5, n[1] - 9, 3, 4); }
  drawTrees(vx, vy, vw, vh, q);
  for (const r of S.rings) { const k = r.t / .45; ctx.fillStyle = 'rgba(255,140,30,' + (.45 * (1 - k)) + ')'; ctx.beginPath(); ctx.arc(r.x, r.y, r.r * Math.min(1, k * 1.6), 0, 7); ctx.fill(); }
  for (const p of S.parts) { ctx.globalAlpha = Math.min(1, p.l / .25); ctx.fillStyle = p.c; ctx.fillRect(p.x, p.y, p.s, p.s); } ctx.globalAlpha = 1;
  const zn = S.zone;
  if (zn && zn[2] < 5000) {
    ctx.beginPath(); ctx.rect(vx, vy, vw, vh); ctx.arc(zn[0], zn[1], zn[2], 0, 6.2832, true); ctx.fillStyle = 'rgba(210,40,40,.26)'; ctx.fill('evenodd');
    ctx.lineWidth = 4; ctx.strokeStyle = '#ff5a36'; ctx.beginPath(); ctx.arc(zn[0], zn[1], zn[2], 0, 7); ctx.stroke();
    if (!zn[6] && zn[5] < zn[2]) { ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.setLineDash([16, 12]); ctx.beginPath(); ctx.arc(zn[3], zn[4], zn[5], 0, 7); ctx.stroke(); ctx.setLineDash([]); }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (!S.dead) {                                             // mira
    const c = Math.max(1, cv.width / innerWidth), g = 7 * c, l = 9 * c; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * c; ctx.beginPath();
    ctx.moveTo(mouse.x - g - l, mouse.y); ctx.lineTo(mouse.x - g, mouse.y); ctx.moveTo(mouse.x + g, mouse.y); ctx.lineTo(mouse.x + g + l, mouse.y); ctx.moveTo(mouse.x, mouse.y - g - l); ctx.lineTo(mouse.x, mouse.y - g); ctx.moveTo(mouse.x, mouse.y + g); ctx.lineTo(mouse.x, mouse.y + g + l); ctx.stroke();
  }
  if (!(S.frame++ & 3)) drawMini();
}
S.frame = 0;
function drawMini() {
  const s = 160 / 3000, g = mctx; g.clearRect(0, 0, 160, 160);
  for (const z of MAP.zones) { g.fillStyle = z.g; g.fillRect(z.x * s, z.y * s, z.w * s, z.h * s); }
  g.fillStyle = '#3a86c8'; g.beginPath(); g.ellipse(MAP.lake.cx * s, MAP.lake.cy * s, MAP.lake.rx * s, MAP.lake.ry * s, 0, 0, 7); g.fill();
  g.fillStyle = '#43464b'; for (const r of MAP.roads) g.fillRect(r.x * s, r.y * s, Math.max(2, r.w * s), Math.max(2, r.h * s));
  const zn = S.zone; if (zn && zn[2] < 5000) { g.lineWidth = 2; g.strokeStyle = '#ff5a36'; g.beginPath(); g.arc(zn[0] * s, zn[1] * s, zn[2] * s, 0, 7); g.stroke(); if (!zn[6]) { g.strokeStyle = '#fff'; g.beginPath(); g.arc(zn[3] * s, zn[4] * s, zn[5] * s, 0, 7); g.stroke(); } }
  const myT = S.roster.get(S.id) && S.roster.get(S.id).team;
  for (const [id, e] of S.pl) { const ro = S.roster.get(id); if (id === S.id || !ro || ro.kind === 'zombie' || (S.mode !== 'teams' && S.mode !== 'survival') || ro.team !== myT) continue; g.fillStyle = '#4aa3ff'; g.beginPath(); g.arc(e.rx * s, e.ry * s, 3, 0, 7); g.fill(); }
  const px = (S.dead && S.pl.get(S.spec) ? S.pl.get(S.spec).rx : S.rp.x) * s, py = (S.dead && S.pl.get(S.spec) ? S.pl.get(S.spec).ry : S.rp.y) * s;
  g.fillStyle = '#ffc12e'; g.strokeStyle = '#000'; g.lineWidth = 1; g.beginPath(); g.arc(px, py, 4, 0, 7); g.fill(); g.stroke();
}
let last = 0, fN = 0, fT = 0;
function loop(ts) {
  requestAnimationFrame(loop); if (S.screen !== 'game') return;
  const el = ts - last; if (el < 1000 / cfg.fps - 2) return; last = ts; const dt = Math.min(.1, el / 1000);
  update(dt); render();
  if (cfg.showfps) { fN++; fT += el; if (fT >= 500) { $('fps').textContent = Math.round(fN * 1000 / fT) + ' FPS'; fN = 0; fT = 0; } }
}
requestAnimationFrame(loop);
base('menu'); renderFriends(); Net.connect();
