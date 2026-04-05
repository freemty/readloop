import { describe, it, expect } from 'vitest'
import { createAnchor, findAnchorPosition, type ParagraphSource } from '../src/pdf/anchor'

describe('createAnchor', () => {
  it('creates anchor with text fingerprint', () => {
    const fullText = 'The quick brown fox jumps over the lazy dog near the river bank.'
    const selectedText = 'fox jumps over'
    const anchor = createAnchor({
      chapter: 'Ch.1',
      paragraph: 2,
      fullText,
      selectedText,
      selectionStart: 16,
      pageHint: 5,
    })
    expect(anchor.chapter).toBe('Ch.1')
    expect(anchor.paragraph).toBe(2)
    expect(anchor.selectedText).toBe('fox jumps over')
    expect(anchor.textPrefix).toBe('The quick brown ')
    expect(anchor.textSuffix).toBe(' the lazy dog near the rive')
    expect(anchor.pageHint).toBe(5)
  })

  it('handles selection at start of text', () => {
    const anchor = createAnchor({
      chapter: 'Ch.1',
      paragraph: 0,
      fullText: 'Hello world',
      selectedText: 'Hello',
      selectionStart: 0,
    })
    expect(anchor.textPrefix).toBe('')
    expect(anchor.selectedText).toBe('Hello')
  })
})

describe('findAnchorPosition', () => {
  const paragraphs: ParagraphSource[] = [
    { index: 0, text: 'Introduction to the work.' },
    { index: 1, text: 'The quick brown fox jumps over the lazy dog near the river.' },
    { index: 2, text: 'Conclusion of the chapter.' },
  ]

  it('finds exact match by text fingerprint', () => {
    const anchor = {
      chapter: 'Ch.1',
      paragraph: 1,
      textPrefix: 'The quick brown ',
      selectedText: 'fox jumps over',
      textSuffix: ' the lazy dog',
    }
    const result = findAnchorPosition(anchor, paragraphs)
    expect(result.paragraphIndex).toBe(1)
    expect(result.charOffset).toBe(16)
    expect(result.approximate).toBe(false)
  })

  it('falls back to paragraph index when text not found', () => {
    const anchor = {
      chapter: 'Ch.1',
      paragraph: 1,
      textPrefix: 'no match prefix',
      selectedText: 'nonexistent text',
      textSuffix: 'no match suffix',
    }
    const result = findAnchorPosition(anchor, paragraphs)
    expect(result.paragraphIndex).toBe(1)
    expect(result.approximate).toBe(true)
  })

  it('clamps paragraph index if out of range', () => {
    const anchor = {
      chapter: 'Ch.1',
      paragraph: 99,
      textPrefix: '',
      selectedText: 'missing',
      textSuffix: '',
    }
    const result = findAnchorPosition(anchor, paragraphs)
    expect(result.paragraphIndex).toBe(2)
    expect(result.approximate).toBe(true)
  })
})
