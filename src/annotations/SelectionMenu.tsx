import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Highlighter, StickyNote } from 'lucide-react'

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

  return (
    <AnimatePresence>
      {position && (
        <motion.div
          key="selection-menu"
          data-selection-menu
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="fixed flex gap-1 z-40 rounded-xl py-1.5 px-1.5"
          style={{
            left: position.x,
            top: position.y - 52,
            background: '#2C2C2C',
            color: '#ffffff',
            backdropFilter: 'blur(8px)',
            boxShadow: 'var(--shadow-3)',
          }}
        >
          <button
            onClick={onAskAi}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap text-white transition-colors"
            style={{ background: 'transparent' }}
            onMouseEnter={e => {
              ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.12)'
            }}
            onMouseLeave={e => {
              ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
            }}
          >
            <Sparkles size={14} />
            <span>Ask AI</span>
          </button>

          <div className="relative">
            <button
              onClick={() => setShowColors(!showColors)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-white transition-colors"
              style={{ background: 'transparent' }}
              onMouseEnter={e => {
                ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.12)'
              }}
              onMouseLeave={e => {
                ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
              }}
            >
              <Highlighter size={14} />
              <span>Highlight</span>
            </button>

            <AnimatePresence>
              {showColors && (
                <motion.div
                  key="color-picker"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute top-full left-0 mt-1.5 rounded-xl p-2 flex gap-1.5"
                  style={{ background: '#2C2C2C', boxShadow: 'var(--shadow-3)' }}
                >
                  {HIGHLIGHT_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => { onHighlight(color); setShowColors(false) }}
                      className="rounded-lg transition-transform hover:scale-110"
                      style={{ width: 28, height: 28, backgroundColor: color, border: 'none', cursor: 'pointer' }}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={onNote}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-white transition-colors"
            style={{ background: 'transparent' }}
            onMouseEnter={e => {
              ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.12)'
            }}
            onMouseLeave={e => {
              ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
            }}
          >
            <StickyNote size={14} />
            <span>Note</span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
