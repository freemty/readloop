import { describe, it, expect } from 'vitest'
import { buildAskContext, buildGuideContext } from '../src/ai/context'

describe('buildAskContext', () => {
  it('assembles context for ask mode', () => {
    const result = buildAskContext({
      bookTitle: 'The Wealth of Nations',
      bookAuthor: 'Adam Smith',
      currentChapter: 'Chapter 1',
      paragraphs: ['Para before.', 'The selected paragraph text here.', 'Para after.'],
      currentParagraphIndex: 1,
      selectedText: 'selected paragraph',
      userQuery: 'What does this mean?',
      nearbyAnnotations: [],
    })
    expect(result.systemPrompt).toContain('The Wealth of Nations')
    expect(result.userPrompt).toContain('selected paragraph')
    expect(result.userPrompt).toContain('What does this mean?')
  })
})

describe('buildGuideContext', () => {
  it('assembles context for guide mode', () => {
    const result = buildGuideContext({
      bookTitle: 'The Wealth of Nations',
      bookAuthor: 'Adam Smith',
      currentChapter: 'Chapter 1',
      paragraphs: ['Intro.', 'Current paragraph content.', 'Next.'],
      currentParagraphIndex: 1,
      recentGuideSummaries: ['Previous guide summary.'],
    })
    expect(result.systemPrompt).toContain('guide')
    expect(result.userPrompt).toContain('Current paragraph content.')
    expect(result.userPrompt).toContain('Previous guide summary')
  })
})
