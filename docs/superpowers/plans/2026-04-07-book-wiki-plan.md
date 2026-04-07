# Book Wiki Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each book gets an auto-generated, conversation-evolving wiki stored as Obsidian-compatible markdown files on disk, invisible to the reader but feeding context back into AI conversations.

**Architecture:** Three new modules (`src/wiki/`) handle init, update, and read. `proxy.mjs` gets 3 new endpoints for file I/O to `~/readloop/wikis/{slug}/`. The wiki bootstraps asynchronously on book open (AI scans full text by chapter), then silently updates after each conversation turn via a lightweight Haiku-tier judgment call. `buildAskContext()` reads relevant wiki nodes to enrich conversation quality.

**Tech Stack:** TypeScript (frontend wiki modules), Node.js (proxy endpoints), vitest (tests), existing AI client infrastructure (Bedrock/OpenAI/Claude).

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `src/wiki/types.ts` | Wiki-specific TypeScript types (WikiMeta, InitChapterResult, UpdateInstruction) |
| `src/wiki/initWiki.ts` | Extract full text from book → split by chapters → call AI per chapter → call proxy to write files |
| `src/wiki/updateWiki.ts` | After conversation completes → assemble context → judgment AI call → call proxy to write updates |
| `src/wiki/readWiki.ts` | Read wiki nodes from proxy → return structured data for context injection |
| `src/wiki/slugify.ts` | Deterministic slug generation for book/concept/entity file names |
| `src/wiki/prompts.ts` | System prompts for wiki init and update judgment calls |
| `src/wiki/__tests__/slugify.test.ts` | Tests for slug generation |
| `src/wiki/__tests__/prompts.test.ts` | Tests for prompt assembly |
| `src/wiki/__tests__/initWiki.test.ts` | Tests for init orchestration |
| `src/wiki/__tests__/updateWiki.test.ts` | Tests for update logic |
| `src/wiki/__tests__/readWiki.test.ts` | Tests for wiki reading |

### Modified Files

| File | Change |
|------|--------|
| `src/types.ts` | Add `wikiSlug?: string` and `wikiReady?: boolean` to `Book` interface |
| `proxy.mjs` | Add `POST /api/wiki/init`, `GET /api/wiki/read`, `POST /api/wiki/update` endpoints |
| `src/ai/context.ts` | `buildAskContext()` accepts optional `wikiContext` string, injects into user prompt |
| `src/App.tsx` | Trigger `initWiki()` on book open, trigger `updateWiki()` after `handleSendMessage` completes |
| `src/config.ts` | Add `WIKI_BASE` path constant |

---

## Task 1: Types & Slugify

**Files:**
- Create: `src/wiki/types.ts`
- Create: `src/wiki/slugify.ts`
- Create: `src/wiki/__tests__/slugify.test.ts`
- Modify: `src/types.ts:11-19`

- [ ] **Step 1: Write slugify tests**

Create `src/wiki/__tests__/slugify.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { bookSlug, nodeSlug } from '../slugify'

describe('bookSlug', () => {
  it('creates slug from title and author', () => {
    expect(bookSlug('疫年纪事', '李厚辰')).toBe('疫年纪事-李厚辰')
  })

  it('trims whitespace', () => {
    expect(bookSlug('  The Republic  ', '  Plato  ')).toBe('the-republic-plato')
  })

  it('replaces spaces and special chars with hyphens', () => {
    expect(bookSlug('War & Peace', 'Leo Tolstoy')).toBe('war-peace-leo-tolstoy')
  })

  it('collapses multiple hyphens', () => {
    expect(bookSlug('A -- B', 'C')).toBe('a-b-c')
  })
})

describe('nodeSlug', () => {
  it('creates slug from title', () => {
    expect(nodeSlug('大国幻象与经济现实的落差')).toBe('大国幻象与经济现实的落差')
  })

  it('replaces slashes and colons', () => {
    expect(nodeSlug('War/Peace: A Study')).toBe('war-peace-a-study')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/readloop && npx vitest run src/wiki/__tests__/slugify.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement slugify**

Create `src/wiki/slugify.ts`:

```typescript
export function bookSlug(title: string, author: string): string {
  return slugify(`${title}-${author}`)
}

export function nodeSlug(title: string): string {
  return slugify(title)
}

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[&/\\:;!?@#$%^*()+=\[\]{}<>|"'`~,]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/readloop && npx vitest run src/wiki/__tests__/slugify.test.ts`
Expected: PASS

- [ ] **Step 5: Create wiki types**

Create `src/wiki/types.ts`:

```typescript
export interface WikiMeta {
  slug: string
  bookId: string
  bookTitle: string
  bookAuthor: string
  ready: boolean
}

export interface InitChapterResult {
  chapterTitle: string
  chapterSlug: string
  summary: string
  concepts: ConceptInit[]
  entities: EntityInit[]
}

export interface ConceptInit {
  title: string
  slug: string
  summary: string
  related: string[]  // slugs of related concepts
}

export interface EntityInit {
  name: string
  slug: string
  type: 'person' | 'organization' | 'place'
  role: string
}

export interface UpdateInstruction {
  action: 'update_concept' | 'create_concept' | 'create_entity' | 'bump_confidence' | 'add_relation'
  target?: string        // file path relative to wiki root, e.g. "concepts/xxx.md"
  title?: string         // for create actions
  slug?: string          // for create actions
  summary?: string       // for create actions
  delta?: string         // text to append for updates
  related?: string[]     // for create/add_relation
  type?: string          // entity type for create_entity
  role?: string          // entity role for create_entity
  to?: string            // confidence level for bump
}

export interface UpdateJudgment {
  worth_saving: boolean
  updates: UpdateInstruction[]
  conversation_summary: string
}
```

- [ ] **Step 6: Add wiki fields to Book interface**

In `src/types.ts`, add two optional fields to the `Book` interface after line 17 (`updatedAt: number`):

```typescript
  wikiSlug?: string
  wikiReady?: boolean
```

- [ ] **Step 7: Commit**

```bash
cd ~/readloop
git add src/wiki/types.ts src/wiki/slugify.ts src/wiki/__tests__/slugify.test.ts src/types.ts
git commit -m "feat(wiki): add types, slugify utility, and Book wiki fields"
```

---

## Task 2: Wiki Prompts

**Files:**
- Create: `src/wiki/prompts.ts`
- Create: `src/wiki/__tests__/prompts.test.ts`

- [ ] **Step 1: Write prompt tests**

Create `src/wiki/__tests__/prompts.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { buildInitPrompt, buildUpdateJudgmentPrompt } from '../prompts'

describe('buildInitPrompt', () => {
  it('includes book title and author', () => {
    const result = buildInitPrompt('疫年纪事', '李厚辰', '第一章内容...', [])
    expect(result).toContain('疫年纪事')
    expect(result).toContain('李厚辰')
  })

  it('includes chapter text', () => {
    const result = buildInitPrompt('Book', 'Author', 'Chapter text here', [])
    expect(result).toContain('Chapter text here')
  })

  it('includes existing concepts for dedup', () => {
    const result = buildInitPrompt('Book', 'Author', 'text', ['concept-a', 'concept-b'])
    expect(result).toContain('concept-a')
    expect(result).toContain('concept-b')
  })
})

describe('buildUpdateJudgmentPrompt', () => {
  it('includes conversation messages', () => {
    const result = buildUpdateJudgmentPrompt(
      '疫年纪事',
      '李厚辰',
      '前奏 大国幻象',
      [{ role: 'user', content: '这里怎么理解', timestamp: 0 }],
      ['大国幻象: 初始摘要']
    )
    expect(result).toContain('这里怎么理解')
  })

  it('includes existing wiki nodes', () => {
    const result = buildUpdateJudgmentPrompt(
      'Book', 'Author', 'Ch1',
      [{ role: 'user', content: 'question', timestamp: 0 }],
      ['concept-a: summary of concept a']
    )
    expect(result).toContain('concept-a: summary of concept a')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/readloop && npx vitest run src/wiki/__tests__/prompts.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement prompts**

Create `src/wiki/prompts.ts`:

```typescript
import type { Message } from '../types'

export function wikiInitSystemPrompt(): string {
  return `You are a knowledge graph builder. Given a chapter from a book, extract structured information.

Output ONLY valid JSON with this exact structure:
{
  "chapter_summary": "2-3 sentence summary of the chapter",
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
}

export function buildInitPrompt(
  bookTitle: string,
  bookAuthor: string,
  chapterText: string,
  existingConcepts: string[],
): string {
  let prompt = `**Book:** "${bookTitle}" by ${bookAuthor}\n\n**Chapter text:**\n${chapterText}`

  if (existingConcepts.length > 0) {
    prompt += `\n\n**Already extracted concepts (avoid duplicates, use these slugs for "related" references):**\n${existingConcepts.join('\n')}`
  }

  return prompt
}

export function wikiUpdateSystemPrompt(): string {
  return `You are a wiki update judge. Given a conversation between a reader and AI about a book, decide if the conversation produced insights worth saving to the book's knowledge wiki.

Output ONLY valid JSON:
{
  "worth_saving": true/false,
  "updates": [
    {
      "action": "update_concept|create_concept|create_entity|bump_confidence|add_relation",
      "target": "concepts/slug.md",
      "delta": "New insight to append...",
      "title": "For create actions only",
      "slug": "for-create-actions",
      "summary": "For create actions",
      "related": ["slug1", "slug2"],
      "type": "person|organization|place",
      "role": "For entity creation",
      "to": "medium|high"
    }
  ],
  "conversation_summary": "1-2 sentence distillation of the key insight"
}

Rules:
- Set worth_saving=false for casual chat, repeated questions, or trivial exchanges
- update_concept: append new understanding to an existing concept's Evolution section
- create_concept: only when the conversation surfaces a genuinely new theme not in existing wiki
- bump_confidence: low→medium when user discusses a concept; medium→high when deep discussion
- add_relation: when conversation reveals a connection between two existing concepts
- conversation_summary: capture the KEY insight, not a transcript summary
- Keep updates minimal — typically 1-3 per conversation turn, often 0`
}

export function buildUpdateJudgmentPrompt(
  bookTitle: string,
  bookAuthor: string,
  currentChapter: string,
  conversation: Message[],
  existingNodes: string[],
): string {
  const conversationText = conversation
    .map(m => `[${m.role === 'user' ? '读者' : 'AI'}]: ${m.content}`)
    .join('\n\n')

  let prompt = `**Book:** "${bookTitle}" by ${bookAuthor}\n**Chapter:** ${currentChapter}\n\n**Conversation:**\n${conversationText}`

  if (existingNodes.length > 0) {
    prompt += `\n\n**Current wiki nodes:**\n${existingNodes.join('\n')}`
  }

  return prompt
}

export function buildWikiContextBlock(nodes: { title: string; confidence: string; summary: string }[]): string {
  if (nodes.length === 0) return ''

  const lines = nodes.map(n =>
    `- "${n.title}" (confidence: ${n.confidence}): ${n.summary}`
  )

  return `\n\nThe reader has previously explored these concepts in this book:\n${lines.join('\n')}\n\nBuild on their existing understanding. Don't repeat what they already know.`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/readloop && npx vitest run src/wiki/__tests__/prompts.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd ~/readloop
git add src/wiki/prompts.ts src/wiki/__tests__/prompts.test.ts
git commit -m "feat(wiki): add init and update judgment prompts"
```

---

## Task 3: Proxy Wiki Endpoints

**Files:**
- Modify: `proxy.mjs:153-315`
- Modify: `src/config.ts`

- [ ] **Step 1: Add WIKI_BASE to config**

In `src/config.ts`, append:

```typescript
export const WIKI_BASE = `${PROXY_BASE}/api/wiki`
```

- [ ] **Step 2: Add wiki endpoints to proxy.mjs**

After the Local Book Scanner section (after line 258, before `// ========== Server ==========`), add:

```javascript
// ========== Wiki File I/O ==========
const WIKI_ROOT = path.join(os.homedir(), 'readloop', 'wikis')

async function handleWikiInit(req, res) {
  let body = ''
  for await (const chunk of req) body += chunk

  try {
    const { slug, files } = JSON.parse(body)
    // files: Array<{ path: string, content: string }>
    // path is relative to wiki root, e.g. "疫年纪事-李厚辰/concepts/大国幻象.md"

    const wikiDir = path.join(WIKI_ROOT, slug)
    const dirs = new Set()

    for (const file of files) {
      const fullPath = path.join(wikiDir, file.path)
      // Security: ensure path stays within wiki dir
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
  const filePath = url.searchParams.get('path') // relative path like "concepts/大国幻象.md"

  if (!slug) {
    res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
    res.end(JSON.stringify({ error: 'Missing slug parameter' }))
    return
  }

  const wikiDir = path.join(WIKI_ROOT, slug)

  try {
    if (filePath) {
      // Read single file
      const fullPath = path.resolve(path.join(wikiDir, filePath))
      if (!fullPath.startsWith(path.resolve(wikiDir))) {
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
      // List all markdown files in wiki
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
    // files: Array<{ path: string, content: string, mode: 'write' | 'append' }>

    const wikiDir = path.join(WIKI_ROOT, slug)

    for (const file of files) {
      const fullPath = path.resolve(path.join(wikiDir, file.path))
      if (!fullPath.startsWith(path.resolve(wikiDir))) continue

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
```

- [ ] **Step 3: Register wiki routes in server handler**

In `proxy.mjs`, inside the `http.createServer` callback, after the Bedrock route block (after line 279) and before the local-books route, add:

```javascript
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
```

- [ ] **Step 4: Update server startup log**

In `proxy.mjs`, update the `server.listen` log to add:

```javascript
  console.log('  Wiki:      ~/readloop/wikis/')
```

- [ ] **Step 5: Manually test proxy**

```bash
cd ~/readloop
# Start proxy in background if not running
node proxy.mjs &

# Test wiki init
curl -s -X POST http://localhost:3001/api/wiki/init \
  -H 'Content-Type: application/json' \
  -d '{"slug":"test-book","files":[{"path":"index.md","content":"# Test\n"}]}' | jq .

# Test wiki read (list)
curl -s 'http://localhost:3001/api/wiki/read?slug=test-book' | jq .

# Test wiki read (single file)
curl -s 'http://localhost:3001/api/wiki/read?slug=test-book&path=index.md' | jq .

# Test wiki update (append)
curl -s -X POST http://localhost:3001/api/wiki/update \
  -H 'Content-Type: application/json' \
  -d '{"slug":"test-book","files":[{"path":"index.md","content":"## Updated","mode":"append"}]}' | jq .

# Clean up test
rm -rf ~/readloop/wikis/test-book

# Kill background proxy
kill %1
```

Expected: All return `{"ok": true}` or proper file content.

- [ ] **Step 6: Commit**

```bash
cd ~/readloop
git add proxy.mjs src/config.ts
git commit -m "feat(wiki): add proxy endpoints for wiki file I/O"
```

---

## Task 4: readWiki Module

**Files:**
- Create: `src/wiki/readWiki.ts`
- Create: `src/wiki/__tests__/readWiki.test.ts`

- [ ] **Step 1: Write readWiki tests**

Create `src/wiki/__tests__/readWiki.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readWikiNode, listWikiFiles, readChapterConcepts, parseMarkdownFrontmatter } from '../readWiki'

// Mock fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  mockFetch.mockReset()
})

describe('parseMarkdownFrontmatter', () => {
  it('extracts frontmatter fields', () => {
    const md = `---
title: "大国幻象"
type: concept
confidence: low
related: ["concepts/疫情叙事"]
---

## Overview
Some content here.`

    const result = parseMarkdownFrontmatter(md)
    expect(result.title).toBe('大国幻象')
    expect(result.type).toBe('concept')
    expect(result.confidence).toBe('low')
    expect(result.body).toContain('## Overview')
  })

  it('returns empty fields for no frontmatter', () => {
    const result = parseMarkdownFrontmatter('Just plain text')
    expect(result.title).toBeUndefined()
    expect(result.body).toBe('Just plain text')
  })
})

describe('readWikiNode', () => {
  it('fetches and parses a wiki node', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: `---\ntitle: "Test"\ntype: concept\nconfidence: medium\n---\nBody text`
      }),
    })

    const result = await readWikiNode('my-book', 'concepts/test.md')
    expect(result.title).toBe('Test')
    expect(result.confidence).toBe('medium')
    expect(result.body).toBe('Body text')
  })

  it('returns null for 404', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    })

    const result = await readWikiNode('my-book', 'concepts/missing.md')
    expect(result).toBeNull()
  })
})

describe('listWikiFiles', () => {
  it('returns file list from proxy', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ files: ['index.md', 'concepts/a.md', 'concepts/b.md'] }),
    })

    const files = await listWikiFiles('my-book')
    expect(files).toEqual(['index.md', 'concepts/a.md', 'concepts/b.md'])
  })
})

describe('readChapterConcepts', () => {
  it('reads concept nodes for a chapter', async () => {
    // First call: list files
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ files: ['concepts/a.md', 'concepts/b.md', 'chapters/01-ch1.md'] }),
    })
    // Second call: read chapter to find linked concepts
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: `---\ntitle: "Chapter 1"\ntype: chapter\n---\n\nConcepts: [[concepts/a]]`
      }),
    })
    // Third call: read concept a
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: `---\ntitle: "Concept A"\ntype: concept\nconfidence: low\n---\nSummary of A`
      }),
    })

    const concepts = await readChapterConcepts('my-book', '01-ch1')
    expect(concepts.length).toBe(1)
    expect(concepts[0].title).toBe('Concept A')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/readloop && npx vitest run src/wiki/__tests__/readWiki.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement readWiki**

Create `src/wiki/readWiki.ts`:

```typescript
import { WIKI_BASE } from '../config'

export interface WikiNode {
  title?: string
  type?: string
  confidence?: string
  chapter?: string
  related?: string[]
  body: string
}

export function parseMarkdownFrontmatter(markdown: string): WikiNode {
  const fmMatch = markdown.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!fmMatch) {
    return { body: markdown }
  }

  const frontmatter = fmMatch[1]
  const body = fmMatch[2].trim()
  const node: WikiNode = { body }

  for (const line of frontmatter.split('\n')) {
    const match = line.match(/^(\w+):\s*(.+)$/)
    if (!match) continue
    const [, key, rawValue] = match
    const value = rawValue.replace(/^["']|["']$/g, '')

    if (key === 'title') node.title = value
    else if (key === 'type') node.type = value
    else if (key === 'confidence') node.confidence = value
    else if (key === 'chapter') node.chapter = value
    else if (key === 'related') {
      try {
        node.related = JSON.parse(rawValue)
      } catch {
        node.related = []
      }
    }
  }

  return node
}

export async function readWikiNode(slug: string, filePath: string): Promise<WikiNode | null> {
  try {
    const response = await fetch(
      `${WIKI_BASE}/read?slug=${encodeURIComponent(slug)}&path=${encodeURIComponent(filePath)}`
    )
    if (!response.ok) return null
    const { content } = await response.json()
    return parseMarkdownFrontmatter(content)
  } catch {
    return null
  }
}

export async function listWikiFiles(slug: string): Promise<string[]> {
  try {
    const response = await fetch(`${WIKI_BASE}/read?slug=${encodeURIComponent(slug)}`)
    if (!response.ok) return []
    const { files } = await response.json()
    return files
  } catch {
    return []
  }
}

export async function readChapterConcepts(
  slug: string,
  chapterSlug: string,
): Promise<{ title: string; confidence: string; summary: string }[]> {
  const files = await listWikiFiles(slug)
  const conceptFiles = files.filter(f => f.startsWith('concepts/'))

  // Read chapter file to find linked concepts
  const chapterFile = files.find(f => f.startsWith('chapters/') && f.includes(chapterSlug))
  const linkedSlugs = new Set<string>()

  if (chapterFile) {
    const chapterNode = await readWikiNode(slug, chapterFile)
    if (chapterNode) {
      const links = chapterNode.body.match(/\[\[concepts\/([^\]]+)\]\]/g) ?? []
      for (const link of links) {
        const match = link.match(/\[\[concepts\/([^\]]+)\]\]/)
        if (match) linkedSlugs.add(`concepts/${match[1]}.md`)
      }
    }
  }

  // If no linked concepts found, read all concepts (fallback for early state)
  const toRead = linkedSlugs.size > 0
    ? conceptFiles.filter(f => linkedSlugs.has(f))
    : conceptFiles.slice(0, 5) // limit to 5 most recent

  const results: { title: string; confidence: string; summary: string }[] = []

  for (const file of toRead) {
    const node = await readWikiNode(slug, file)
    if (node?.title) {
      // Extract first paragraph as summary
      const summary = node.body.split('\n\n')[0] ?? ''
      results.push({
        title: node.title,
        confidence: node.confidence ?? 'low',
        summary: summary.slice(0, 200),
      })
    }
  }

  return results
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/readloop && npx vitest run src/wiki/__tests__/readWiki.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd ~/readloop
git add src/wiki/readWiki.ts src/wiki/__tests__/readWiki.test.ts
git commit -m "feat(wiki): add readWiki module for fetching wiki nodes"
```

---

## Task 5: initWiki Module

**Files:**
- Create: `src/wiki/initWiki.ts`
- Create: `src/wiki/__tests__/initWiki.test.ts`

- [ ] **Step 1: Write initWiki tests**

Create `src/wiki/__tests__/initWiki.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildWikiFiles, generateBookIndex, generateChapterFile, generateConceptFile, generateEntityFile } from '../initWiki'
import type { InitChapterResult } from '../types'

describe('generateBookIndex', () => {
  it('creates index.md content with frontmatter', () => {
    const result = generateBookIndex('疫年纪事', '李厚辰', ['前奏 大国幻象', '第一章 封城'])
    expect(result).toContain('title: "疫年纪事"')
    expect(result).toContain('author: "李厚辰"')
    expect(result).toContain('前奏 大国幻象')
    expect(result).toContain('第一章 封城')
  })
})

describe('generateChapterFile', () => {
  it('creates chapter markdown with concepts and entities', () => {
    const result = generateChapterFile('前奏 大国幻象', 'A chapter about...', ['大国幻象'], ['习近平'])
    expect(result).toContain('title: "前奏 大国幻象"')
    expect(result).toContain('type: chapter')
    expect(result).toContain('[[concepts/大国幻象]]')
    expect(result).toContain('[[entities/习近平]]')
  })
})

describe('generateConceptFile', () => {
  it('creates concept markdown with low confidence', () => {
    const result = generateConceptFile('大国幻象', '前奏 大国幻象', 'Summary text', ['疫情叙事'])
    expect(result).toContain('title: "大国幻象"')
    expect(result).toContain('confidence: low')
    expect(result).toContain('chapter: "前奏 大国幻象"')
    expect(result).toContain('Summary text')
    expect(result).toContain('[[concepts/疫情叙事]]')
  })
})

describe('generateEntityFile', () => {
  it('creates entity markdown', () => {
    const result = generateEntityFile('习近平', 'person', '前奏 大国幻象', 'Role description')
    expect(result).toContain('title: "习近平"')
    expect(result).toContain('entity_type: person')
    expect(result).toContain('Role description')
  })
})

describe('buildWikiFiles', () => {
  it('assembles all files from chapter results', () => {
    const chapters: { title: string; slug: string; result: InitChapterResult }[] = [
      {
        title: '前奏',
        slug: '01-前奏',
        result: {
          chapterTitle: '前奏',
          chapterSlug: '01-前奏',
          summary: 'Chapter summary',
          concepts: [
            { title: '大国幻象', slug: '大国幻象', summary: 'Concept summary', related: [] },
          ],
          entities: [
            { name: '习近平', slug: '习近平', type: 'person', role: 'Leader' },
          ],
        },
      },
    ]

    const files = buildWikiFiles('疫年纪事', '李厚辰', chapters)

    const paths = files.map(f => f.path)
    expect(paths).toContain('index.md')
    expect(paths).toContain('chapters/01-前奏.md')
    expect(paths).toContain('concepts/大国幻象.md')
    expect(paths).toContain('entities/习近平.md')
  })

  it('deduplicates concepts across chapters', () => {
    const chapters = [
      {
        title: 'Ch1', slug: '01-ch1',
        result: {
          chapterTitle: 'Ch1', chapterSlug: '01-ch1', summary: 's1',
          concepts: [{ title: 'A', slug: 'a', summary: 's', related: [] }],
          entities: [],
        },
      },
      {
        title: 'Ch2', slug: '02-ch2',
        result: {
          chapterTitle: 'Ch2', chapterSlug: '02-ch2', summary: 's2',
          concepts: [{ title: 'A', slug: 'a', summary: 'updated', related: [] }],
          entities: [],
        },
      },
    ]

    const files = buildWikiFiles('Book', 'Author', chapters)
    const conceptFiles = files.filter(f => f.path.startsWith('concepts/'))
    expect(conceptFiles.length).toBe(1) // deduplicated
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/readloop && npx vitest run src/wiki/__tests__/initWiki.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement initWiki**

Create `src/wiki/initWiki.ts`:

```typescript
import { WIKI_BASE } from '../config'
import { createAiClient } from '../ai/client'
import { loadSettings } from '../settings/SettingsModal'
import { bookSlug } from './slugify'
import { wikiInitSystemPrompt, buildInitPrompt } from './prompts'
import type { InitChapterResult } from './types'
import type { Book } from '../types'
import { getStore } from '../db/store'

interface WikiFile {
  path: string
  content: string
}

export function generateBookIndex(title: string, author: string, chapterTitles: string[]): string {
  const chapterList = chapterTitles.map((t, i) => `${i + 1}. [[chapters/${t}]]`).join('\n')
  return `---
title: "${title}"
author: "${author}"
type: book
created: ${today()}
updated: ${today()}
---

# ${title}

**Author:** ${author}

## Chapters

${chapterList}
`
}

export function generateChapterFile(
  title: string,
  summary: string,
  conceptSlugs: string[],
  entitySlugs: string[],
): string {
  const conceptLinks = conceptSlugs.map(s => `- [[concepts/${s}]]`).join('\n')
  const entityLinks = entitySlugs.map(s => `- [[entities/${s}]]`).join('\n')

  return `---
title: "${title}"
type: chapter
created: ${today()}
updated: ${today()}
---

## Summary

${summary}

## Concepts

${conceptLinks || '(none yet)'}

## Entities

${entityLinks || '(none yet)'}
`
}

export function generateConceptFile(
  title: string,
  chapter: string,
  summary: string,
  relatedSlugs: string[],
): string {
  const relatedLinks = relatedSlugs.map(s => `- [[concepts/${s}]]`).join('\n')

  return `---
title: "${title}"
type: concept
chapter: "${chapter}"
confidence: low
created: ${today()}
updated: ${today()}
---

## Overview

${summary}

## Evolution

### Initial (${today()})
- Auto-generated from book scan

## Related

${relatedLinks || '(none yet)'}

## Open Questions

- (to be filled through reading conversations)
`
}

export function generateEntityFile(
  name: string,
  entityType: string,
  chapter: string,
  role: string,
): string {
  return `---
title: "${name}"
type: entity
entity_type: ${entityType}
chapter: "${chapter}"
created: ${today()}
updated: ${today()}
---

## Overview

${role}

## Mentions

- First appears in: ${chapter}
`
}

export function buildWikiFiles(
  bookTitle: string,
  bookAuthor: string,
  chapters: { title: string; slug: string; result: InitChapterResult }[],
): WikiFile[] {
  const files: WikiFile[] = []
  const seenConcepts = new Map<string, { title: string; chapter: string; summary: string; related: string[] }>()
  const seenEntities = new Map<string, { name: string; type: string; chapter: string; role: string }>()

  // Process chapters, deduplicate concepts and entities
  for (const ch of chapters) {
    for (const c of ch.result.concepts) {
      if (!seenConcepts.has(c.slug)) {
        seenConcepts.set(c.slug, { title: c.title, chapter: ch.title, summary: c.summary, related: c.related })
      }
    }
    for (const e of ch.result.entities) {
      if (!seenEntities.has(e.slug)) {
        seenEntities.set(e.slug, { name: e.name, type: e.type, chapter: ch.title, role: e.role })
      }
    }
  }

  // Index
  files.push({
    path: 'index.md',
    content: generateBookIndex(bookTitle, bookAuthor, chapters.map(c => c.title)),
  })

  // Chapters
  for (const ch of chapters) {
    files.push({
      path: `chapters/${ch.slug}.md`,
      content: generateChapterFile(
        ch.title,
        ch.result.summary,
        ch.result.concepts.map(c => c.slug),
        ch.result.entities.map(e => e.slug),
      ),
    })
  }

  // Concepts
  for (const [slug, c] of seenConcepts) {
    files.push({
      path: `concepts/${slug}.md`,
      content: generateConceptFile(c.title, c.chapter, c.summary, c.related),
    })
  }

  // Entities
  for (const [slug, e] of seenEntities) {
    files.push({
      path: `entities/${slug}.md`,
      content: generateEntityFile(e.name, e.type, e.chapter, e.role),
    })
  }

  return files
}

export interface ChapterText {
  title: string
  slug: string
  text: string
}

export async function initWiki(book: Book, chapters: ChapterText[]): Promise<string> {
  const slug = bookSlug(book.title, book.author)
  const settings = loadSettings()
  const client = createAiClient({
    provider: settings.provider,
    apiKey: settings.apiKey,
    model: settings.model,
    baseUrl: settings.baseUrl,
  })

  const systemPrompt = wikiInitSystemPrompt()
  const results: { title: string; slug: string; result: InitChapterResult }[] = []
  const existingConcepts: string[] = []

  for (const chapter of chapters) {
    const userPrompt = buildInitPrompt(book.title, book.author, chapter.text, existingConcepts)

    try {
      const response = await client.chat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        () => {}, // no streaming needed
      )

      const parsed: InitChapterResult = JSON.parse(response)
      results.push({ title: chapter.title, slug: chapter.slug, result: parsed })

      // Accumulate concepts for dedup in next chapter
      for (const c of parsed.concepts) {
        existingConcepts.push(c.slug)
      }
    } catch (err) {
      console.error(`Wiki init failed for chapter "${chapter.title}":`, err)
      // Continue with other chapters
    }
  }

  const files = buildWikiFiles(book.title, book.author, results)

  // Write all files via proxy
  await fetch(`${WIKI_BASE}/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug, files }),
  })

  // Update book in IndexedDB
  const db = await getStore()
  await db.updateBook({ ...book, wikiSlug: slug, wikiReady: true, updatedAt: Date.now() })

  return slug
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/readloop && npx vitest run src/wiki/__tests__/initWiki.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd ~/readloop
git add src/wiki/initWiki.ts src/wiki/__tests__/initWiki.test.ts
git commit -m "feat(wiki): add initWiki module for book wiki initialization"
```

---

## Task 6: updateWiki Module

**Files:**
- Create: `src/wiki/updateWiki.ts`
- Create: `src/wiki/__tests__/updateWiki.test.ts`

- [ ] **Step 1: Write updateWiki tests**

Create `src/wiki/__tests__/updateWiki.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildUpdateFiles, applyBumpConfidence } from '../updateWiki'
import type { UpdateJudgment } from '../types'

describe('buildUpdateFiles', () => {
  it('returns empty for worth_saving=false', () => {
    const judgment: UpdateJudgment = {
      worth_saving: false,
      updates: [],
      conversation_summary: '',
    }
    const files = buildUpdateFiles(judgment, 'ch01', 1, '前奏 大国幻象')
    expect(files).toEqual([])
  })

  it('creates conversation file when worth saving', () => {
    const judgment: UpdateJudgment = {
      worth_saving: true,
      updates: [],
      conversation_summary: 'Key insight about economy',
    }
    const files = buildUpdateFiles(judgment, 'ch01', 1, '前奏 大国幻象')
    const convFile = files.find(f => f.path.startsWith('conversations/'))
    expect(convFile).toBeTruthy()
    expect(convFile!.content).toContain('Key insight about economy')
  })

  it('creates update_concept append file', () => {
    const judgment: UpdateJudgment = {
      worth_saving: true,
      updates: [
        { action: 'update_concept', target: 'concepts/大国幻象.md', delta: 'New understanding...' }
      ],
      conversation_summary: 'summary',
    }
    const files = buildUpdateFiles(judgment, 'ch01', 1, '前奏')
    const updateFile = files.find(f => f.path === 'concepts/大国幻象.md')
    expect(updateFile).toBeTruthy()
    expect(updateFile!.mode).toBe('append')
    expect(updateFile!.content).toContain('New understanding...')
  })

  it('creates new concept file for create_concept', () => {
    const judgment: UpdateJudgment = {
      worth_saving: true,
      updates: [
        {
          action: 'create_concept',
          title: '信息茧房',
          slug: '信息茧房',
          summary: 'Echo chamber effect',
          related: ['大国幻象'],
        }
      ],
      conversation_summary: 'summary',
    }
    const files = buildUpdateFiles(judgment, 'ch01', 1, '前奏')
    const newConcept = files.find(f => f.path === 'concepts/信息茧房.md')
    expect(newConcept).toBeTruthy()
    expect(newConcept!.mode).toBe('write')
    expect(newConcept!.content).toContain('title: "信息茧房"')
  })
})

describe('applyBumpConfidence', () => {
  it('replaces confidence in frontmatter', () => {
    const content = `---\ntitle: "Test"\nconfidence: low\n---\nBody`
    const result = applyBumpConfidence(content, 'medium')
    expect(result).toContain('confidence: medium')
    expect(result).not.toContain('confidence: low')
  })

  it('returns unchanged if no confidence field', () => {
    const content = `---\ntitle: "Test"\n---\nBody`
    const result = applyBumpConfidence(content, 'medium')
    expect(result).toBe(content)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/readloop && npx vitest run src/wiki/__tests__/updateWiki.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement updateWiki**

Create `src/wiki/updateWiki.ts`:

```typescript
import { WIKI_BASE } from '../config'
import { createAiClient } from '../ai/client'
import { loadSettings } from '../settings/SettingsModal'
import { wikiUpdateSystemPrompt, buildUpdateJudgmentPrompt } from './prompts'
import { generateConceptFile, generateEntityFile } from './initWiki'
import { listWikiFiles, readWikiNode } from './readWiki'
import type { UpdateJudgment } from './types'
import type { Book, Message } from '../types'

interface UpdateFile {
  path: string
  content: string
  mode: 'write' | 'append'
}

export function applyBumpConfidence(content: string, to: string): string {
  return content.replace(/confidence: (low|medium|high)/, `confidence: ${to}`)
}

export function buildUpdateFiles(
  judgment: UpdateJudgment,
  chapterSlug: string,
  conversationIndex: number,
  chapterTitle: string,
): UpdateFile[] {
  if (!judgment.worth_saving) return []

  const files: UpdateFile[] = []
  const timestamp = new Date().toISOString().slice(0, 10)

  // Save conversation distillation
  files.push({
    path: `conversations/${chapterSlug}-${String(conversationIndex).padStart(3, '0')}.md`,
    content: `---
title: "${judgment.conversation_summary.slice(0, 60)}"
type: conversation
chapter: "${chapterTitle}"
created: ${timestamp}
---

${judgment.conversation_summary}
`,
    mode: 'write',
  })

  for (const update of judgment.updates) {
    switch (update.action) {
      case 'update_concept': {
        if (!update.target || !update.delta) break
        files.push({
          path: update.target,
          content: `\n### ${timestamp} (conversation)\n- ${update.delta}`,
          mode: 'append',
        })
        break
      }
      case 'create_concept': {
        if (!update.title || !update.slug) break
        files.push({
          path: `concepts/${update.slug}.md`,
          content: generateConceptFile(
            update.title,
            chapterTitle,
            update.summary ?? '',
            update.related ?? [],
          ),
          mode: 'write',
        })
        break
      }
      case 'create_entity': {
        if (!update.title || !update.slug) break
        files.push({
          path: `entities/${update.slug}.md`,
          content: generateEntityFile(
            update.title,
            update.type ?? 'person',
            chapterTitle,
            update.role ?? '',
          ),
          mode: 'write',
        })
        break
      }
      case 'bump_confidence': {
        if (!update.target || !update.to) break
        // bump_confidence needs a read-then-write, handled separately in updateWiki()
        // Here we just record the intent; actual file content replacement happens in the caller
        files.push({
          path: update.target,
          content: `__BUMP_CONFIDENCE__:${update.to}`,
          mode: 'write',
        })
        break
      }
      case 'add_relation': {
        if (!update.target) break
        const relatedLinks = (update.related ?? []).map(s => `- [[concepts/${s}]]`).join('\n')
        files.push({
          path: update.target,
          content: `\n${relatedLinks}`,
          mode: 'append',
        })
        break
      }
    }
  }

  return files
}

export async function updateWiki(
  book: Book,
  conversation: Message[],
  currentChapter: string,
  chapterSlug: string,
): Promise<void> {
  if (!book.wikiSlug || !book.wikiReady) return
  if (conversation.length < 2) return // need at least one exchange

  const slug = book.wikiSlug

  // Read existing wiki nodes for context
  const files = await listWikiFiles(slug)
  const conceptFiles = files.filter(f => f.startsWith('concepts/'))
  const existingNodes: string[] = []

  for (const f of conceptFiles.slice(0, 10)) {
    const node = await readWikiNode(slug, f)
    if (node?.title) {
      const summary = node.body.split('\n\n')[0] ?? ''
      existingNodes.push(`${node.title}: ${summary.slice(0, 100)}`)
    }
  }

  // Count existing conversations for this chapter
  const convFiles = files.filter(f => f.startsWith(`conversations/${chapterSlug}`))
  const conversationIndex = convFiles.length + 1

  // Call AI for judgment
  const settings = loadSettings()
  const client = createAiClient({
    provider: settings.provider,
    apiKey: settings.apiKey,
    model: settings.model,
    baseUrl: settings.baseUrl,
  })

  const systemPrompt = wikiUpdateSystemPrompt()
  const userPrompt = buildUpdateJudgmentPrompt(
    book.title,
    book.author,
    currentChapter,
    conversation,
    existingNodes,
  )

  try {
    const response = await client.chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      () => {},
    )

    const judgment: UpdateJudgment = JSON.parse(response)
    const updateFiles = buildUpdateFiles(judgment, chapterSlug, conversationIndex, currentChapter)

    if (updateFiles.length === 0) return

    // Handle bump_confidence: read current content, replace, then write
    const finalFiles: { path: string; content: string; mode: string }[] = []

    for (const f of updateFiles) {
      if (f.content.startsWith('__BUMP_CONFIDENCE__:')) {
        const newConfidence = f.content.split(':')[1]
        const node = await readWikiNode(slug, f.path)
        if (node) {
          const fullContent = await fetch(
            `${WIKI_BASE}/read?slug=${encodeURIComponent(slug)}&path=${encodeURIComponent(f.path)}`
          ).then(r => r.json()).then(d => d.content)
          finalFiles.push({
            path: f.path,
            content: applyBumpConfidence(fullContent, newConfidence),
            mode: 'write',
          })
        }
      } else {
        finalFiles.push(f)
      }
    }

    await fetch(`${WIKI_BASE}/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, files: finalFiles }),
    })
  } catch (err) {
    console.error('Wiki update failed:', err)
    // Silent failure — don't break the reading experience
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/readloop && npx vitest run src/wiki/__tests__/updateWiki.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd ~/readloop
git add src/wiki/updateWiki.ts src/wiki/__tests__/updateWiki.test.ts
git commit -m "feat(wiki): add updateWiki module for conversation-driven wiki updates"
```

---

## Task 7: Context Integration

**Files:**
- Modify: `src/ai/context.ts:1-64`
- Create: `src/wiki/__tests__/context-integration.test.ts`

- [ ] **Step 1: Write context integration test**

Create `src/wiki/__tests__/context-integration.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { buildAskContext } from '../../ai/context'

describe('buildAskContext with wiki context', () => {
  const baseInput = {
    bookTitle: '疫年纪事',
    bookAuthor: '李厚辰',
    currentChapter: '前奏 大国幻象',
    paragraphs: ['Paragraph 1', 'Paragraph 2', 'Paragraph 3'],
    currentParagraphIndex: 1,
    selectedText: 'selected text here',
    userQuery: 'What does this mean?',
    nearbyAnnotations: [],
  }

  it('works without wiki context (backwards compatible)', () => {
    const { userPrompt } = buildAskContext(baseInput)
    expect(userPrompt).toContain('selected text here')
    expect(userPrompt).not.toContain('previously explored')
  })

  it('injects wiki context when provided', () => {
    const wikiContext = '\n\nThe reader has previously explored these concepts in this book:\n- "大国幻象" (confidence: medium): Summary text\n\nBuild on their existing understanding.'
    const { userPrompt } = buildAskContext({ ...baseInput, wikiContext })
    expect(userPrompt).toContain('previously explored')
    expect(userPrompt).toContain('大国幻象')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/readloop && npx vitest run src/wiki/__tests__/context-integration.test.ts`
Expected: FAIL (wikiContext not a valid property yet)

- [ ] **Step 3: Add wikiContext to buildAskContext**

In `src/ai/context.ts`, add `wikiContext` to the `AskContextInput` interface (after `mode?: AiMode`):

```typescript
  wikiContext?: string
```

Then, at the end of the `buildAskContext` function, before the `return` statement, add:

```typescript
  if (input.wikiContext) {
    userPrompt += input.wikiContext
  }
```

The full modified interface should be:

```typescript
interface AskContextInput {
  bookTitle: string
  bookAuthor: string
  currentChapter: string
  paragraphs: string[]
  currentParagraphIndex: number
  selectedText: string
  userQuery: string
  nearbyAnnotations: Annotation[]
  mode?: AiMode
  wikiContext?: string
}
```

And the function body ends with:

```typescript
  if (input.wikiContext) {
    userPrompt += input.wikiContext
  }

  return {
    systemPrompt: askSystemPrompt(bookTitle, bookAuthor, mode),
    userPrompt,
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/readloop && npx vitest run src/wiki/__tests__/context-integration.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd ~/readloop
git add src/ai/context.ts src/wiki/__tests__/context-integration.test.ts
git commit -m "feat(wiki): add wikiContext injection to buildAskContext"
```

---

## Task 8: App Integration

**Files:**
- Modify: `src/App.tsx`

This task wires everything together: init on book open, wiki context in conversations, update after messages.

- [ ] **Step 1: Add wiki imports to App.tsx**

At the top of `src/App.tsx`, after the existing imports (around line 17), add:

```typescript
import { initWiki, type ChapterText } from './wiki/initWiki'
import { updateWiki } from './wiki/updateWiki'
import { readChapterConcepts } from './wiki/readWiki'
import { bookSlug } from './wiki/slugify'
import { buildWikiContextBlock } from './wiki/prompts'
```

- [ ] **Step 2: Add wiki initialization to handleOpenBook**

Replace the `handleOpenBook` callback (lines 92-98) with:

```typescript
  const handleOpenBook = useCallback(async (id: string, fileData: ArrayBuffer) => {
    const db = await getStore()
    const book = await db.getBook(id)
    if (book) {
      setCurrentBook(book)
      // Trigger wiki init asynchronously if not ready
      if (!book.wikiReady) {
        // Wiki init runs in background — no await, no blocking
        extractChaptersFromBook(book, fileData).then(chapters => {
          if (chapters.length > 0) {
            initWiki(book, chapters).then(slug => {
              setCurrentBook(prev => prev ? { ...prev, wikiSlug: slug, wikiReady: true } : prev)
            }).catch(err => console.error('Wiki init failed:', err))
          }
        })
      }
    }
    setPdfData(fileData)
    setView('reader')
  }, [])
```

- [ ] **Step 3: Add chapter extraction helper**

After `handleOpenBook`, add the helper function:

```typescript
  // Extract chapters from EPUB for wiki initialization
  async function extractChaptersFromBook(book: Book, fileData: ArrayBuffer): Promise<ChapterText[]> {
    if (book.format !== 'epub') return [] // PDF support can be added later

    try {
      const ePubLib = await import('epubjs')
      const epubBook = ePubLib.default(fileData)
      await epubBook.ready
      const nav = await epubBook.loaded.navigation
      const spine = epubBook.spine as unknown as { items: Array<{ href: string; load: (resolver: unknown) => Promise<{ document: Document }> }> }

      const chapters: ChapterText[] = []
      let chapterIndex = 0

      for (const item of spine.items) {
        try {
          const section = await item.load(epubBook.load.bind(epubBook))
          const text = section.document.body?.textContent?.trim() ?? ''
          if (text.length < 50) continue // Skip trivially short sections

          const navItem = nav.toc.find(t => {
            const tocBase = t.href.split('#')[0]
            return item.href.endsWith(tocBase) || tocBase.endsWith(item.href)
          })

          const title = navItem?.label?.trim() ?? `Section ${chapterIndex + 1}`
          const slug = `${String(chapterIndex + 1).padStart(2, '0')}-${title.replace(/[\/\\:]/g, '-').slice(0, 50)}`

          chapters.push({ title, slug, text: text.slice(0, 8000) }) // Cap at 8K chars per chapter
          chapterIndex++
        } catch {
          // Skip sections that fail to load
        }
      }

      epubBook.destroy()
      return chapters
    } catch (err) {
      console.error('Chapter extraction failed:', err)
      return []
    }
  }
```

- [ ] **Step 4: Add wiki context to handleSendMessage**

Replace the `handleSendMessage` callback (lines 231-268) with:

```typescript
  const handleSendMessage = useCallback(async (query: string) => {
    if (!currentBook) return

    const userMsg: Message = { role: 'user', content: query, timestamp: Date.now() }
    setActiveConversation(prev => prev ? [...prev, userMsg] : [userMsg])

    // Build wiki context if available
    let wikiContext: string | undefined
    if (currentBook.wikiReady && currentBook.wikiSlug) {
      try {
        const concepts = await readChapterConcepts(currentBook.wikiSlug, '')
        wikiContext = buildWikiContextBlock(concepts)
      } catch {
        // Wiki read failed — continue without wiki context
      }
    }

    try {
      const result = await ai.askAi({
        bookTitle: currentBook.title,
        bookAuthor: currentBook.author,
        currentChapter: '',
        paragraphs: [selectedText],
        currentParagraphIndex: 0,
        selectedText,
        userQuery: query,
        nearbyAnnotations: annotations,
        mode: aiMode,
        wikiContext,
      })

      const assistantMsg: Message = { role: 'assistant', content: result, timestamp: Date.now() }
      setActiveConversation(prev => {
        const updated = prev ? [...prev, assistantMsg] : [assistantMsg]
        if (activeAnnotationId) {
          const ann = annotations.find(a => a.id === activeAnnotationId)
          if (ann) {
            updateAnnotation({
              ...ann,
              conversation: updated,
              updatedAt: Date.now(),
            })
          }
        }

        // Trigger wiki update in background (non-blocking)
        if (currentBook.wikiReady && currentBook.wikiSlug) {
          updateWiki(currentBook, updated, '', '').catch(err =>
            console.error('Wiki update failed:', err)
          )
        }

        return updated
      })
    } catch {
      // error is handled by useAi hook
    }
  }, [currentBook, selectedText, annotations, activeAnnotationId, ai, updateAnnotation, aiMode])
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd ~/readloop && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 6: Commit**

```bash
cd ~/readloop
git add src/App.tsx
git commit -m "feat(wiki): wire wiki init, context injection, and update into App"
```

---

## Task 9: Manual Integration Test

**Files:** None (testing only)

- [ ] **Step 1: Run all unit tests**

```bash
cd ~/readloop && npx vitest run
```

Expected: All tests pass.

- [ ] **Step 2: Start dev server and proxy**

```bash
cd ~/readloop
# Start proxy
node proxy.mjs &

# Start dev server
npx vite --host &
```

- [ ] **Step 3: Open ReadLoop and import an EPUB**

Open `http://localhost:5174` in browser. Import an EPUB book. Verify:
- Book opens normally (reading is not blocked)
- Check terminal for wiki init logs
- After a minute, check `~/readloop/wikis/` for generated markdown files

- [ ] **Step 4: Start a conversation and check wiki update**

Select text in the EPUB, click "Ask AI", ask a meaningful question. After the response:
- Check terminal for wiki update logs
- Check `~/readloop/wikis/{book}/conversations/` for new conversation file

- [ ] **Step 5: Verify wiki context injection**

Ask a follow-up question about a concept that was already in the wiki. The AI response should reference prior understanding rather than starting from scratch.

- [ ] **Step 6: Check Obsidian compatibility**

Open `~/readloop/wikis/` as an Obsidian vault. Verify:
- `[[links]]` resolve correctly
- Frontmatter renders properly
- Navigation between concept/chapter/entity pages works

- [ ] **Step 7: Kill background processes and commit any fixes**

```bash
kill %1 %2  # kill proxy and vite
```

If any bugs were found and fixed during testing, commit them:

```bash
cd ~/readloop
git add -A
git commit -m "fix(wiki): fixes from integration testing"
```
