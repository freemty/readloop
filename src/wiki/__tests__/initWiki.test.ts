import { describe, it, expect } from 'vitest'
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
          summary: 'Chapter summary',
          concepts: [{ title: '大国幻象', slug: '大国幻象', summary: 'Concept summary', related: [] }],
          entities: [{ name: '习近平', slug: '习近平', type: 'person', role: 'Leader' }],
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
          summary: 's1',
          concepts: [{ title: 'A', slug: 'a', summary: 's', related: [] }],
          entities: [],
        },
      },
      {
        title: 'Ch2', slug: '02-ch2',
        result: {
          summary: 's2',
          concepts: [{ title: 'A', slug: 'a', summary: 'updated', related: [] }],
          entities: [],
        },
      },
    ]
    const files = buildWikiFiles('Book', 'Author', chapters)
    const conceptFiles = files.filter(f => f.path.startsWith('concepts/'))
    expect(conceptFiles.length).toBe(1)
  })
})
