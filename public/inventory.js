/* Inventario: 2 ranuras de arma, munición por tipo, botiquines, granadas y chaleco. Compartido servidor/cliente. */
(function (r, f) { if (typeof module === 'object' && module.exports) module.exports = f(require('./weapons.js')); else r.Inventory = f(r.Weapons); })(typeof self !== 'undefined' ? self : this, function (Wp) {
  const W = Wp.WEAPONS, CAP = Wp.AMMO_CAP;
  class Inventory {
    constructor() { this.slots = [null, null]; this.cur = 0; this.ammo = { light: 0, shell: 0, rifle: 0, sniper: 0 }; this.nades = 0; this.meds = 0; this.armor = 0; }
    cw() { return this.slots[this.cur]; }
    wdef() { const w = this.slots[this.cur]; return w ? W[w.k] : W.fists; }
    /* Intenta recoger un objeto. Devuelve {ok, drops:[objetos que se sueltan]} */
    pick(it) {
      const drops = [];
      if (it.type === 'weapon') {
        let i = this.slots.indexOf(null); if (i < 0) i = this.cur;
        const old = this.slots[i]; if (old) drops.push({ type: 'weapon', key: old.k, mag: old.mag });
        this.slots[i] = { k: it.key, mag: it.mag != null ? it.mag : W[it.key].mag }; this.cur = i;
        return { ok: true, drops };
      }
      if (it.type === 'ammo') { const c = CAP[it.key]; if (this.ammo[it.key] >= c) return { ok: false }; this.ammo[it.key] = Math.min(c, this.ammo[it.key] + (it.amt || 1)); return { ok: true, drops }; }
      if (it.type === 'med') { if (this.meds >= 5) return { ok: false }; this.meds = Math.min(5, this.meds + (it.amt || 1)); return { ok: true, drops }; }
      if (it.type === 'nade') { if (this.nades >= 6) return { ok: false }; this.nades = Math.min(6, this.nades + (it.amt || 1)); return { ok: true, drops }; }
      if (it.type === 'vest') { if (this.armor >= 100) return { ok: false }; this.armor = 100; return { ok: true, drops }; }
      return { ok: false };
    }
    toJSON() { return { s: this.slots, c: this.cur, a: this.ammo, n: this.nades, m: this.meds, ar: Math.round(this.armor) }; }
  }
  return Inventory;
});
