import { askSystemPrompt, guideSystemPrompt } from './prompts'
import type { AiMode } from './prompts'
import type { Annotation } from '../types'

interface AskContextInput {
  bookTitle: string
  bookAuthor: string
  currentChapter: string
  paragraphs: string[]
  currentParagraphIndex: number
  selectedText: string
  userQuery: string
  nearbyAnnotations: Annotation[]
  mode?: AiMode
  wikiContext?: string
}

interface GuideContextInput {
  bookTitle: string
  bookAuthor: string
  currentChapter: string
  paragraphs: string[]
  currentParagraphIndex: number
  recentGuideSummaries: string[]
}

interface PromptPair {
  systemPrompt: string
  userPrompt: string
}

export function buildAskContext(input: AskContextInput): PromptPair {
  const {
    bookTitle,
    bookAuthor,
    currentChapter,
    paragraphs,
    currentParagraphIndex,
    selectedText,
    userQuery,
    nearbyAnnotations,
    mode,
  } = input

  const start = Math.max(0, currentParagraphIndex - 2)
  const end = Math.min(paragraphs.length, currentParagraphIndex + 3)
  const surrounding = paragraphs.slice(start, end).join('\n\n')

  let userPrompt = `**Chapter:** ${currentChapter}\n\n**Surrounding text:**\n${surrounding}\n\n**Selected text:** "${selectedText}"\n\n**Question:** ${userQuery}`

  if (nearbyAnnotations.length > 0) {
    const priorNotes = nearbyAnnotations
      .filter(a => a.conversation && a.conversation.length > 0)
      .map(a => `- Q: ${a.conversation![0].content}`)
      .join('\n')
    if (priorNotes) {
      userPrompt += `\n\n**Previous questions nearby:**\n${priorNotes}`
    }
  }

  if (input.wikiContext) {
    userPrompt += input.wikiContext
  }

  return {
    systemPrompt: askSystemPrompt(bookTitle, bookAuthor, mode),
    userPrompt,
  }
}

export function buildGuideContext(input: GuideContextInput): PromptPair {
  const {
    bookTitle,
    bookAuthor,
    currentChapter,
    paragraphs,
    currentParagraphIndex,
    recentGuideSummaries,
  } = input

  const currentText = paragraphs[currentParagraphIndex] ?? ''

  let userPrompt = `**Chapter:** ${currentChapter}\n\n**Paragraph:**\n${currentText}`

  if (recentGuideSummaries.length > 0) {
    userPrompt += `\n\n**Previous guide summaries (for continuity):**\n${recentGuideSummaries.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
  }

  return {
    systemPrompt: guideSystemPrompt(bookTitle, bookAuthor),
    userPrompt,
  }
}
