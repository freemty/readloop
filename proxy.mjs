import http from 'node:http'
import https from 'node:https'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { BedrockRuntimeClient, InvokeModelWithResponseStreamCommand } from '@aws-sdk/client-bedrock-runtime'

const PORT = 3001

// ========== Z-Library Proxy ==========
const ZLIB_BASE = 'https://z-lib.fm'
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const PROXY_URL = process.env.https_proxy || process.env.http_proxy || 'http://127.0.0.1:7890'
const agent = new HttpsProxyAgent(PROXY_URL)

// ========== AWS Bedrock ==========
import { NodeHttpHandler } from '@smithy/node-http-handler'

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'ap-northeast-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  requestHandler: new NodeHttpHandler({
    httpsAgent: agent,
  }),
})

// Bedrock streaming chat endpoint
async function handleBedrockChat(req, res) {
  let body = ''
  for await (const chunk of req) body += chunk

  try {
    const { model, messages, system, max_tokens, stream } = JSON.parse(body)

    const bedrockBody = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: max_tokens || 4096,
      messages,
    }
    if (system) bedrockBody.system = system

    const command = new InvokeModelWithResponseStreamCommand({
      modelId: model,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(bedrockBody),
    })

    const response = await bedrockClient.send(command)

    if (stream) {
      // SSE streaming
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      })

      for await (const event of response.body) {
        if (event.chunk) {
          const decoded = JSON.parse(new TextDecoder().decode(event.chunk.bytes))
          if (decoded.type) {
            res.write(`data: ${JSON.stringify(decoded)}\n\n`)
          }
        }
      }
      res.end()
    } else {
      // Non-streaming: collect full response
      let fullText = ''
      for await (const event of response.body) {
        if (event.chunk) {
          const decoded = JSON.parse(new TextDecoder().decode(event.chunk.bytes))
          if (decoded.type === 'content_block_delta' && decoded.delta?.text) {
            fullText += decoded.delta.text
          }
        }
      }
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      })
      res.end(JSON.stringify({
        content: [{ type: 'text', text: fullText }],
        model,
        role: 'assistant',
      }))
    }
  } catch (err) {
    console.error('Bedrock error:', err.message)
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
    res.end(JSON.stringify({ error: err.message }))
  }
}

// ========== Z-Library helpers ==========
function zlibRequest(targetPath) {
  return new Promise((resolve, reject) => {
    const url = new URL(targetPath, ZLIB_BASE)
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      agent,
      headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml,*/*', 'Host': url.hostname },
    }
    const req = https.request(options, (r) => resolve(r))
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
      proxyRes.resume()
      if (location.startsWith('http')) {
        return new Promise((resolve, reject) => {
          const cdnUrl = new URL(location)
          const req = https.request({ hostname: cdnUrl.hostname, path: cdnUrl.pathname + cdnUrl.search, method: 'GET', agent, headers: { 'User-Agent': UA, 'Host': cdnUrl.hostname } }, resolve)
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

async function handleZlibProxy(targetPath, res) {
  try {
    const proxyRes = await followRedirects(targetPath)
    const headers = { 'Content-Type': proxyRes.headers['content-type'] || 'application/octet-stream', 'Access-Control-Allow-Origin': '*' }
    if (proxyRes.headers['content-length']) headers['Content-Length'] = proxyRes.headers['content-length']
    if (proxyRes.headers['content-disposition']) headers['Content-Disposition'] = proxyRes.headers['content-disposition']
    res.writeHead(proxyRes.statusCode, headers)
    proxyRes.pipe(res)
  } catch (err) {
    console.error('Z-lib proxy error:', err.message)
    if (!res.headersSent) res.writeHead(502)
    res.end(`Proxy error: ${err.message}`)
  }
}

// ========== Local Book Scanner ==========
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

function scanForBooks(dirs, extensions = ['.epub', '.pdf']) {
  const results = []
  const visited = new Set()

  function walk(dir, depth = 0) {
    if (depth > 4 || visited.has(dir)) return
    visited.add(dir)
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          walk(fullPath, depth + 1)
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase()
          if (extensions.includes(ext)) {
            try {
              const stat = fs.statSync(fullPath)
              results.push({
                path: fullPath,
                name: path.basename(entry.name, ext),
                format: ext.slice(1),
                size: stat.size,
                modified: stat.mtimeMs,
              })
            } catch {}
          }
        }
      }
    } catch {}
  }

  for (const dir of dirs) {
    const resolved = dir.replace('~', os.homedir())
    if (fs.existsSync(resolved)) walk(resolved)
  }

  return results.sort((a, b) => b.modified - a.modified)
}

async function handleLocalBooks(req, res) {
  const scanDirs = [
    '~/Downloads',
    '~/Documents',
    '~/Desktop',
    '~/Books',
    '~/Zotero',
    '~/Library/Mobile Documents/com~apple~CloudDocs',
  ]

  const books = scanForBooks(scanDirs)

  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  })
  res.end(JSON.stringify(books))
}

const ALLOWED_SCAN_DIRS = [
  '~/Downloads', '~/Documents', '~/Desktop', '~/Books', '~/Zotero',
  '~/Library/Mobile Documents/com~apple~CloudDocs',
].map(d => d.startsWith('~') ? path.join(os.homedir(), d.slice(1)) : d)

const ALLOWED_EXTENSIONS = ['.epub', '.pdf']

async function handleLocalFile(filePath, res) {
  if (!filePath) {
    res.writeHead(400).end('Missing path parameter')
    return
  }

  // Security: validate path is within allowed directories and has allowed extension
  const resolved = fs.realpathSync(filePath)
  const ext = path.extname(resolved).toLowerCase()

  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    res.writeHead(403).end('Only .epub and .pdf files are allowed')
    return
  }

  const inAllowedDir = ALLOWED_SCAN_DIRS.some(dir => resolved.startsWith(dir + path.sep) || resolved.startsWith(dir))
  if (!inAllowedDir) {
    res.writeHead(403).end('File is outside allowed directories')
    return
  }

  try {
    const stat = fs.statSync(resolved)
    const mimeType = ext === '.epub' ? 'application/epub+zip' : 'application/pdf'

    res.writeHead(200, {
      'Content-Type': mimeType,
      'Content-Length': stat.size,
      'Access-Control-Allow-Origin': '*',
    })
    fs.createReadStream(resolved).pipe(res)
  } catch (err) {
    res.writeHead(404).end(`File not found: ${err.message}`)
  }
}

// ========== Wiki File I/O ==========
const WIKI_ROOT = path.join(os.homedir(), 'readloop', 'wikis')

async function handleWikiInit(req, res) {
  let body = ''
  for await (const chunk of req) body += chunk

  try {
    const { slug, files } = JSON.parse(body)
    const wikiDir = path.join(WIKI_ROOT, slug)
    const dirs = new Set()

    for (const file of files) {
      const fullPath = path.join(wikiDir, file.path)
      const resolved = path.resolve(fullPath)
      if (!resolved.startsWith(path.resolve(wikiDir) + path.sep) && resolved !== path.resolve(wikiDir)) {
        continue
      }
      const dir = path.dirname(fullPath)
      if (!dirs.has(dir)) {
        fs.mkdirSync(dir, { recursive: true })
        dirs.add(dir)
      }
      fs.writeFileSync(fullPath, file.content, 'utf-8')
    }

    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
    res.end(JSON.stringify({ ok: true, path: wikiDir }))
  } catch (err) {
    console.error('Wiki init error:', err.message)
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
    res.end(JSON.stringify({ error: err.message }))
  }
}

async function handleWikiRead(url, res) {
  const slug = url.searchParams.get('slug')
  const filePath = url.searchParams.get('path')

  if (!slug) {
    res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
    res.end(JSON.stringify({ error: 'Missing slug parameter' }))
    return
  }

  const wikiDir = path.join(WIKI_ROOT, slug)

  try {
    if (filePath) {
      const fullPath = path.resolve(path.join(wikiDir, filePath))
      const resolvedWiki = path.resolve(wikiDir)
      if (!fullPath.startsWith(resolvedWiki + path.sep) && fullPath !== resolvedWiki) {
        res.writeHead(403, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
        res.end(JSON.stringify({ error: 'Path traversal denied' }))
        return
      }
      if (!fs.existsSync(fullPath)) {
        res.writeHead(404, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
        res.end(JSON.stringify({ error: 'File not found' }))
        return
      }
      const content = fs.readFileSync(fullPath, 'utf-8')
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
      res.end(JSON.stringify({ content }))
    } else {
      if (!fs.existsSync(wikiDir)) {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
        res.end(JSON.stringify({ files: [] }))
        return
      }
      const files = []
      function walkWiki(dir, prefix) {
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        for (const entry of entries) {
          const rel = prefix ? `${prefix}/${entry.name}` : entry.name
          if (entry.isDirectory()) {
            walkWiki(path.join(dir, entry.name), rel)
          } else if (entry.name.endsWith('.md')) {
            files.push(rel)
          }
        }
      }
      walkWiki(wikiDir, '')
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
      res.end(JSON.stringify({ files }))
    }
  } catch (err) {
    console.error('Wiki read error:', err.message)
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
    res.end(JSON.stringify({ error: err.message }))
  }
}

async function handleWikiUpdate(req, res) {
  let body = ''
  for await (const chunk of req) body += chunk

  try {
    const { slug, files } = JSON.parse(body)
    const wikiDir = path.join(WIKI_ROOT, slug)
    const resolvedWiki = path.resolve(wikiDir)

    for (const file of files) {
      const fullPath = path.resolve(path.join(wikiDir, file.path))
      if (!fullPath.startsWith(resolvedWiki + path.sep) && fullPath !== resolvedWiki) continue

      const dir = path.dirname(fullPath)
      fs.mkdirSync(dir, { recursive: true })

      if (file.mode === 'append' && fs.existsSync(fullPath)) {
        fs.appendFileSync(fullPath, '\n' + file.content, 'utf-8')
      } else {
        fs.writeFileSync(fullPath, file.content, 'utf-8')
      }
    }

    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
    res.end(JSON.stringify({ ok: true }))
  } catch (err) {
    console.error('Wiki update error:', err.message)
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
    res.end(JSON.stringify({ error: err.message }))
  }
}

// ========== Server ==========
const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST',
      'Access-Control-Allow-Headers': '*',
    })
    res.end()
    return
  }

  const url = new URL(req.url, `http://localhost:${PORT}`)

  // Bedrock Claude proxy
  if (url.pathname === '/api/bedrock/chat' && req.method === 'POST') {
    handleBedrockChat(req, res)
    return
  }

  // Wiki endpoints
  if (url.pathname === '/api/wiki/init' && req.method === 'POST') {
    handleWikiInit(req, res)
    return
  }
  if (url.pathname === '/api/wiki/read' && req.method === 'GET') {
    handleWikiRead(url, res)
    return
  }
  if (url.pathname === '/api/wiki/update' && req.method === 'POST') {
    handleWikiUpdate(req, res)
    return
  }

  // Local file scan
  if (url.pathname === '/api/local-books') {
    handleLocalBooks(req, res)
    return
  }

  // Serve a local file by path
  if (url.pathname === '/api/local-file') {
    handleLocalFile(url.searchParams.get('path'), res)
    return
  }

  // Z-Library routes
  if (url.pathname === '/api/search') {
    const query = url.searchParams.get('q') || ''
    const ext = url.searchParams.get('ext') || 'pdf'
    handleZlibProxy(`/s/${encodeURIComponent(query)}?extensions%5B%5D=${ext}`, res)
  } else if (url.pathname.startsWith('/api/book/')) {
    handleZlibProxy(url.pathname.replace('/api/book/', '/book/'), res)
  } else if (url.pathname.startsWith('/api/dl/')) {
    handleZlibProxy(url.pathname.replace('/api/dl/', '/dl/'), res)
  } else {
    res.writeHead(404).end('Not found')
  }
})

server.listen(PORT, () => {
  console.log(`ReadLoop proxy running on http://localhost:${PORT}`)
  console.log(`  Z-Library: via ${PROXY_URL}`)
  console.log(`  Bedrock:   region=${process.env.AWS_REGION || 'ap-northeast-1'}`)
  console.log('  Wiki:      ~/readloop/wikis/')
  console.log('Endpoints:')
  console.log('  POST /api/bedrock/chat  — Bedrock Claude streaming')
  console.log('  GET  /api/search        — Z-Library search')
  console.log('  GET  /api/dl/:id        — Z-Library download')
})
