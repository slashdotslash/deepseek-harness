// Keep the upstream RCE-capable server loopback-only. BLC's authenticated TLS
// gateway is the only published ingress; this adapter never receives BLC cookies.
import http from 'node:http'
import net from 'node:net'
import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
const child = spawn('dsh', ['web', '--no-open', '--port', '3080', '--trusted-host', 'ai.betterlife.team:10443'], { stdio: 'inherit' })
child.on('exit', code => process.exit(code ?? 1))
process.on('SIGTERM', () => child.kill('SIGTERM'))
const css = await readFile('/opt/blc-harness/blc-brand.css')
const logo = await readFile('/opt/blc-harness/blc-logo.svg')
const server = http.createServer((req, res) => {
  if (req.url === '/blc-brand.css' || req.url === '/blc-logo.svg') {
    res.setHeader('content-type', req.url.endsWith('.css') ? 'text/css' : 'image/svg+xml')
    res.end(req.url.endsWith('.css') ? css : logo); return
  }
  const headers = { ...req.headers, 'accept-encoding': 'identity' }; delete headers.cookie
  const upstream = http.request({ host: '127.0.0.1', port: 3080, path: req.url, method: req.method, headers }, response => {
    if (String(response.headers['content-type']).includes('text/html')) {
      const chunks = []; response.on('data', part => chunks.push(part)); response.on('end', () => {
        const body = Buffer.concat(chunks).toString().replace(/<title>[^<]*<\/title>/, '<title>DeepSeek Harness · BLC.AI</title>').replace('</head>', '<link rel="stylesheet" href="/blc-brand.css"><link rel="icon" href="/blc-logo.svg"></head>')
        const out = { ...response.headers }; delete out['content-length']; delete out['content-encoding']; delete out['x-frame-options']
        res.writeHead(response.statusCode ?? 502, out); res.end(body)
      })
    } else { res.writeHead(response.statusCode ?? 502, response.headers); response.pipe(res) }
  })
  upstream.on('error', () => { if (!res.headersSent) res.writeHead(503); res.end('Harness is starting') })
  req.pipe(upstream)
})
server.on('upgrade', (req, socket, head) => {
  const upstream = net.connect(3080, '127.0.0.1', () => {
    const headers = Object.entries(req.headers).filter(([name]) => name !== 'cookie').map(([name, value]) => `${name}: ${value}`).join('\r\n')
    upstream.write(`${req.method} ${req.url} HTTP/1.1\r\n${headers}\r\n\r\n`)
    if (head.length) upstream.write(head)
    socket.pipe(upstream).pipe(socket)
  })
  upstream.on('error', () => socket.destroy()); socket.on('error', () => upstream.destroy())
})
server.listen(3081, '0.0.0.0')
