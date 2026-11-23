/* Capa de red del cliente (Socket.IO) */
const Net = (function () {
  let s = null; const h = {};
  const EV = ['room:update', 'room:timer', 'game:start', 'snap', 'inv', 'game:end', 'dead'];
  function connect() {
    s = io();
    EV.forEach(e => s.on(e, d => h[e] && h[e](d)));
    s.on('connect', () => h.connect && h.connect());
    s.on('disconnect', () => h.disconnect && h.disconnect());
    s.on('connect_error', () => h.error && h.error());
  }
  return { connect, on: (e, f) => { h[e] = f; }, emit: (e, d, cb) => s && s.emit(e, d, cb), get id() { return s && s.id; }, get ok() { return s && s.connected; } };
})();
