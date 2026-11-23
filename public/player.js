/* Datos de personajes y movimiento. El MISMO código de movimiento corre en el servidor (autoritativo)
   y en el cliente (predicción), así no hay diferencias. */
(function (r, f) { if (typeof module === 'object' && module.exports) module.exports = f(); else r.PlayerLib = f(); })(typeof self !== 'undefined' ? self : this, function () {
  const RADIUS = 14, WALK = 170, RUN = 235, DT = 0.04;
  const CHARACTERS = [
    { id: 0, name: 'Blaze',  body: '#e74c3c', trim: '#7b1d14', hair: '#2b1b12', hat: 'cap' },
    { id: 1, name: 'Frost',  body: '#3498db', trim: '#16507d', hair: '#e8f1f8', hat: 'beanie' },
    { id: 2, name: 'Toxic',  body: '#2ecc71', trim: '#16703d', hair: '#1c1c1c', hat: 'mohawk' },
    { id: 3, name: 'Volt',   body: '#f1c40f', trim: '#8a6f00', hair: '#3b2a10', hat: 'helmet' },
    { id: 4, name: 'Shadow', body: '#8e44ad', trim: '#4a1f5e', hair: '#111111', hat: 'hood' },
    { id: 5, name: 'Rosa',   body: '#ff7eb6', trim: '#b03a76', hair: '#7a1f4d', hat: 'bun' },
    { id: 6, name: 'Rust',   body: '#e67e22', trim: '#8c4a0e', hair: '#5a2d0c', hat: 'headband' },
    { id: 7, name: 'Onyx',   body: '#4b5d6e', trim: '#222d38', hair: '#d0d0d0', hat: 'visor' }
  ];
  /* Un paso fijo de movimiento (DT). Devuelve 0 quieto, 1 caminando, 2 corriendo. */
  function step(map, p, mx, my, run, mul) {
    mx = +mx || 0; my = +my || 0;
    const l = Math.hypot(mx, my); if (l < 0.01) return 0;
    mx /= l; my /= l;
    let sp = run ? RUN : WALK; if (mul) sp *= mul;
    if (map.inWater(p.x, p.y)) sp *= 0.55;
    p.x += mx * sp * DT; p.y += my * sp * DT;
    map.resolve(p, RADIUS);
    return run ? 2 : 1;
  }
  return { RADIUS, WALK, RUN, DT, CHARACTERS, step };
});
