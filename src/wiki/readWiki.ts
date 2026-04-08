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
      try { node.related = JSON.parse(rawValue) } catch { node.related = [] }
    }
  }
  return node
}

export async function readWikiRaw(slug: string, filePath: string): Promise<string | null> {
  try {
    const response = await fetch(
      `${WIKI_BASE}/read?slug=${encodeURIComponent(slug)}&path=${encodeURIComponent(filePath)}`
    )
    if (!response.ok) return null
    const { content } = await response.json()
    return content
  } catch { return null }
}

export function extractJson<T = unknown>(text: string): T {
  let str = text.trim()
  const fenceMatch = str.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (fenceMatch) str = fenceMatch[1].trim()
  try { return JSON.parse(str) } catch { /* fall through */ }
  const firstBrace = str.indexOf('{')
  const lastBrace = str.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const candidate = str.slice(firstBrace, lastBrace + 1)
    try { return JSON.parse(candidate) } catch { /* fall through */ }
    const fixed = candidate.replace(/,\s*([}\]])/g, '$1')
    return JSON.parse(fixed)
  }
  throw new Error(`Could not extract valid JSON (length: ${text.length})`)
}

export async function readWikiNode(slug: string, filePath: string): Promise<WikiNode | null> {
  const raw = await readWikiRaw(slug, filePath)
  return raw ? parseMarkdownFrontmatter(raw) : null
}

export async function listWikiFiles(slug: string): Promise<string[]> {
  try {
    const response = await fetch(`${WIKI_BASE}/read?slug=${encodeURIComponent(slug)}`)
    if (!response.ok) return []
    const { files } = await response.json()
    return files
  } catch { return [] }
}

export async function readChapterConcepts(
  slug: string,
  chapterSlug: string,
): Promise<{ title: string; confidence: string; summary: string }[]> {
  const files = await listWikiFiles(slug)
  const conceptFiles = files.filter(f => f.startsWith('concepts/'))
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
  const toRead = linkedSlugs.size > 0
    ? conceptFiles.filter(f => linkedSlugs.has(f))
    : conceptFiles.slice(0, 5)
  const nodes = await Promise.all(toRead.map(file => readWikiNode(slug, file)))
  return nodes
    .filter((node): node is WikiNode => node !== null && node.title !== undefined)
    .map(node => ({
      title: node.title!,
      confidence: node.confidence ?? 'low',
      summary: (node.body.split('\n\n')[0] ?? '').slice(0, 200),
    }))
}
