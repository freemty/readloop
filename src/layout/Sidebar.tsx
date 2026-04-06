import { ArrowLeft } from 'lucide-react'
import { AnnotationList } from '../annotations/AnnotationList'
import type { Annotation } from '../types'

interface SidebarProps {
  bookTitle: string
  annotations: Annotation[]
  onAnnotationSelect: (annotation: Annotation) => void
  onBackToShelf: () => void
}

export function Sidebar({ bookTitle, annotations, onAnnotationSelect, onBackToShelf }: SidebarProps) {
  return (
    <div
      className="h-full flex flex-col w-60 transition-all"
      style={{
        background: 'var(--bg-sidebar)',
        boxShadow: 'var(--shadow-2)',
        fontFamily: 'var(--font-ui)',
        borderRight: 'none',
      }}
    >
      <div className="px-4 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <button
          onClick={onBackToShelf}
          className="flex items-center gap-1.5 mb-3 text-sm transition-colors"
          style={{ color: 'var(--text-muted)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
          onMouseEnter={e => {
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)'
          }}
          onMouseLeave={e => {
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'
          }}
        >
          <ArrowLeft size={14} />
          <span>Back to shelf</span>
        </button>

        <h2
          className="truncate text-base leading-snug"
          style={{
            fontFamily: 'var(--font-serif)',
            color: 'var(--text-primary)',
            fontWeight: 600,
          }}
        >
          {bookTitle}
        </h2>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="px-4 py-3">
          <h3
            className="text-xs uppercase tracking-widest mb-3"
            style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', fontWeight: 600 }}
          >
            Annotations
          </h3>
          <AnnotationList annotations={annotations} onSelect={onAnnotationSelect} />
        </div>
      </div>
    </div>
  )
}
