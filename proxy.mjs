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
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'REDACTED_AK',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'REDACTED_SK',
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
          // Convert Bedrock response to Anthropic SSE format
          if (decoded.type === 'content_block_delta') {
            res.write(`data: ${JSON.stringify(decoded)}\n\n`)
          } else if (decoded.type === 'content_block_start') {
            res.write(`data: ${JSON.stringify(decoded)}\n\n`)
          } else if (decoded.type === 'message_start') {
            res.write(`data: ${JSON.stringify(decoded)}\n\n`)
          } else if (decoded.type === 'message_delta') {
            res.write(`data: ${JSON.stringify(decoded)}\n\n`)
          } else if (decoded.type === 'message_stop') {
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
  console.log('Endpoints:')
  console.log('  POST /api/bedrock/chat  — Bedrock Claude streaming')
  console.log('  GET  /api/search        — Z-Library search')
  console.log('  GET  /api/dl/:id        — Z-Library download')
})
