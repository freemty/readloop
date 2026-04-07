import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readWikiNode, listWikiFiles, readChapterConcepts, parseMarkdownFrontmatter } from '../readWiki'

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
      json: async () => ({ content: `---\ntitle: "Test"\ntype: concept\nconfidence: medium\n---\nBody text` }),
    })
    const result = await readWikiNode('my-book', 'concepts/test.md')
    expect(result.title).toBe('Test')
    expect(result.confidence).toBe('medium')
    expect(result.body).toBe('Body text')
  })
  it('returns null for 404', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 })
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
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ files: ['concepts/a.md', 'concepts/b.md', 'chapters/01-ch1.md'] }),
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ content: `---\ntitle: "Chapter 1"\ntype: chapter\n---\n\nConcepts: [[concepts/a]]` }),
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ content: `---\ntitle: "Concept A"\ntype: concept\nconfidence: low\n---\nSummary of A` }),
    })
    const concepts = await readChapterConcepts('my-book', '01-ch1')
    expect(concepts.length).toBe(1)
    expect(concepts[0].title).toBe('Concept A')
  })
})
