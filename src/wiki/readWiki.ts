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

export async function readWikiNode(slug: string, filePath: string): Promise<WikiNode | null> {
  try {
    const response = await fetch(
      `${WIKI_BASE}/read?slug=${encodeURIComponent(slug)}&path=${encodeURIComponent(filePath)}`
    )
    if (!response.ok) return null
    const { content } = await response.json()
    return parseMarkdownFrontmatter(content)
  } catch { return null }
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
  const results: { title: string; confidence: string; summary: string }[] = []
  for (const file of toRead) {
    const node = await readWikiNode(slug, file)
    if (node?.title) {
      const summary = node.body.split('\n\n')[0] ?? ''
      results.push({ title: node.title, confidence: node.confidence ?? 'low', summary: summary.slice(0, 200) })
    }
  }
  return results
}
