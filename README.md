# Relé de salas online — Mushroom Kart World

Servidor Node.js que cria salas com código de 4 letras e repassa os pacotes entre os jogadores do Mushroom Kart World (PC, Android e versão web), por WebSocket.

- Rodar: `npm install && node relay.js` (porta em `PORT`, padrão 8787)
- Publicado no Render como Web Service (build `npm install`, start `node relay.js`).
- No jogo: Opções → Servidor online = `wss://<endereço-do-render>`.
