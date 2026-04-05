export interface TextItem {
  str: string
  height: number
  y: number
}

export interface Paragraph {
  index: number
  text: string
  startY: number
  endY: number
}

export function detectParagraphs(items: TextItem[]): Paragraph[] {
  if (items.length === 0) return []

  const paragraphs: Paragraph[] = []
  let currentTexts: string[] = [items[0].str]
  let startY = items[0].y
  let lastY = items[0].y
  let lastHeight = items[0].height

  for (let i = 1; i < items.length; i++) {
    const item = items[i]
    const gap = Math.abs(lastY - item.y)
    const threshold = lastHeight * 1.5

    if (gap > threshold) {
      paragraphs.push({
        index: paragraphs.length,
        text: currentTexts.join(' '),
        startY,
        endY: lastY,
      })
      currentTexts = [item.str]
      startY = item.y
    } else {
      currentTexts.push(item.str)
    }

    lastY = item.y
    lastHeight = item.height
  }

  paragraphs.push({
    index: paragraphs.length,
    text: currentTexts.join(' '),
    startY,
    endY: lastY,
  })

  return paragraphs
}
