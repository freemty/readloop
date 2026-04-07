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

  files.push({
    path: 'index.md',
    content: generateBookIndex(bookTitle, bookAuthor, chapters.map(c => c.title)),
  })

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

  for (const [slug, c] of seenConcepts) {
    files.push({
      path: `concepts/${slug}.md`,
      content: generateConceptFile(c.title, c.chapter, c.summary, c.related),
    })
  }

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
        [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
        () => {},
      )
      const parsed: InitChapterResult = JSON.parse(response)
      results.push({ title: chapter.title, slug: chapter.slug, result: parsed })
      for (const c of parsed.concepts) {
        existingConcepts.push(c.slug)
      }
    } catch (err) {
      console.error(`Wiki init failed for chapter "${chapter.title}":`, err)
    }
  }

  const files = buildWikiFiles(book.title, book.author, results)

  await fetch(`${WIKI_BASE}/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug, files }),
  })

  const db = await getStore()
  await db.updateBook({ ...book, wikiSlug: slug, wikiReady: true, updatedAt: Date.now() })

  return slug
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}
