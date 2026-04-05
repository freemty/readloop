import http from 'node:http'
import https from 'node:https'
import { HttpsProxyAgent } from 'https-proxy-agent'

const PORT = 3001
const ZLIB_BASE = 'https://z-lib.fm'
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const PROXY_URL = process.env.https_proxy || process.env.http_proxy || 'http://127.0.0.1:7890'
const agent = new HttpsProxyAgent(PROXY_URL)

function zlibRequest(targetPath) {
  return new Promise((resolve, reject) => {
    const url = new URL(targetPath, ZLIB_BASE)
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      agent,
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Host': url.hostname,
      },
    }

    const req = https.request(options, (res) => resolve(res))
    req.on('error', reject)
    req.end()
  })
}

async function followRedirects(targetPath, maxRedirects = 5) {
  let currentPath = targetPath
  for (let i = 0; i < maxRedirects; i++) {
    const proxyRes = await zlibRequest(currentPath)
    if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
      const location = proxyRes.headers.location
      // Consume body
      proxyRes.resume()
      if (location.startsWith('http')) {
        // External redirect (CDN) — fetch directly through proxy
        return new Promise((resolve, reject) => {
          const cdnUrl = new URL(location)
          const cdnOptions = {
            hostname: cdnUrl.hostname,
            path: cdnUrl.pathname + cdnUrl.search,
            method: 'GET',
            agent,
            headers: { 'User-Agent': UA, 'Host': cdnUrl.hostname },
          }
          const req = https.request(cdnOptions, resolve)
          req.on('error', reject)
          req.end()
        })
      }
      currentPath = location
    } else {
      return proxyRes
    }
  }
  throw new Error('Too many redirects')
}

async function handleProxy(targetPath, res) {
  try {
    const proxyRes = await followRedirects(targetPath)

    const headers = {
      'Content-Type': proxyRes.headers['content-type'] || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*',
    }
    if (proxyRes.headers['content-length']) headers['Content-Length'] = proxyRes.headers['content-length']
    if (proxyRes.headers['content-disposition']) headers['Content-Disposition'] = proxyRes.headers['content-disposition']

    res.writeHead(proxyRes.statusCode, headers)
    proxyRes.pipe(res)
  } catch (err) {
    console.error('Proxy error:', err.message)
    if (!res.headersSent) res.writeHead(502)
    res.end(`Proxy error: ${err.message}`)
  }
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': '*',
    })
    res.end()
    return
  }

  const url = new URL(req.url, `http://localhost:${PORT}`)

  if (url.pathname === '/api/search') {
    const query = url.searchParams.get('q') || ''
    const ext = url.searchParams.get('ext') || 'pdf'
    handleProxy(`/s/${encodeURIComponent(query)}?extensions%5B%5D=${ext}`, res)
  } else if (url.pathname.startsWith('/api/book/')) {
    const bookPath = url.pathname.replace('/api/book/', '/book/')
    handleProxy(bookPath, res)
  } else if (url.pathname.startsWith('/api/dl/')) {
    const dlPath = url.pathname.replace('/api/dl/', '/dl/')
    handleProxy(dlPath, res)
  } else {
    res.writeHead(404).end('Not found')
  }
})

server.listen(PORT, () => {
  console.log(`Z-Library proxy running on http://localhost:${PORT}`)
  console.log(`Using upstream proxy: ${PROXY_URL}`)
})
