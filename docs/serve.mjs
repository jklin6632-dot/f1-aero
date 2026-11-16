// 本地静态服务器：单文件页面要加载 41 MB 的 sf25.glb，file:// 会被 CORS 拦，必须走 http
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const ROOT = normalize(dirname(fileURLToPath(import.meta.url)));
const PORT = parseInt(process.argv[2] || '8141', 10);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.glb':  'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin':  'application/octet-stream',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg':  'image/svg+xml'
};

const srv = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p === '/') p = '/index.html';
    const f = normalize(join(ROOT, p));
    if (!f.startsWith(ROOT)) { res.writeHead(403).end('403'); return; }
    const st = await stat(f);
    const buf = await readFile(f);
    res.writeHead(200, {
      'content-type': MIME[extname(f).toLowerCase()] || 'application/octet-stream',
      'content-length': buf.length,
      'cache-control': 'no-store'
    });
    res.end(req.method === 'HEAD' ? undefined : buf);
    console.log('200', (st.size / 1048576).toFixed(1) + 'MB', p);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('404');
  }
});

// 端口已占用 = 已经在跑，直接安静退出（不要弹错误）
srv.on('error', (e) => {
  if (e && e.code === 'EADDRINUSE') {
    console.log('already running on http://127.0.0.1:' + PORT + '/');
    process.exit(0);
  }
  console.error(e);
  process.exit(1);
});

srv.listen(PORT, '127.0.0.1', () => {
  console.log('F1 AERO  ->  http://127.0.0.1:' + PORT + '/');
  console.log('root: ' + ROOT);
});
