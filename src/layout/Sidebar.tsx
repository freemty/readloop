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
    <div className="h-full flex flex-col bg-white border-r w-60">
      <div className="px-3 py-3 border-b">
        <button
          onClick={onBackToShelf}
          className="text-xs text-blue-600 hover:underline mb-2 block"
        >
          Back to shelf
        </button>
        <h2 className="font-medium text-sm truncate">{bookTitle}</h2>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="px-3 py-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Annotations
          </h3>
          <AnnotationList annotations={annotations} onSelect={onAnnotationSelect} />
        </div>
      </div>
    </div>
  )
}
