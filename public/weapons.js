/* Datos de armas y objetos. Compartido entre servidor (autoritativo) y cliente. */
(function (r, f) { if (typeof module === 'object' && module.exports) module.exports = f(); else r.Weapons = f(); })(typeof self !== 'undefined' ? self : this, function () {
  const WEAPONS = {
    fists:   { name: 'Puños',               cls: 'Cuerpo a cuerpo',    dmg: 9,  range: 48,   interval: 0.45, mag: 0,  reload: 0,   spread: 0,     speed: 0,    pellets: 1, ammo: null,     col: '#f2c9a0', len: 0 },
    pistol:  { name: 'Pistola Vex',         cls: 'Pistola',            dmg: 18, range: 520,  interval: 0.30, mag: 12, reload: 1.2, spread: 0.035, speed: 950,  pellets: 1, ammo: 'light',  col: '#cfd3d8', len: 16 },
    shotgun: { name: 'Escopeta Trueno',     cls: 'Escopeta',           dmg: 10, range: 300,  interval: 0.85, mag: 6,  reload: 2.2, spread: 0.20,  speed: 850,  pellets: 8, ammo: 'shell',  col: '#a0623a', len: 24 },
    smg:     { name: 'Subfusil Ráfaga',     cls: 'Subfusil',           dmg: 11, range: 440,  interval: 0.07, mag: 35, reload: 1.7, spread: 0.09,  speed: 950,  pellets: 1, ammo: 'light',  col: '#7b8a99', len: 20 },
    assault: { name: 'Rifle Alfa-47',       cls: 'Rifle de asalto',    dmg: 19, range: 640,  interval: 0.11, mag: 30, reload: 2.1, spread: 0.05,  speed: 1100, pellets: 1, ammo: 'rifle',  col: '#4d6b45', len: 28 },
    sniper:  { name: 'Águila (precisión)',  cls: 'Rifle de precisión', dmg: 85, range: 1150, interval: 1.30, mag: 5,  reload: 2.6, spread: 0.004, speed: 2000, pellets: 1, ammo: 'sniper', col: '#34495e', len: 36 }
  };
  const AMMO_CAP = { light: 120, shell: 40, rifle: 120, sniper: 30 };
  const AMMO_NAME = { light: 'Munición ligera', shell: 'Cartuchos', rifle: 'Munición de rifle', sniper: 'Munición de precisión' };
  const GRENADE = { name: 'Granada', dmg: 95, radius: 130, fuse: 1.8, range: 380, speed: 420 };
  return { WEAPONS, AMMO_CAP, AMMO_NAME, GRENADE };
});
