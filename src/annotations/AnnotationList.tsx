import { motion } from 'framer-motion'
import { MessageCircle, StickyNote, Highlighter } from 'lucide-react'
import type { Annotation } from '../types'

interface AnnotationListProps {
  annotations: Annotation[]
  onSelect: (annotation: Annotation) => void
}

function getIcon(type: Annotation['type']) {
  if (type === 'conversation') return <MessageCircle size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
  if (type === 'note') return <StickyNote size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
  return <Highlighter size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
}

function getLabel(ann: Annotation): string {
  if (ann.type === 'conversation') return ann.conversation?.[0]?.content ?? 'Conversation'
  if (ann.type === 'note') return ann.noteText ?? 'Note'
  return ann.anchor.selectedText
}

export function AnnotationList({ annotations, onSelect }: AnnotationListProps) {
  const sorted = [...annotations].sort((a, b) => {
    if (a.anchor.paragraph !== b.anchor.paragraph) return a.anchor.paragraph - b.anchor.paragraph
    return a.createdAt - b.createdAt
  })

  if (sorted.length === 0) {
    return (
      <div
        className="text-xs px-1 py-3"
        style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}
      >
        No annotations yet
      </div>
    )
  }

  return (
    <div className="space-y-0.5">
      {sorted.map((ann, index) => (
        <motion.button
          key={ann.id}
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.18, delay: index * 0.05, ease: 'easeOut' }}
          onClick={() => onSelect(ann)}
          className="w-full text-left px-3 py-2.5 rounded-lg text-xs transition-colors"
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--font-ui)',
          }}
          onMouseEnter={e => {
            ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-paper)'
          }}
          onMouseLeave={e => {
            ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
          }}
        >
          <div className="flex items-start gap-2">
            <span className="mt-0.5">{getIcon(ann.type)}</span>
            <span
              className="truncate leading-snug"
              style={{ color: 'var(--text-primary)' }}
            >
              {getLabel(ann)}
            </span>
          </div>
          <div
            className="mt-1"
            style={{ color: 'var(--text-muted)', fontSize: '10px', paddingLeft: '21px' }}
          >
            p.{(ann.anchor.pageHint ?? ann.anchor.paragraph) + 1}
          </div>
        </motion.button>
      ))}
    </div>
  )
}
