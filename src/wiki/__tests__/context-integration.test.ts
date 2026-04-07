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
