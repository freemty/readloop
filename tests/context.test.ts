import { describe, it, expect } from 'vitest'
import { buildAskContext, buildGuideContext } from '../src/ai/context'
import type { Message } from '../src/types'

describe('buildAskContext', () => {
  const baseInput = {
    bookTitle: 'The Wealth of Nations',
    bookAuthor: 'Adam Smith',
    currentChapter: 'Chapter 1',
    paragraphs: ['Para before.', 'The selected paragraph text here.', 'Para after.'],
    currentParagraphIndex: 1,
    selectedText: 'selected paragraph',
    userQuery: 'What does this mean?',
    nearbyAnnotations: [],
  }

  it('assembles context for ask mode', () => {
    const result = buildAskContext(baseInput)
    expect(result.systemPrompt).toContain('The Wealth of Nations')
    expect(result.userPrompt).toContain('selected paragraph')
    expect(result.userPrompt).toContain('What does this mean?')
  })

  it('without history returns messages array with system + user (2 messages) and legacy fields', () => {
    const result = buildAskContext(baseInput)

    // Legacy fields still present
    expect(result.systemPrompt).toBeTruthy()
    expect(result.userPrompt).toBeTruthy()

    // messages array: [system, user]
    expect(result.messages).toHaveLength(2)
    expect(result.messages[0].role).toBe('system')
    expect(result.messages[0].content).toBe(result.systemPrompt)
    expect(result.messages[1].role).toBe('user')
    expect(result.messages[1].content).toBe(result.userPrompt)
  })

  it('with conversationHistory returns messages array: [system, ...history, user]', () => {
    const history: Message[] = [
      { role: 'user', content: 'What is the invisible hand?', timestamp: 1000 },
      { role: 'assistant', content: 'It refers to the unintended social benefits...', timestamp: 2000 },
    ]

    const result = buildAskContext({ ...baseInput, conversationHistory: history })

    // messages: system + 2 history + user = 4
    expect(result.messages).toHaveLength(4)
    expect(result.messages[0].role).toBe('system')
    expect(result.messages[1].role).toBe('user')
    expect(result.messages[1].content).toBe('What is the invisible hand?')
    expect(result.messages[2].role).toBe('assistant')
    expect(result.messages[2].content).toBe('It refers to the unintended social benefits...')
    expect(result.messages[3].role).toBe('user')
    expect(result.messages[3].content).toBe(result.userPrompt)

    // Legacy fields still present
    expect(result.systemPrompt).toContain('The Wealth of Nations')
    expect(result.userPrompt).toContain('What does this mean?')
  })

  it('trims old history when conversation exceeds max turns', () => {
    const longHistory: { role: 'user' | 'assistant'; content: string; timestamp: number }[] = []
    for (let i = 0; i < 40; i++) {
      longHistory.push({ role: 'user', content: `Question ${i}`, timestamp: i * 1000 })
      longHistory.push({ role: 'assistant', content: `Answer ${i}`, timestamp: i * 1000 + 500 })
    }

    const result = buildAskContext({
      bookTitle: 'Test',
      bookAuthor: 'Author',
      currentChapter: '',
      paragraphs: ['Text.'],
      currentParagraphIndex: 0,
      selectedText: 'Text.',
      userQuery: 'New question?',
      nearbyAnnotations: [],
      conversationHistory: longHistory,
    })

    // system + trimmed history (40 msgs) + new user = 42
    expect(result.messages.length).toBeLessThanOrEqual(42)
    // Most recent messages preserved
    const lastHistoryMsg = result.messages[result.messages.length - 2]
    expect(lastHistoryMsg.content).toBe('Answer 39')
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
