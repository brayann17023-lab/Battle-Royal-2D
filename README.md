# BATTLE ROYALE 2D

Battle Royale online 2D (vista desde arriba) para navegador. Hasta 10 jugadores reales por partida.
Node.js + Express + Socket.IO (servidor autoritativo) y Canvas 2D en el cliente. Sin imágenes ni librerías pesadas.

## Instalar y ejecutar
1. Instala Node.js 16 o superior (https://nodejs.org).
2. En esta carpeta:
   ```
   npm install
   npm start
   ```
3. Abre http://localhost:3000. La consola también muestra tu dirección en red local.

## Jugar online con amigos
**Misma red (WiFi/LAN):** el anfitrión ejecuta `npm start`; los amigos abren `http://IP-DEL-ANFITRIÓN:3000`
(la IP aparece en la consola). Si no conecta, permite Node.js en el firewall de Windows (red privada).

**Por Internet, opción A (sin configurar el router):** con el servidor en marcha, ejecuta en otra terminal
`npx cloudflared tunnel --url http://localhost:3000` (o `ngrok http 3000`) y comparte el enlace https que muestra.

**Por Internet, opción B:** abre el puerto 3000 (TCP) en el router hacia tu PC y comparte `http://TU-IP-PÚBLICA:3000`.

**Opción C (24/7):** sube la carpeta a un hosting con Node.js (Render, Railway, Fly.io...). El puerto se toma de la variable `PORT`.

Flujo: el anfitrión pulsa **CREAR SALA**, elige modo y comparte el **código de 5 letras**; los demás usan **UNIRSE A SALA**.
El anfitrión pulsa **COMENZAR PARTIDA**. **JUGAR** te mete en una sala pública (empieza sola 20 s después de haber 2+ jugadores).

## Controles
WASD mover · Shift correr · Ratón apuntar · Clic izq. disparar · R recargar · E recoger · TAB inventario · ESC menú
1/2 o rueda del ratón: cambiar arma · G lanzar granada (hacia el cursor) · H usar botiquín · ←/→ o clic: cambiar de espectado (al ser eliminado)

## Modos
- **Battle Royale individual** (2-10): gana el último en pie.
- **Equipos 5 vs 5** (2-10): equipos automáticos; sin fuego amigo.
- **Entrenamiento contra bots**: los bots completan la sala hasta 10 (solo en este modo hay bots).
- **Supervivencia**: cooperativo contra oleadas de infectados.
- **Partidas privadas**: toda sala creada con CREAR SALA es privada (solo entra quien tiene el código).

## Rendimiento (PC modestas)
Configuración → Calidad Baja/Media/Alta (resolución interna, partículas, texturas, sombras) y límite de 30 o 60 FPS.
Todo el arte y el sonido se generan por código: no hay descargas de imágenes/audio.

## Estructura
```
server.js        servidor autoritativo (salas, simulación, bots, zona, victoria)
package.json
public/
  index.html  style.css
  game.js        cliente: render, entrada, predicción, HUD, menús
  network.js     capa Socket.IO del cliente
  player.js      personajes y movimiento (compartido servidor/cliente)
  weapons.js     armas y granadas (compartido)
  inventory.js   inventario (compartido)
  map.js         mapa de 6 zonas y colisiones (compartido)
  assets/
```
