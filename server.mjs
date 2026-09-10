import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(fileURLToPath(new URL('./public/', import.meta.url)));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json' };
http.createServer(async (req, res) => {
  try {
    let name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (name.startsWith('/bgd/')) name = name.slice(4);
    if (name === '/bgd') { res.writeHead(302, { Location: '/bgd/' }); return res.end(); }
    if(name === '/__preview' && ['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)){
      res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});return res.end(await readFile(new URL('./preview/index.html',import.meta.url)));
    }
    const target = path.resolve(root, '.' + name);
    if (target !== root && !target.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
    const file = (await stat(target)).isDirectory() ? path.join(target, 'index.html') : target;
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    res.end(await readFile(file));
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(Number(process.env.PORT || 4178), process.env.HOST || '127.0.0.1', () => console.log('BGD: http://127.0.0.1:' + (process.env.PORT || 4178) + '/bgd/'));
