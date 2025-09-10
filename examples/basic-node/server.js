require('dotenv').config();
const http = require('http');

const port = parseInt(process.env.PORT, 10) || 3000;
const debug = String(process.env.DEBUG) === 'true';
const apiUrl = process.env.API_URL;

const server = http.createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true, port, debug, apiUrl }));
});

server.listen(port, () => {
  console.log(`Example app running on http://localhost:${port}`);
});

