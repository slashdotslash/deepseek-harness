// Keep the upstream RCE-capable server loopback-only. BLC's authenticated TLS
// gateway is the only published ingress; this adapter never receives BLC cookies.
import http from 'node:http'
import net from 'node:net'
import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
const child = spawn('dsh', ['web', '--no-open', '--port', '3080', '--trusted-host', 'ai.betterlife.team:10443'], { stdio: ['ignore','pipe','pipe'] })
let authCookie = ''
function exchangeToken(token) {
  const request = http.get({host:'127.0.0.1',port:3080,path:'/?token='+encodeURIComponent(token),headers:{host:'ai.betterlife.team:10443'}},response=>{
    authCookie=(response.headers['set-cookie']??[]).map(value=>value.split(';')[0]).join('; ')
    response.resume()
  })
  request.on('error',()=>setTimeout(()=>exchangeToken(token),1000))
}
for (const stream of [child.stdout,child.stderr]) {
  let pending=''
  stream.on('data',chunk=>{
    pending+=chunk.toString()
    let end
    while((end=pending.indexOf('\n'))>=0){
      const line=pending.slice(0,end);pending=pending.slice(end+1)
      const token=/[?&]token=([A-Za-z0-9_-]+)/.exec(line)?.[1]
      if(token){exchangeToken(token);setInterval(()=>exchangeToken(token),12*60*60*1000).unref()}
      console.log(line.replace(/([?&]token=)[A-Za-z0-9_-]+/g,'$1[redacted]'))
    }
  })
}
child.on('exit' , code => process.exit(code ?? 1))
process.on('SIGTERM', () => child.kill('SIGTERM'))
const css = await readFile('/opt/blc-harness/blc-brand.css')
const logo = await readFile('/opt/blc-harness/blc-logo.svg')
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname
  if (pathname === '/manifest.webmanifest') {
    res.setHeader('content-type', 'application/manifest+json')
    res.end(JSON.stringify({id:'/', name:'BLC Harness', short_name:'BLC Harness', start_url:'/', scope:'/', display:'standalone', icons:[{src:'/blc-logo.svg',sizes:'any',type:'image/svg+xml',purpose:'any'}]})); return
  }
  if (['/blc-brand.css', '/blc-logo.svg', '/favicon.svg', '/favicon.ico'].includes(pathname)) {
    res.setHeader('content-type', pathname.endsWith('.css') ? 'text/css' : 'image/svg+xml')
    res.end(pathname.endsWith('.css') ? css : logo); return
  }
  if (!authCookie) {res.writeHead(503);res.end('Harness is starting');return}
  const headers = { ...req.headers, host:'ai.betterlife.team:10443', cookie:authCookie, 'accept-encoding': 'identity' }; delete headers.authorization
  const upstream = http.request({ host: '127.0.0.1', port: 3080, path: req.url, method: req.method, headers }, response => {
    const contentType = String(response.headers['content-type'])
    if (contentType.includes('text/html') || contentType.includes('javascript')) {
      const chunks = []; response.on('data', part => chunks.push(part)); response.on('end', () => {
        let body = Buffer.concat(chunks).toString().replaceAll('DeepSeek Harness', 'BLC Harness')
        if (contentType.includes('text/html')) body = body.replace(/<title>[^<]*<\/title>/, '<title>BLC Harness · BLC.AI</title>').replace('</head>', '<link rel="stylesheet" href="/blc-brand.css"><link rel="icon" href="/blc-logo.svg"></head>')
        const out = { ...response.headers }; delete out['content-length']; delete out['content-encoding']; delete out['x-frame-options']; delete out['set-cookie']; delete out.etag
        res.writeHead(response.statusCode ?? 502, out); res.end(body)
      })
    } else { const out = { ...response.headers }; delete out['set-cookie']; res.writeHead(response.statusCode ?? 502, out); response.pipe(res) }
  })
  upstream.on('error', () => { if (!res.headersSent) res.writeHead(503); res.end('Harness is starting') })
  req.pipe(upstream)
})
server.on('upgrade', (req, socket, head) => {
  const upstream = net.connect(3080, '127.0.0.1', () => {
    const headers = Object.entries({...req.headers,host:'ai.betterlife.team:10443',cookie:authCookie}).filter(([name]) => name !== 'authorization').map(([name, value]) => `${name}: ${value}`).join('\r\n')
    upstream.write(`${req.method} ${req.url} HTTP/1.1\r\n${headers}\r\n\r\n`)
    if (head.length) upstream.write(head)
    socket.pipe(upstream).pipe(socket)
  })
  upstream.on('error', () => socket.destroy()); socket.on('error', () => upstream.destroy()); socket.on('close', () => upstream.destroy())
})
server.listen(3081, '0.0.0.0')
