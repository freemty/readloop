#!/usr/bin/env node
/**
 * Test connectivity for all AI providers configured in ReadLoop.
 *
 * Usage:
 *   node scripts/test-providers.mjs          # test all
 *   node scripts/test-providers.mjs bedrock  # test one
 */
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '..', '.env')

// Load .env
try {
  const lines = readFileSync(envPath, 'utf-8').split('\n')
  for (const line of lines) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match) process.env[match[1].trim()] = match[2].trim()
  }
} catch {
  console.warn('⚠  .env not found, relying on existing env vars')
}

const PROXY_BASE = 'http://localhost:3001'

const PROVIDERS = {
  siliconflow: {
    type: 'openai',
    baseUrl: 'https://api.siliconflow.cn/v1',
    model: 'claude-sonnet-4',
    apiKey: () => process.env.VITE_SILICONFLOW_API_KEY,
  },
  'bedrock-sonnet': {
    type: 'bedrock',
    proxyUrl: `${PROXY_BASE}/api/bedrock/chat`,
    model: 'arn:aws:bedrock:us-east-2:533595510084:inference-profile/us.anthropic.claude-sonnet-4-6',
  },
  'bedrock-opus': {
    type: 'bedrock',
    proxyUrl: `${PROXY_BASE}/api/bedrock/chat`,
    model: 'arn:aws:bedrock:us-east-2:533595510084:inference-profile/us.anthropic.claude-opus-4-6-v1',
  },
  yunstorm: {
    type: 'openai',
    baseUrl: 'https://dl.yunstorm.com/v1',
    model: 'gpt-4.1',
    apiKey: () => process.env.VITE_YUNSTORM_API_KEY || process.env.YUNSTORM_API_KEY,
  },
}

const TEST_PROMPT = 'Reply with exactly: "pong"'

async function testOpenAI(name, { baseUrl, model, apiKey }) {
  const key = typeof apiKey === 'function' ? apiKey() : apiKey
  if (!key) return { name, status: 'SKIP', message: 'no API key' }

  const url = baseUrl.endsWith('/v1')
    ? `${baseUrl}/chat/completions`
    : `${baseUrl}/v1/chat/completions`

  const start = Date.now()
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: TEST_PROMPT }],
      max_tokens: 50,
      stream: false,
    }),
    signal: AbortSignal.timeout(30_000),
  })

  const latency = Date.now() - start

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    return { name, status: 'FAIL', message: `HTTP ${res.status}: ${body.slice(0, 200)}`, latency }
  }

  const data = await res.json()
  const reply = data.choices?.[0]?.message?.content?.trim()
    ?? data.choices?.[0]?.text?.trim()
    ?? '(no content)'
  return { name, status: 'OK', reply: reply || '(empty response)', model, latency }
}

async function testBedrock(name, { proxyUrl, model }) {
  const start = Date.now()
  const res = await fetch(proxyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      system: '',
      messages: [{ role: 'user', content: TEST_PROMPT }],
      max_tokens: 50,
      stream: false,
    }),
    signal: AbortSignal.timeout(30_000),
  })

  const latency = Date.now() - start

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    return { name, status: 'FAIL', message: `HTTP ${res.status}: ${body.slice(0, 200)}`, latency }
  }

  const data = await res.json()
  const reply = data.content?.[0]?.text?.trim() ?? '(empty)'
  return { name, status: 'OK', reply, model: model.split('/').pop(), latency }
}

async function testOne(name) {
  const cfg = PROVIDERS[name]
  if (!cfg) return { name, status: 'SKIP', message: 'unknown provider' }

  try {
    if (cfg.type === 'openai') return await testOpenAI(name, cfg)
    if (cfg.type === 'bedrock') return await testBedrock(name, cfg)
    return { name, status: 'SKIP', message: `unsupported type: ${cfg.type}` }
  } catch (err) {
    return { name, status: 'FAIL', message: err.message }
  }
}

function formatResult(r) {
  const icon = r.status === 'OK' ? '✅' : r.status === 'SKIP' ? '⏭️ ' : '❌'
  const latency = r.latency ? ` (${r.latency}ms)` : ''
  const detail = r.status === 'OK'
    ? `model=${r.model}  reply="${r.reply}"${latency}`
    : r.message
  return `${icon} ${r.name.padEnd(16)} ${r.status.padEnd(4)}  ${detail}`
}

// Main
const filter = process.argv[2]
const names = filter
  ? Object.keys(PROVIDERS).filter(n => n.includes(filter))
  : Object.keys(PROVIDERS)

if (names.length === 0) {
  console.log(`No provider matching "${filter}". Available: ${Object.keys(PROVIDERS).join(', ')}`)
  process.exit(1)
}

// Check proxy for bedrock tests
if (names.some(n => PROVIDERS[n].type === 'bedrock')) {
  try {
    await fetch(`${PROXY_BASE}/`, { signal: AbortSignal.timeout(2000) })
  } catch {
    console.log(`⚠  Proxy not running at ${PROXY_BASE} — bedrock tests will fail`)
    console.log('   Start with: npm run proxy\n')
  }
}

console.log(`Testing ${names.length} provider(s)...\n`)

const results = await Promise.allSettled(names.map(n => testOne(n)))

for (const r of results) {
  const val = r.status === 'fulfilled' ? r.value : { name: '?', status: 'FAIL', message: r.reason?.message }
  console.log(formatResult(val))
}

const failed = results.filter(r => r.status === 'fulfilled' && r.value.status === 'FAIL').length
console.log(`\n${results.length} tested, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
