// server.js – Local Development & Test Server for Project 24
// Pure Node.js zero-dependency static server + Auth API runner.

const http = require('http');
const fs = require('fs');
const path = require('path');
const authHandler = require('./api/auth.js');

const PORT = process.env.PORT || 3000;
const ROOT = path.resolve(__dirname);

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    // Parse URL
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;

    // Check if API endpoint
    if (pathname.startsWith('/api/auth')) {
        // Collect body if any
        let bodyBuffer = '';
        req.on('data', chunk => { bodyBuffer += chunk; });
        req.on('end', async () => {
            req.body = bodyBuffer;
            // Adapters for Vercel req/res
            res.status = (statusCode) => {
                res.statusCode = statusCode;
                return res;
            };
            res.json = (data) => {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(data));
            };

            await authHandler(req, res);
        });
        return;
    }

    // Static File Serving
    let safePath = path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.[\/\\])+/, '');
    if (safePath === '/' || safePath === '\\') {
        safePath = '/index.html';
    }
    const filePath = path.join(ROOT, safePath);

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'text/html');
            res.end('<h1>404 Not Found</h1>');
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.setHeader('Content-Type', contentType);
        fs.createReadStream(filePath).pipe(res);
    });
});

if (require.main === module) {
    server.listen(PORT, () => {
        console.log(`[Project 24 Server] Running at http://localhost:${PORT}`);
    });
}

module.exports = server;
