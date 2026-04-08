#!/usr/bin/env node
/**
 * Manual wiki initializer for a book already in ReadLoop.
 * Usage: node scripts/init-wiki.mjs <path-to-epub>
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { BedrockRuntimeClient, InvokeModelWithResponseStreamCommand } from '@aws-sdk/client-bedrock-runtime'
import { NodeHttpHandler } from '@smithy/node-http-handler'
import { HttpsProxyAgent } from 'https-proxy-agent'

const epubPath = process.argv[2]
if (!epubPath || !fs.existsSync(epubPath)) {
  console.error('Usage: node scripts/init-wiki.mjs <path-to-epub>')
  process.exit(1)
}

// --- Config ---
const PROXY_URL = process.env.https_proxy || process.env.http_proxy || 'http://127.0.0.1:7890'
const agent = new HttpsProxyAgent(PROXY_URL)
const MODEL = process.env.AWS_BEDROCK_MODEL
if (!MODEL) {
  console.error('Error: AWS_BEDROCK_MODEL not set. Add it to .env or pass as env var.')
  process.exit(1)
}
const WIKI_ROOT = path.join(os.homedir(), 'readloop', 'wikis')

const bedrock = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'ap-northeast-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  requestHandler: new NodeHttpHandler({ httpsAgent: agent }),
})

// --- EPUB parsing (JSZip + XHTML in Node) ---
async function extractChapters(filePath) {
  const { default: JSZip } = await import('jszip')
  const { JSDOM } = await import('jsdom')

  const data = fs.readFileSync(filePath)
  const zip = await JSZip.loadAsync(data)

  // Parse container.xml to find content.opf
  const containerFile = zip.file('META-INF/container.xml')
  if (!containerFile) throw new Error('Invalid EPUB: missing META-INF/container.xml')
  const containerXml = await containerFile.async('string')
  const containerDom = new JSDOM(containerXml, { contentType: 'text/xml' })
  const rootfilePath = containerDom.window.document
    .querySelector('rootfile')?.getAttribute('full-path')
  if (!rootfilePath) throw new Error('No rootfile in container.xml')

  const opfDir = rootfilePath.includes('/') ? rootfilePath.replace(/\/[^/]+$/, '/') : ''

  // Parse content.opf for spine + manifest
  const opfFile = zip.file(rootfilePath)
  if (!opfFile) throw new Error(`Invalid EPUB: missing ${rootfilePath}`)
  const opfXml = await opfFile.async('string')
  const opfDom = new JSDOM(opfXml, { contentType: 'text/xml' })
  const opfDoc = opfDom.window.document

  // Build manifest map: id -> href
  const manifest = new Map()
  for (const item of opfDoc.querySelectorAll('manifest > item')) {
    manifest.set(item.getAttribute('id'), item.getAttribute('href'))
  }

  // Get spine order
  const spineItems = []
  for (const itemref of opfDoc.querySelectorAll('spine > itemref')) {
    const idref = itemref.getAttribute('idref')
    const href = manifest.get(idref)
    if (href) spineItems.push(href)
  }

  // Parse TOC (try toc.ncx)
  const tocId = opfDoc.querySelector('spine')?.getAttribute('toc')
  const tocHref = tocId ? manifest.get(tocId) : null
  const tocMap = new Map() // href -> label

  if (tocHref) {
    const tocFile = zip.file(opfDir + tocHref) ?? zip.file(tocHref)
    if (tocFile) {
      const tocXml = await tocFile.async('string')
      const tocDom = new JSDOM(tocXml, { contentType: 'text/xml' })
      for (const np of tocDom.window.document.querySelectorAll('navPoint')) {
        const label = np.querySelector('navLabel > text')?.textContent?.trim()
        const src = np.querySelector('content')?.getAttribute('src')?.split('#')[0]
        if (label && src) tocMap.set(src, label)
      }
    }
  }

  // Extract text from each spine item
  const chapters = []
  let idx = 0

  for (const href of spineItems) {
    const file = zip.file(opfDir + href) ?? zip.file(href)
    if (!file) continue

    const html = await file.async('string')
    const dom = new JSDOM(html)
    const text = dom.window.document.body?.textContent?.trim() ?? ''
    if (text.length < 50) continue

    // Find TOC label
    const bareHref = href.split('/').pop()
    const title = tocMap.get(href) ?? tocMap.get(bareHref) ?? `Section ${idx + 1}`
    const slug = `${String(idx + 1).padStart(2, '0')}-${slugify(title).slice(0, 50)}`

    chapters.push({ title, slug, text: text.slice(0, 8000) })
    idx++
  }

  return chapters
}

// --- Bedrock chat (non-streaming, collect full response) ---
async function chat(system, user) {
  const command = new InvokeModelWithResponseStreamCommand({
    modelId: MODEL,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 4096,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  })

  const response = await bedrock.send(command)
  const decoder = new TextDecoder()
  let full = ''
  for await (const event of response.body) {
    if (event.chunk) {
      const decoded = JSON.parse(decoder.decode(event.chunk.bytes))
      if (decoded.type === 'content_block_delta' && decoded.delta?.text) {
        full += decoded.delta.text
      }
    }
  }
  return full
}

// --- Prompts ---
const SYSTEM_PROMPT = `You are a knowledge graph builder. Given a chapter from a book, extract structured information.

Output ONLY valid JSON with this exact structure:
{
  "summary": "2-3 sentence summary of the chapter",
  "concepts": [
    {
      "title": "Concept Title",
      "slug": "concept-title-in-lowercase",
      "summary": "1-2 sentence description",
      "related": ["slug-of-related-concept"]
    }
  ],
  "entities": [
    {
      "name": "Entity Name",
      "slug": "entity-name-lowercase",
      "type": "person|organization|place",
      "role": "1 sentence describing their role in this chapter"
    }
  ]
}

Rules:
- Extract 3-8 concepts per chapter (core ideas, arguments, themes — not trivial details)
- Extract entities only when they play a meaningful role (not every name mentioned)
- Slugs must be lowercase, hyphens for spaces, no special characters
- "related" references other concept slugs (from this chapter or existing concepts list)
- Use the same language as the book text for titles and summaries`

// --- Markdown generators ---
function today() { return new Date().toISOString().slice(0, 10) }

function genIndex(title, author, chapterEntries) {
  // chapterEntries: Array<{title, slug}>
  const list = chapterEntries.map((ch, i) => `${i + 1}. [[chapters/${ch.slug}|${ch.title}]]`).join('\n')
  return `---\ntitle: "${title}"\nauthor: "${author}"\ntype: book\ncreated: ${today()}\nupdated: ${today()}\n---\n\n# ${title}\n\n**Author:** ${author}\n\n## Chapters\n\n${list}\n`
}

function genChapter(title, summary, concepts, entities) {
  const cLinks = concepts.map(s => `- [[concepts/${s}]]`).join('\n') || '(none)'
  const eLinks = entities.map(s => `- [[entities/${s}]]`).join('\n') || '(none)'
  return `---\ntitle: "${title}"\ntype: chapter\ncreated: ${today()}\nupdated: ${today()}\n---\n\n## Summary\n\n${summary}\n\n## Concepts\n\n${cLinks}\n\n## Entities\n\n${eLinks}\n`
}

function genConcept(title, chapter, summary, related) {
  const rLinks = related.map(s => `- [[concepts/${s}]]`).join('\n') || '(none yet)'
  return `---\ntitle: "${title}"\ntype: concept\nchapter: "${chapter}"\nconfidence: low\ncreated: ${today()}\nupdated: ${today()}\n---\n\n## Overview\n\n${summary}\n\n## Evolution\n\n### Initial (${today()})\n- Auto-generated from book scan\n\n## Related\n\n${rLinks}\n\n## Open Questions\n\n- (to be filled through reading conversations)\n`
}

function genEntity(name, type, chapter, role) {
  return `---\ntitle: "${name}"\ntype: entity\nentity_type: ${type}\nchapter: "${chapter}"\ncreated: ${today()}\nupdated: ${today()}\n---\n\n## Overview\n\n${role}\n\n## Mentions\n\n- First appears in: ${chapter}\n`
}

function extractJson(text) {
  let str = text.trim()

  // Strip markdown code fences
  const fenceMatch = str.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (fenceMatch) str = fenceMatch[1].trim()

  // Try direct parse first
  try { return JSON.parse(str) } catch {}

  // Find the outermost { ... } block
  const firstBrace = str.indexOf('{')
  const lastBrace = str.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const candidate = str.slice(firstBrace, lastBrace + 1)
    try { return JSON.parse(candidate) } catch {}

    // Try fixing common issues: trailing commas, unescaped quotes in values
    const fixed = candidate
      .replace(/,\s*([}\]])/g, '$1')           // trailing commas
      .replace(/:\s*"([^"]*)"([^",}\]]*)"([^"]*?)"/g, ': "$1\'$2\'$3"') // nested quotes
    try { return JSON.parse(fixed) } catch {}
  }

  throw new Error(`Could not extract valid JSON from AI response (length: ${text.length})`)
}

function slugify(s) {
  return s.trim().toLowerCase()
    .replace(/[&/\\:;!?@#$%^*()+=\[\]{}<>|"'`~,]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
}

// --- Main ---
async function main() {
  const fileName = path.basename(epubPath, '.epub')
  // Extract book title and author from filename pattern "author：title"
  let bookTitle, bookAuthor
  const colonMatch = fileName.match(/^(.+?)[：:](.+)$/)
  if (colonMatch) {
    bookAuthor = colonMatch[1].trim()
    bookTitle = colonMatch[2].trim()
  } else {
    bookTitle = fileName
    bookAuthor = 'Unknown'
  }

  const bookSlug = slugify(`${bookTitle}-${bookAuthor}`)
  const wikiDir = path.join(WIKI_ROOT, bookSlug)

  console.log(`📖 Book: "${bookTitle}" by ${bookAuthor}`)
  console.log(`📁 Wiki: ${wikiDir}`)
  console.log()

  // Extract chapters
  console.log('Extracting chapters from EPUB...')
  let chapters
  try {
    chapters = await extractChapters(epubPath)
  } catch (err) {
    // Fallback: create minimal wiki if EPUB parsing fails
    console.log('EPUB extraction failed:', err.message)
    // Fallback: just create a minimal wiki with book metadata
    fs.mkdirSync(wikiDir, { recursive: true })
    fs.writeFileSync(path.join(wikiDir, 'index.md'), genIndex(bookTitle, bookAuthor, []))
    console.log('Created minimal wiki (no chapters extracted). Open the book in ReadLoop to trigger full init.')
    return
  }

  console.log(`Found ${chapters.length} chapters\n`)

  // Check for --retry: only process chapters that don't have a chapter file yet
  const retryMode = process.argv.includes('--retry')
  if (retryMode) {
    const existingChapterFiles = fs.existsSync(path.join(wikiDir, 'chapters'))
      ? fs.readdirSync(path.join(wikiDir, 'chapters')).map(f => f.replace('.md', ''))
      : []
    const before = chapters.length
    chapters = chapters.filter(ch => !existingChapterFiles.includes(ch.slug))
    console.log(`Retry mode: ${before - chapters.length} chapters already done, ${chapters.length} remaining\n`)
  }

  // Process each chapter with AI
  const results = []
  const failedChapters = []
  const existingConcepts = []

  async function processChapter(ch, label) {
    console.log(`${label} ${ch.title}`)
    const conceptsCtx = existingConcepts.length > 0
      ? `\n\n**Already extracted concepts (avoid duplicates):**\n${existingConcepts.join('\n')}`
      : ''
    const prompt = `**Book:** "${bookTitle}" by ${bookAuthor}\n\n**Chapter text:**\n${ch.text}${conceptsCtx}`

    const response = await chat(SYSTEM_PROMPT, prompt)
    const parsed = extractJson(response)
    results.push({ title: ch.title, slug: ch.slug, result: parsed })
    for (const c of parsed.concepts ?? []) existingConcepts.push(c.slug)
    console.log(`   → ${parsed.concepts?.length ?? 0} concepts, ${parsed.entities?.length ?? 0} entities`)
  }

  for (let i = 0; i < chapters.length; i++) {
    try {
      await processChapter(chapters[i], `[${i + 1}/${chapters.length}]`)
    } catch (err) {
      console.error(`   ✗ Failed: ${err.message}`)
      failedChapters.push(chapters[i])
    }
  }

  // Auto-retry failed chapters once
  if (failedChapters.length > 0) {
    console.log(`\nRetrying ${failedChapters.length} failed chapters...`)
    for (let i = 0; i < failedChapters.length; i++) {
      try {
        await processChapter(failedChapters[i], `[retry ${i + 1}/${failedChapters.length}]`)
      } catch (err) {
        console.error(`   ✗ Still failed: ${err.message}`)
      }
    }
  }

  // Generate files
  console.log('\nWriting wiki files...')

  const seenConcepts = new Map()
  const seenEntities = new Map()

  for (const ch of results) {
    for (const c of ch.result.concepts ?? []) {
      if (!seenConcepts.has(c.slug)) {
        seenConcepts.set(c.slug, { title: c.title, chapter: ch.title, summary: c.summary, related: c.related ?? [] })
      }
    }
    for (const e of ch.result.entities ?? []) {
      if (!seenEntities.has(e.slug)) {
        seenEntities.set(e.slug, { name: e.name, type: e.type, chapter: ch.title, role: e.role })
      }
    }
  }

  // Create dirs
  for (const dir of ['chapters', 'concepts', 'entities', 'conversations']) {
    fs.mkdirSync(path.join(wikiDir, dir), { recursive: true })
  }

  // Write index
  fs.writeFileSync(path.join(wikiDir, 'index.md'), genIndex(bookTitle, bookAuthor, results.map(r => ({ title: r.title, slug: r.slug }))))

  // Write chapters
  for (const ch of results) {
    fs.writeFileSync(
      path.join(wikiDir, 'chapters', `${ch.slug}.md`),
      genChapter(ch.title, ch.result.summary ?? '', (ch.result.concepts ?? []).map(c => c.slug), (ch.result.entities ?? []).map(e => e.slug))
    )
  }

  // Write concepts
  for (const [slug, c] of seenConcepts) {
    fs.writeFileSync(path.join(wikiDir, 'concepts', `${slug}.md`), genConcept(c.title, c.chapter, c.summary, c.related))
  }

  // Write entities
  for (const [slug, e] of seenEntities) {
    fs.writeFileSync(path.join(wikiDir, 'entities', `${slug}.md`), genEntity(e.name, e.type, e.chapter, e.role))
  }

  console.log(`\n✅ Done!`)
  console.log(`   ${results.length} chapters`)
  console.log(`   ${seenConcepts.size} concepts`)
  console.log(`   ${seenEntities.size} entities`)
  console.log(`\n📂 ${wikiDir}`)
  console.log(`   Open in Obsidian to browse the knowledge graph`)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
