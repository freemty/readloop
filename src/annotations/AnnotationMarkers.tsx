import { motion } from 'framer-motion'
import { MessageCircle, StickyNote, Highlighter } from 'lucide-react'
import type { Annotation } from '../types'

interface AnnotationMarkersProps {
  annotations: Annotation[]
  onMarkerClick: (annotation: Annotation) => void
}

function getMarkerIcon(type: Annotation['type']) {
  if (type === 'conversation') return <MessageCircle size={14} />
  if (type === 'note') return <StickyNote size={14} />
  return <Highlighter size={14} />
}

export function AnnotationMarkers({ annotations, onMarkerClick }: AnnotationMarkersProps) {
  return (
    <>
      {annotations.map(ann => {
        const page = ann.anchor.pageHint ?? 0
        return (
          <motion.button
            key={ann.id}
            data-annotation-id={ann.id}
            data-page={page}
            onClick={() => onMarkerClick(ann)}
            whileHover={{ scale: 1.2 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            className="absolute w-5 h-5 flex items-center justify-center cursor-pointer z-10"
            title={ann.type === 'conversation' ? 'Click to open conversation' : ann.anchor.selectedText}
            style={{
              right: -24,
              top: 0,
              color: 'var(--accent)',
              background: 'none',
              border: 'none',
              padding: 0,
            }}
          >
            {getMarkerIcon(ann.type)}
          </motion.button>
        )
      })}
    </>
  )
}
