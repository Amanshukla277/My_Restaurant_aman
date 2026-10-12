const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { openDatabase } = require('./db');
const { HttpError } = require('./errors');


const routes = [
  ...require('./routes/menu'),
  ...require('./routes/tables'),
  ...require('./routes/orders'),
  ...require('./routes/bills'),
  ...require('./routes/reports'),
  ...require('./routes/settings'),
];

const PUBLIC_FOLDER = path.join(__dirname, 'public');
const FILE_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

function findRoute(method, urlPath) {
  for (const route of routes) {
    if (route.method !== method) continue;

    const names = [];
    const pattern = route.path.replace(/:(\w+)/g, (match, name) => {
      names.push(name);
      return '(\\d+)';
    });
    const found = new RegExp('^' + pattern + '/?$').exec(urlPath);
    if (!found) continue;

    const params = {};
    names.forEach((name, index) => {
      params[name] = Number(found[index + 1]);
    });
    return { route, params };
  }
  return null;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1000000) {
        reject(new HttpError('Request is too large.', 413));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (raw.trim() === '') return resolve(null);
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new HttpError('Request body is not valid JSON.'));
      }
    });
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function sendFile(res, urlPath) {
  const name = urlPath === '/' ? 'index.html' : decodeURIComponent(urlPath);
  const filePath = path.normalize(path.join(PUBLIC_FOLDER, name));


  const insidePublic = filePath.startsWith(PUBLIC_FOLDER + path.sep);
  if (!insidePublic || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end('Not found');
  }

  const type = FILE_TYPES[path.extname(filePath)] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
  fs.createReadStream(filePath).pipe(res);
}

function createServer(databaseFile) {
  const db = openDatabase(databaseFile || path.join(__dirname, 'data', 'restaurant.db'));

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');

    try {
      if (!url.pathname.startsWith('/api/')) {
        return sendFile(res, url.pathname);
      }

      const found = findRoute(req.method, url.pathname);
      if (!found) throw new HttpError('Not found.', 404);

      let body = null;
      if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        body = await readBody(req);
      }

      const data = found.route.handler({ db, params: found.params, query: url.searchParams, body });
      sendJson(res, found.route.status || 200, data);
    } catch (error) {
      if (error instanceof HttpError) {
        return sendJson(res, error.status, { error: error.message });
      }
      console.error(error);
      sendJson(res, 500, { error: 'Something went wrong on the server.' });
    }
  });

  server.on('close', () => db.close());
  return server;
}

module.exports = { createServer };


if (require.main === module) {
  const port = process.env.PORT || 5000;
  createServer().listen(port, () => {
    console.log(`Restaurant billing is running at http://localhost:${port}`);
  });
}
