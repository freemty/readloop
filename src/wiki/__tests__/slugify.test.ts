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
