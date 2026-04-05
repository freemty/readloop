import { useEffect, useState } from 'react'

interface SelectionMenuProps {
  position: { x: number; y: number } | null
  onAskAi: () => void
  onHighlight: (color: string) => void
  onNote: () => void
  onDismiss: () => void
}

const HIGHLIGHT_COLORS = ['#ffeb3b', '#a5d6a7', '#90caf9', '#f48fb1']

export function SelectionMenu({ position, onAskAi, onHighlight, onNote, onDismiss }: SelectionMenuProps) {
  const [showColors, setShowColors] = useState(false)

  useEffect(() => {
    if (!position) setShowColors(false)
  }, [position])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-selection-menu]')) {
        onDismiss()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onDismiss])

  if (!position) return null

  return (
    <div
      data-selection-menu
      className="fixed bg-gray-800 text-white rounded-lg shadow-xl py-1 px-1 flex gap-1 z-40"
      style={{ left: position.x, top: position.y - 44 }}
    >
      <button
        onClick={onAskAi}
        className="px-3 py-1.5 rounded hover:bg-gray-700 text-sm whitespace-nowrap"
      >
        Ask AI
      </button>
      <div className="relative">
        <button
          onClick={() => setShowColors(!showColors)}
          className="px-3 py-1.5 rounded hover:bg-gray-700 text-sm"
        >
          Highlight
        </button>
        {showColors && (
          <div className="absolute top-full left-0 mt-1 bg-gray-800 rounded p-1 flex gap-1">
            {HIGHLIGHT_COLORS.map(color => (
              <button
                key={color}
                onClick={() => { onHighlight(color); setShowColors(false) }}
                className="w-6 h-6 rounded"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        )}
      </div>
      <button
        onClick={onNote}
        className="px-3 py-1.5 rounded hover:bg-gray-700 text-sm"
      >
        Note
      </button>
    </div>
  )
}
