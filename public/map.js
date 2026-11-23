/* Mapa 3000x3000 dividido en 6 zonas. Generación determinista (misma semilla en servidor y cliente). */
(function (r, f) { if (typeof module === 'object' && module.exports) module.exports = f(); else r.GameMap = f(); })(typeof self !== 'undefined' ? self : this, function () {
  const W = 3000, H = 3000, CELL = 250, N = 12;
  const ZONES = [
    { id: 0, n: 'Ciudad abandonada', x: 0,    y: 0,    w: 1000, h: 1500, g: '#6f747a', kind: 'city' },
    { id: 1, n: 'Bosque',            x: 1000, y: 0,    w: 1000, h: 1500, g: '#3f7d3a', kind: 'forest' },
    { id: 2, n: 'Pueblo',            x: 2000, y: 0,    w: 1000, h: 1500, g: '#8ab35a', kind: 'village' },
    { id: 3, n: 'Base militar',      x: 0,    y: 1500, w: 1000, h: 1500, g: '#6b6f4a', kind: 'base' },
    { id: 4, n: 'Zona industrial',   x: 1000, y: 1500, w: 1000, h: 1500, g: '#77716a', kind: 'industrial' },
    { id: 5, n: 'Lago',              x: 2000, y: 1500, w: 1000, h: 1500, g: '#7fb069', kind: 'lake' }
  ];
  const ROADS = [{ x: 0, y: 1470, w: 3000, h: 60 }, { x: 970, y: 0, w: 60, h: 3000 }, { x: 1970, y: 0, w: 60, h: 3000 }];
  const LAKE = { cx: 2500, cy: 2250, rx: 400, ry: 310 };

  function rng(s) { return function () { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  /* Segmento contra rectángulo (Liang-Barsky). Devuelve t de entrada [0..1] o 2 si no toca. */
  function segRect(x1, y1, x2, y2, c) {
    let t0 = 0, t1 = 1; const dx = x2 - x1, dy = y2 - y1;
    const P = [-dx, dx, -dy, dy], Q = [x1 - c.x, c.x + c.w - x1, y1 - c.y, c.y + c.h - y1];
    for (let i = 0; i < 4; i++) {
      if (P[i] === 0) { if (Q[i] < 0) return 2; }
      else { const t = Q[i] / P[i]; if (P[i] < 0) { if (t > t1) return 2; if (t > t0) t0 = t; } else { if (t < t0) return 2; if (t < t1) t1 = t; } }
    }
    return t0;
  }
  /* Segmento contra círculo. Devuelve t [0..1] o 2 si no toca. */
  function segCircle(x1, y1, x2, y2, cx, cy, rad) {
    const dx = x2 - x1, dy = y2 - y1, fx = x1 - cx, fy = y1 - cy;
    const a = dx * dx + dy * dy, c = fx * fx + fy * fy - rad * rad;
    if (c < 0) return 0;
    if (a === 0) return 2;
    const b = 2 * (fx * dx + fy * dy), disc = b * b - 4 * a * c;
    if (disc < 0) return 2;
    const t = (-b - Math.sqrt(disc)) / (2 * a);
    return (t >= 0 && t <= 1) ? t : 2;
  }

  function generate() {
    const R = rng(777);
    const m = { W, H, zones: ZONES, roads: ROADS, lake: LAKE, buildings: [], crates: [], trees: [], cols: [], lootSpots: [], spawns: [] };
    const fp = [];
    const ov = (a, b, p) => a.x < b.x + b.w + p && a.x + a.w > b.x - p && a.y < b.y + b.h + p && a.y + a.h > b.y - p;
    const inLake = (x, y, mg) => { const dx = (x - LAKE.cx) / (LAKE.rx + mg), dy = (y - LAKE.cy) / (LAKE.ry + mg); return dx * dx + dy * dy < 1; };
    const ok = (x, y, w, h, p) => {
      if (x < 50 || y < 50 || x + w > W - 50 || y + h > H - 50) return false;
      const b = { x, y, w, h };
      for (const rd of ROADS) if (ov(b, rd, p)) return false;
      if (inLake(x + w / 2, y + h / 2, Math.max(w, h) / 2 + 30)) return false;
      for (const q of fp) if (ov(b, q, p)) return false;
      return true;
    };
    const wall = (x, y, w, h) => m.cols.push({ x, y, w, h });
    function build(x, y, w, h, col) {
      const t = 12, door = (R() * 4) | 0, gap = 64;
      fp.push({ x, y, w, h }); m.buildings.push({ x, y, w, h, col, door });
      const hs = (w - gap) / 2, vs = (h - 2 * t - gap) / 2;
      if (door === 0) { wall(x, y, hs, t); wall(x + hs + gap, y, hs, t); } else wall(x, y, w, t);
      if (door === 1) { wall(x, y + h - t, hs, t); wall(x + hs + gap, y + h - t, hs, t); } else wall(x, y + h - t, w, t);
      if (door === 2) { wall(x, y + t, t, vs); wall(x, y + t + vs + gap, t, vs); } else wall(x, y + t, t, h - 2 * t);
      if (door === 3) { wall(x + w - t, y + t, t, vs); wall(x + w - t, y + t + vs + gap, t, vs); } else wall(x + w - t, y + t, t, h - 2 * t);
      m.lootSpots.push({ x: x + w * 0.3, y: y + h * 0.5 }, { x: x + w * 0.7, y: y + h * 0.5 });
      if (w >= 120) m.lootSpots.push({ x: x + w * 0.5, y: y + h * 0.35 });
    }
    const place = (z, w, h, col) => {
      for (let i = 0; i < 60; i++) {
        const x = Math.round(z.x + 50 + R() * (z.w - 100 - w)), y = Math.round(z.y + 50 + R() * (z.h - 100 - h));
        if (ok(x, y, w, h, 45)) { build(x, y, w, h, col); return true; }
      } return false;
    };
    const crate = (z, w, h) => {
      for (let i = 0; i < 30; i++) {
        const x = Math.round(z.x + 50 + R() * (z.w - 100 - w)), y = Math.round(z.y + 50 + R() * (z.h - 100 - h));
        if (ok(x, y, w, h, 20)) { fp.push({ x, y, w, h }); m.cols.push({ x, y, w, h, c: 1 }); m.crates.push({ x, y, w, h }); m.lootSpots.push({ x: x + w / 2, y: y + h + 18 }); return; }
      }
    };
    const tree = (z) => {
      for (let i = 0; i < 8; i++) {
        const x = Math.round(z.x + 30 + R() * (z.w - 60)), y = Math.round(z.y + 30 + R() * (z.h - 60));
        if (ok(x - 20, y - 20, 40, 40, 6)) { m.trees.push({ x, y, r: 15 }); m.cols.push({ x, y, r: 15 }); return; }
      }
    };
    const rr = (a, b) => Math.round(a + R() * (b - a));
    const [city, forest, village, base, ind, lake] = ZONES;
    for (let i = 0; i < 12; i++) place(city, rr(100, 190), rr(90, 160), '#9aa0a6');
    for (let i = 0; i < 3; i++) place(forest, 90, 70, '#8d6e4a');
    for (let i = 0; i < 16; i++) place(village, rr(80, 110), rr(70, 100), '#c9a27a');
    for (let i = 0; i < 5; i++) place(base, rr(150, 220), rr(110, 170), '#7d8a6a');
    for (let i = 0; i < 6; i++) place(ind, rr(200, 280), rr(120, 170), '#8a8d91');
    for (let i = 0; i < 3; i++) place(lake, 90, 80, '#b08a60');
    for (let i = 0; i < 8; i++) crate(city, 32, 32);
    for (let i = 0; i < 20; i++) crate(base, 40, 40);
    for (let i = 0; i < 26; i++) crate(ind, i % 2 ? 70 : 40, i % 2 ? 30 : 40);
    for (let i = 0; i < 4; i++) crate(lake, 34, 34);
    [[city, 22], [forest, 210], [village, 40], [base, 18], [ind, 10], [lake, 40]].forEach(([z, n]) => { for (let i = 0; i < n; i++) tree(z); });

    /* Rejilla espacial */
    m.grid = []; for (let i = 0; i < N * N; i++) m.grid.push([]);
    m.cols.forEach((c, i) => {
      const rect = c.w !== undefined;
      const x1 = rect ? c.x : c.x - c.r, y1 = rect ? c.y : c.y - c.r, x2 = rect ? c.x + c.w : c.x + c.r, y2 = rect ? c.y + c.h : c.y + c.r;
      for (let cy = Math.max(0, Math.floor(y1 / CELL)); cy <= Math.min(N - 1, Math.floor(y2 / CELL)); cy++)
        for (let cx = Math.max(0, Math.floor(x1 / CELL)); cx <= Math.min(N - 1, Math.floor(x2 / CELL)); cx++) m.grid[cy * N + cx].push(i);
    });
    let stamp = 0;
    m.query = function (x1, y1, x2, y2) {
      const out = []; stamp++;
      const cx1 = Math.max(0, Math.floor(x1 / CELL)), cx2 = Math.min(N - 1, Math.floor(x2 / CELL)), cy1 = Math.max(0, Math.floor(y1 / CELL)), cy2 = Math.min(N - 1, Math.floor(y2 / CELL));
      for (let cy = cy1; cy <= cy2; cy++) for (let cx = cx1; cx <= cx2; cx++) {
        const g = m.grid[cy * N + cx];
        for (let k = 0; k < g.length; k++) { const c = m.cols[g[k]]; if (c._s !== stamp) { c._s = stamp; out.push(c); } }
      }
      return out;
    };
    /* Empuja un círculo {x,y} fuera de obstáculos y lo mantiene dentro del mapa */
    m.resolve = function (p, rad) {
      p.x = Math.max(rad, Math.min(W - rad, p.x)); p.y = Math.max(rad, Math.min(H - rad, p.y));
      for (let it = 0; it < 2; it++) {
        const q = m.query(p.x - rad, p.y - rad, p.x + rad, p.y + rad);
        for (const c of q) {
          if (c.w === undefined) {
            const dx = p.x - c.x, dy = p.y - c.y, d = Math.hypot(dx, dy), mn = rad + c.r;
            if (d < mn) { if (d > 0.001) { const k = (mn - d) / d; p.x += dx * k; p.y += dy * k; } else p.x += mn; }
          } else {
            const nx = Math.max(c.x, Math.min(p.x, c.x + c.w)), ny = Math.max(c.y, Math.min(p.y, c.y + c.h));
            const dx = p.x - nx, dy = p.y - ny, d2 = dx * dx + dy * dy;
            if (d2 < rad * rad) {
              if (d2 > 0.0001) { const d = Math.sqrt(d2), k = (rad - d) / d; p.x += dx * k; p.y += dy * k; }
              else {
                const l = p.x - c.x, rt = c.x + c.w - p.x, t = p.y - c.y, b = c.y + c.h - p.y, mn = Math.min(l, rt, t, b);
                if (mn === l) p.x = c.x - rad; else if (mn === rt) p.x = c.x + c.w + rad; else if (mn === t) p.y = c.y - rad; else p.y = c.y + c.h + rad;
              }
            }
          }
        }
      }
    };
    /* Primer impacto de un segmento contra paredes/cajas (los árboles no frenan balas). 2 = libre */
    m.segHit = function (x1, y1, x2, y2) {
      const q = m.query(Math.min(x1, x2) - 2, Math.min(y1, y2) - 2, Math.max(x1, x2) + 2, Math.max(y1, y2) + 2);
      let best = 2;
      for (const c of q) { if (c.w === undefined) continue; const t = segRect(x1, y1, x2, y2, c); if (t < best) best = t; }
      return best;
    };
    m.inWater = (x, y) => { const dx = (x - LAKE.cx) / LAKE.rx, dy = (y - LAKE.cy) / LAKE.ry; return dx * dx + dy * dy < 1; };
    m.zoneAt = (x, y) => ZONES[Math.min(2, Math.max(0, Math.floor(x / 1000))) + (y >= 1500 ? 3 : 0)];
    m.blocked = function (x, y, rad) {
      const q = m.query(x - rad, y - rad, x + rad, y + rad);
      for (const c of q) {
        if (c.w === undefined) { if (Math.hypot(x - c.x, y - c.y) < rad + c.r) return true; }
        else { const nx = Math.max(c.x, Math.min(x, c.x + c.w)), ny = Math.max(c.y, Math.min(y, c.y + c.h)); if ((x - nx) ** 2 + (y - ny) ** 2 < rad * rad) return true; }
      }
      return false;
    };
    m.randFree = function (rand) {
      rand = rand || Math.random;
      for (let i = 0; i < 80; i++) {
        const x = 100 + rand() * (W - 200), y = 100 + rand() * (H - 200);
        if (!m.blocked(x, y, 22) && !m.inWater(x, y)) return { x, y };
      }
      return { x: 1500, y: 1450 };
    };
    for (let i = 0; i < 70; i++) m.spawns.push(m.randFree(R));
    return m;
  }
  return { W, H, ZONES, ROADS, LAKE, generate, segRect, segCircle };
});
