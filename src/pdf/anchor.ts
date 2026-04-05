import type { PositionAnchor } from '../types'

const FINGERPRINT_LENGTH = 27

interface CreateAnchorParams {
  chapter: string
  paragraph: number
  fullText: string
  selectedText: string
  selectionStart: number
  pageHint?: number
}

export interface ParagraphSource {
  index: number
  text: string
}

export interface AnchorLookupResult {
  paragraphIndex: number
  charOffset?: number
  approximate: boolean
}

export function createAnchor(params: CreateAnchorParams): PositionAnchor {
  const { chapter, paragraph, fullText, selectedText, selectionStart, pageHint } = params
  const selectionEnd = selectionStart + selectedText.length

  const prefixStart = Math.max(0, selectionStart - FINGERPRINT_LENGTH)
  const textPrefix = fullText.slice(prefixStart, selectionStart)

  const suffixEnd = Math.min(fullText.length, selectionEnd + FINGERPRINT_LENGTH)
  const textSuffix = fullText.slice(selectionEnd, suffixEnd)

  return {
    chapter,
    paragraph,
    textPrefix,
    selectedText,
    textSuffix,
    pageHint,
  }
}

export function findAnchorPosition(
  anchor: PositionAnchor,
  paragraphs: ParagraphSource[],
): AnchorLookupResult {
  if (paragraphs.length === 0) {
    return { paragraphIndex: 0, approximate: true }
  }

  const searchOrder = buildSearchOrder(anchor.paragraph, paragraphs.length)

  for (const idx of searchOrder) {
    const text = paragraphs[idx].text
    const charOffset = text.indexOf(anchor.selectedText)
    if (charOffset !== -1) {
      return { paragraphIndex: idx, charOffset, approximate: false }
    }
  }

  const clamped = Math.min(anchor.paragraph, paragraphs.length - 1)
  return { paragraphIndex: clamped, approximate: true }
}

function buildSearchOrder(target: number, length: number): number[] {
  const clamped = Math.min(target, length - 1)
  const order: number[] = [clamped]
  for (let offset = 1; offset <= 3; offset++) {
    if (clamped - offset >= 0) order.push(clamped - offset)
    if (clamped + offset < length) order.push(clamped + offset)
  }
  return order
}
