import type { Annotation } from '../types'

interface AnnotationListProps {
  annotations: Annotation[]
  onSelect: (annotation: Annotation) => void
}

export function AnnotationList({ annotations, onSelect }: AnnotationListProps) {
  const sorted = [...annotations].sort((a, b) => {
    if (a.anchor.paragraph !== b.anchor.paragraph) return a.anchor.paragraph - b.anchor.paragraph
    return a.createdAt - b.createdAt
  })

  if (sorted.length === 0) {
    return <div className="text-xs text-gray-400 p-3">No annotations yet</div>
  }

  return (
    <div className="space-y-1">
      {sorted.map(ann => (
        <button
          key={ann.id}
          onClick={() => onSelect(ann)}
          className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded text-xs"
        >
          <div className="flex items-center gap-1.5">
            <span>{ann.type === 'conversation' ? '💬' : ann.type === 'note' ? '📝' : '🖍️'}</span>
            <span className="truncate text-gray-700">
              {ann.type === 'conversation'
                ? ann.conversation?.[0]?.content ?? 'Conversation'
                : ann.type === 'note'
                ? ann.noteText ?? 'Note'
                : ann.anchor.selectedText}
            </span>
          </div>
          <div className="text-gray-400 mt-0.5">p.{(ann.anchor.pageHint ?? ann.anchor.paragraph) + 1}</div>
        </button>
      ))}
    </div>
  )
}
