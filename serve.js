const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const port = Number(process.env.PORT || 8282);
const host = process.env.HOST || '127.0.0.1';

const mimes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function safeJoin(base, target) {
  const targetPath = path.resolve(base, '.' + target);
  if (!targetPath.startsWith(path.resolve(base))) return null;
  return targetPath;
}

const server = http.createServer((req, res) => {
  try {
    process.stdout.write(`${new Date().toISOString()} ${req.method || 'GET'} ${req.url || '/'}\n`);
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    const normalized = urlPath === '/' ? '/index.html' : urlPath;
    const filePath = safeJoin(root, normalized);
    if (!filePath) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }

    fs.stat(filePath, (err, st) => {
      if (err || !st.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': mimes[ext] || 'application/octet-stream',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        Pragma: 'no-cache',
        Expires: '0',
      });

      fs.createReadStream(filePath).pipe(res);
    });
  } catch {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Server error');
  }
});

server.listen(port, host, () => {
  console.log(`Serving ${root}`);
  console.log(`Open http://${host}:${port}/`);
  if (host !== 'localhost') {
    console.log(`Open http://localhost:${port}/`);
  }
  console.log('Keep this window open while using the system.');
});
