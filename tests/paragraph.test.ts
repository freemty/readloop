import { describe, it, expect } from 'vitest'
import { detectParagraphs, type TextItem } from '../src/pdf/paragraph'

describe('detectParagraphs', () => {
  it('groups consecutive lines into one paragraph', () => {
    const items: TextItem[] = [
      { str: 'Line one of paragraph.', height: 12, y: 700 },
      { str: 'Line two of paragraph.', height: 12, y: 686 },
    ]
    const paragraphs = detectParagraphs(items)
    expect(paragraphs).toHaveLength(1)
    expect(paragraphs[0].text).toBe('Line one of paragraph. Line two of paragraph.')
  })

  it('splits on vertical gap > 1.5x line height', () => {
    const items: TextItem[] = [
      { str: 'First paragraph.', height: 12, y: 700 },
      { str: 'Second paragraph.', height: 12, y: 660 },
    ]
    const paragraphs = detectParagraphs(items)
    expect(paragraphs).toHaveLength(2)
    expect(paragraphs[0].text).toBe('First paragraph.')
    expect(paragraphs[1].text).toBe('Second paragraph.')
  })

  it('assigns sequential indices', () => {
    const items: TextItem[] = [
      { str: 'Para one.', height: 12, y: 700 },
      { str: 'Para two.', height: 12, y: 660 },
      { str: 'Para three.', height: 12, y: 620 },
    ]
    const paragraphs = detectParagraphs(items)
    expect(paragraphs.map(p => p.index)).toEqual([0, 1, 2])
  })

  it('handles empty input', () => {
    expect(detectParagraphs([])).toEqual([])
  })
})
