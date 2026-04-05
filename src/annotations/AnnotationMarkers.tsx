import type { Annotation } from '../types'

interface AnnotationMarkersProps {
  annotations: Annotation[]
  onMarkerClick: (annotation: Annotation) => void
}

export function AnnotationMarkers({ annotations, onMarkerClick }: AnnotationMarkersProps) {
  return (
    <>
      {annotations.map(ann => {
        const page = ann.anchor.pageHint ?? 0
        return (
          <button
            key={ann.id}
            data-annotation-id={ann.id}
            data-page={page}
            onClick={() => onMarkerClick(ann)}
            className="absolute w-5 h-5 flex items-center justify-center text-xs cursor-pointer hover:scale-125 transition-transform z-10"
            title={ann.type === 'conversation' ? 'Click to open conversation' : ann.anchor.selectedText}
            style={{
              right: -24,
              top: 0,
            }}
          >
            {ann.type === 'conversation' ? '💬' : ann.type === 'note' ? '📝' : '🖍️'}
          </button>
        )
      })}
    </>
  )
}
