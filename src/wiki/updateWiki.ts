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

  files.push({
    path: `conversations/${chapterSlug}-${String(conversationIndex).padStart(3, '0')}.md`,
    content: `---\ntitle: "${judgment.conversation_summary.slice(0, 60)}"\ntype: conversation\nchapter: "${chapterTitle}"\ncreated: ${timestamp}\n---\n\n${judgment.conversation_summary}\n`,
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
          content: generateConceptFile(update.title, chapterTitle, update.summary ?? '', update.related ?? []),
          mode: 'write',
        })
        break
      }
      case 'create_entity': {
        if (!update.title || !update.slug) break
        files.push({
          path: `entities/${update.slug}.md`,
          content: generateEntityFile(update.title, update.type ?? 'person', chapterTitle, update.role ?? ''),
          mode: 'write',
        })
        break
      }
      case 'bump_confidence': {
        if (!update.target || !update.to) break
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
        files.push({ path: update.target, content: `\n${relatedLinks}`, mode: 'append' })
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
  if (conversation.length < 2) return

  const slug = book.wikiSlug
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

  const convFiles = files.filter(f => f.startsWith(`conversations/${chapterSlug}`))
  const conversationIndex = convFiles.length + 1

  const settings = loadSettings()
  const client = createAiClient({
    provider: settings.provider,
    apiKey: settings.apiKey,
    model: settings.model,
    baseUrl: settings.baseUrl,
  })

  const systemPrompt = wikiUpdateSystemPrompt()
  const userPrompt = buildUpdateJudgmentPrompt(book.title, book.author, currentChapter, conversation, existingNodes)

  try {
    const response = await client.chat(
      [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      () => {},
    )

    const judgment: UpdateJudgment = JSON.parse(response)
    const updateFiles = buildUpdateFiles(judgment, chapterSlug, conversationIndex, currentChapter)
    if (updateFiles.length === 0) return

    const finalFiles: { path: string; content: string; mode: string }[] = []
    for (const f of updateFiles) {
      if (f.content.startsWith('__BUMP_CONFIDENCE__:')) {
        const newConfidence = f.content.split(':')[1]
        const node = await readWikiNode(slug, f.path)
        if (node) {
          const fullContent = await fetch(
            `${WIKI_BASE}/read?slug=${encodeURIComponent(slug)}&path=${encodeURIComponent(f.path)}`
          ).then(r => r.json()).then(d => d.content)
          finalFiles.push({ path: f.path, content: applyBumpConfidence(fullContent, newConfidence), mode: 'write' })
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
  }
}
