// Mushroom Kart World — relay de salas online.
// Um WebSocket por jogador. A sala é criada pelo anfitrião (id 1) e identificada por um código
// de 4 letras; os outros entram com o código. O servidor só repassa pacotes entre os membros,
// com a semântica de destino do Godot (0 = todos, >0 um peer, <0 todos menos -peer).
// Executar: node relay.js   (porta em PORT, padrão 8787)
const http = require("http");
const { WebSocketServer } = require("ws");

const PORT = process.env.PORT || 8787;
const MAX_PLAYERS = 9;
const rooms = new Map(); // code -> {host, peers: Map(id -> ws), nextId}

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end(`Mushroom Kart World relay: ${rooms.size} sala(s)\n`);
});
const wss = new WebSocketServer({ server });

function code4() {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let c = "";
  do { c = ""; for (let i = 0; i < 4; i++) c += a[Math.floor(Math.random() * a.length)]; } while (rooms.has(c));
  return c;
}
const json = (ws, o) => { if (ws.readyState === 1) ws.send(JSON.stringify(o)); };

wss.on("connection", (ws) => {
  ws.room = null; ws.id = 0; ws.isAlive = true;
  ws.on("pong", () => { ws.isAlive = true; });
  ws.on("message", (data, isBinary) => {
    if (!isBinary) {
      let m; try { m = JSON.parse(data.toString()); } catch { return; }
      if (m.op === "create") {
        const code = code4();
        const room = { code, host: ws, peers: new Map([[1, ws]]), nextId: 2 };
        rooms.set(code, room); ws.room = room; ws.id = 1;
        json(ws, { op: "ok", id: 1, code, peers: [1] });
      } else if (m.op === "join") {
        const room = rooms.get(String(m.code || "").toUpperCase());
        if (!room) return json(ws, { op: "err", msg: "Sala não encontrada." });
        if (room.peers.size >= MAX_PLAYERS) return json(ws, { op: "err", msg: "Sala cheia." });
        if (room.locked) return json(ws, { op: "err", msg: "A corrida já começou." });
        ws.room = room; ws.id = room.nextId++;
        json(ws, { op: "ok", id: ws.id, code: room.code, peers: [...room.peers.keys()] });
        for (const [, p] of room.peers) json(p, { op: "peer", id: ws.id });
        room.peers.set(ws.id, ws);
      } else if (m.op === "lock") {
        if (ws.room && ws.id === 1) ws.room.locked = !!m.on;
      }
      return;
    }
    const room = ws.room; if (!room || data.length < 4) return;
    const target = data.readInt32LE(0);
    const out = Buffer.allocUnsafe(data.length);
    out.writeInt32LE(ws.id, 0); data.copy(out, 4, 4);
    for (const [id, p] of room.peers) {
      if (id === ws.id) continue;
      if (target === 0 || target === id || (target < 0 && id !== -target)) {
        if (p.readyState === 1) p.send(out, { binary: true });
      }
    }
  });
  ws.on("close", () => {
    const room = ws.room; if (!room) return;
    room.peers.delete(ws.id);
    if (ws.id === 1) {
      for (const [, p] of room.peers) { json(p, { op: "closed" }); p.room = null; }
      rooms.delete(room.code);
    } else {
      for (const [, p] of room.peers) json(p, { op: "left", id: ws.id });
    }
  });
});
// keep connections alive through proxies (Render, Railway...) and drop dead ones
setInterval(() => {
  for (const ws of wss.clients) { if (!ws.isAlive) return ws.terminate(); ws.isAlive = false; ws.ping(); }
}, 25000);
server.listen(PORT, () => console.log("relay on port " + PORT));
