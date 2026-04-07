export interface WikiMeta {
  slug: string
  bookId: string
  bookTitle: string
  bookAuthor: string
  ready: boolean
}

export interface InitChapterResult {
  summary: string
  concepts: ConceptInit[]
  entities: EntityInit[]
}

export interface ConceptInit {
  title: string
  slug: string
  summary: string
  related: string[]
}

export interface EntityInit {
  name: string
  slug: string
  type: 'person' | 'organization' | 'place'
  role: string
}

export interface UpdateInstruction {
  action: 'update_concept' | 'create_concept' | 'create_entity' | 'bump_confidence' | 'add_relation'
  target?: string
  title?: string
  slug?: string
  summary?: string
  delta?: string
  related?: string[]
  type?: string
  role?: string
  to?: string
}

export interface UpdateJudgment {
  worth_saving: boolean
  updates: UpdateInstruction[]
  conversation_summary: string
}
