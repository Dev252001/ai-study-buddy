/**
 * Study Buddy AI HTML Dev Server
 * - Serves frontend-html/ as static files
 * - Proxies /api/v1/* to the backend on port 8000
 * 
 * Run:  node server.js
 * Open: http://localhost:3000/login.html
 */

const http = require('http')
const fs = require('fs')
const path = require('path')
const httpProxy = require('http-proxy')

const PORT = 3000
const BACKEND = 'http://localhost:8000'
const STATIC_DIR = path.join(__dirname, 'frontend-html')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
}

// Create proxy to backend
const proxy = httpProxy.createProxyServer({ target: BACKEND, changeOrigin: true })

proxy.on('error', (err, req, res) => {
  console.error('[proxy error]', err.message)
  if (!res.headersSent) {
    res.writeHead(502, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ detail: 'Backend not reachable — is the backend running on port 8000?' }))
  }
})

// Create HTTP server
const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0]

  // Proxy all API calls to backend
  if (req.url.startsWith('/api/')) {
    console.log(`[proxy] ${req.method} ${req.url}`)
    return proxy.web(req, res)
  }

  // Redirect root to login
  let filePath = url === '/' ? '/login.html' : url
  filePath = path.join(STATIC_DIR, filePath)

  // Security: prevent path traversal
  if (!filePath.startsWith(STATIC_DIR)) {
    res.writeHead(403); res.end('Forbidden'); return
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' })
        res.end(`<h2>404 — Not Found</h2><p>${path.basename(filePath)} does not exist.</p><a href="/login.html">← Login</a>`)
      } else {
        res.writeHead(500); res.end('Server error')
      }
      return
    }

    const ext = path.extname(filePath).toLowerCase()
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    })
    res.end(data)
  })
})

server.listen(PORT, () => {
  console.log('')
  console.log('  ╔══════════════════════════════════════════════╗')
  console.log('  ║       🧠  Study Buddy AI — HTML Frontend        ║')
  console.log('  ╠══════════════════════════════════════════════╣')
  console.log(`  ║  Local:    http://localhost:${PORT}/login.html    ║`)
  console.log(`  ║  Backend:  ${BACKEND}/api/v1            ║`)
  console.log('  ╚══════════════════════════════════════════════╝')
  console.log('')
})
