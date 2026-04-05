export interface PositionAnchor {
  chapter: string
  paragraph: number
  textPrefix: string
  selectedText: string
  textSuffix: string
  pageHint?: number
}

export interface Book {
  id: string
  title: string
  author: string
  format: 'pdf'
  fileHash: string
  lastReadAnchor?: PositionAnchor
  createdAt: number
  updatedAt: number
}

export interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface Annotation {
  id: string
  bookId: string
  anchor: PositionAnchor
  type: 'highlight' | 'note' | 'conversation'
  color?: string
  noteText?: string
  conversation?: Message[]
  createdAt: number
  updatedAt: number
}

export interface GuideCache {
  id: string
  bookId: string
  anchor: PositionAnchor
  guideContent: string
  model: string
  createdAt: number
}

export interface AIContext {
  bookTitle: string
  bookAuthor: string
  currentChapter: string
  surroundingText: string
  selectedText?: string
  nearbyAnnotations: Annotation[]
  userQuery?: string
}

export type AppView = 'bookshelf' | 'reader'
