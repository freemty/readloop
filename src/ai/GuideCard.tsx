interface GuideCardProps {
  content: string | null
  isLoading: boolean
  streamingText: string
  onDismiss: () => void
}

export function GuideCard({ content, isLoading, streamingText, onDismiss }: GuideCardProps) {
  const displayText = isLoading ? streamingText : content

  if (!displayText && !isLoading) return null

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-amber-800">Guide</h3>
        <button onClick={onDismiss} className="text-amber-400 hover:text-amber-600 text-sm">
          Dismiss
        </button>
      </div>
      <div className="text-sm text-gray-700 whitespace-pre-wrap">
        {displayText}
        {isLoading && <span className="animate-pulse">|</span>}
      </div>
    </div>
  )
}
