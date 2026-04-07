import type { Message } from '../types'

export function wikiInitSystemPrompt(): string {
  return `You are a knowledge graph builder. Given a chapter from a book, extract structured information.

Output ONLY valid JSON with this exact structure:
{
  "chapter_summary": "2-3 sentence summary of the chapter",
  "concepts": [
    {
      "title": "Concept Title",
      "slug": "concept-title-in-lowercase",
      "summary": "1-2 sentence description",
      "related": ["slug-of-related-concept"]
    }
  ],
  "entities": [
    {
      "name": "Entity Name",
      "slug": "entity-name-lowercase",
      "type": "person|organization|place",
      "role": "1 sentence describing their role in this chapter"
    }
  ]
}

Rules:
- Extract 3-8 concepts per chapter (core ideas, arguments, themes — not trivial details)
- Extract entities only when they play a meaningful role (not every name mentioned)
- Slugs must be lowercase, hyphens for spaces, no special characters
- "related" references other concept slugs (from this chapter or existing concepts list)
- Use the same language as the book text for titles and summaries`
}

export function buildInitPrompt(
  bookTitle: string,
  bookAuthor: string,
  chapterText: string,
  existingConcepts: string[],
): string {
  let prompt = `**Book:** "${bookTitle}" by ${bookAuthor}\n\n**Chapter text:**\n${chapterText}`
  if (existingConcepts.length > 0) {
    prompt += `\n\n**Already extracted concepts (avoid duplicates, use these slugs for "related" references):**\n${existingConcepts.join('\n')}`
  }
  return prompt
}

export function wikiUpdateSystemPrompt(): string {
  return `You are a wiki update judge. Given a conversation between a reader and AI about a book, decide if the conversation produced insights worth saving to the book's knowledge wiki.

Output ONLY valid JSON:
{
  "worth_saving": true/false,
  "updates": [
    {
      "action": "update_concept|create_concept|create_entity|bump_confidence|add_relation",
      "target": "concepts/slug.md",
      "delta": "New insight to append...",
      "title": "For create actions only",
      "slug": "for-create-actions",
      "summary": "For create actions",
      "related": ["slug1", "slug2"],
      "type": "person|organization|place",
      "role": "For entity creation",
      "to": "medium|high"
    }
  ],
  "conversation_summary": "1-2 sentence distillation of the key insight"
}

Rules:
- Set worth_saving=false for casual chat, repeated questions, or trivial exchanges
- update_concept: append new understanding to an existing concept's Evolution section
- create_concept: only when the conversation surfaces a genuinely new theme not in existing wiki
- bump_confidence: low→medium when user discusses a concept; medium→high when deep discussion
- add_relation: when conversation reveals a connection between two existing concepts
- conversation_summary: capture the KEY insight, not a transcript summary
- Keep updates minimal — typically 1-3 per conversation turn, often 0`
}

export function buildUpdateJudgmentPrompt(
  bookTitle: string,
  bookAuthor: string,
  currentChapter: string,
  conversation: Message[],
  existingNodes: string[],
): string {
  const conversationText = conversation
    .map(m => `[${m.role === 'user' ? '读者' : 'AI'}]: ${m.content}`)
    .join('\n\n')
  let prompt = `**Book:** "${bookTitle}" by ${bookAuthor}\n**Chapter:** ${currentChapter}\n\n**Conversation:**\n${conversationText}`
  if (existingNodes.length > 0) {
    prompt += `\n\n**Current wiki nodes:**\n${existingNodes.join('\n')}`
  }
  return prompt
}

export function buildWikiContextBlock(nodes: { title: string; confidence: string; summary: string }[]): string {
  if (nodes.length === 0) return ''
  const lines = nodes.map(n =>
    `- "${n.title}" (confidence: ${n.confidence}): ${n.summary}`
  )
  return `\n\nThe reader has previously explored these concepts in this book:\n${lines.join('\n')}\n\nBuild on their existing understanding. Don't repeat what they already know.`
}
