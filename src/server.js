import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Team } from './team.js';
import { checkSetup } from './setup.js';

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };

export async function startServer({ repo, port, demo }) {
  const clients = new Set();
  const broadcast = (type, data) => {
    const msg = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of clients) res.write(msg);
  };
  const team = new Team({ repo, demo, emit: broadcast });
  await team.load();

  const body = (req) => new Promise((ok, fail) => {
    let s = '';
    req.on('data', (c) => (s += c));
    req.on('end', () => { try { ok(s ? JSON.parse(s) : {}); } catch (e) { fail(e); } });
  });
  const json = (res, data, code = 200) => {
    res.writeHead(code, { 'content-type': 'application/json' });
    res.end(JSON.stringify(data));
  };

  const routes = {
    'GET /api/state': () => team.snapshot(),
    'GET /api/setup': () => checkSetup(repo),
    'POST /api/team': (b) => team.configure(b),
    'POST /api/message': (b) => team.message(b.to, b.text),
    'POST /api/actions/resolve': (b) => team.resolveAction(b.id, b.answer),
    'POST /api/agents/stop': (b) => team.stop(b.id),
    'POST /api/settings': (b) => team.updateSettings(b),
    'POST /api/reset': () => team.reset(),
  };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/events') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
      res.write(`event: state\ndata: ${JSON.stringify(team.snapshot())}\n\n`);
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }
    const route = routes[`${req.method} ${url.pathname}`];
    if (route) {
      try { return json(res, (await route(req.method === 'POST' ? await body(req) : {})) ?? { ok: true }); }
      catch (e) { return json(res, { error: e.message }, 400); }
    }
    const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    if (file.includes('..')) return json(res, { error: 'bad path' }, 400);
    try {
      const data = await readFile(join(PUBLIC, file));
      res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
      res.end(data);
    } catch { json(res, { error: 'not found' }, 404); }
  });

  await new Promise((ok) => server.listen(port, '127.0.0.1', ok));
  return `http://localhost:${port}`;
}
