import { AnimatePresence, motion } from 'framer-motion'
import { Compass, X } from 'lucide-react'

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
    <AnimatePresence mode="wait">
      <motion.div
        key={isLoading ? 'loading' : 'content'}
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.22 }}
        className="rounded-lg p-4 mb-4"
        style={{
          background: 'var(--accent-light)',
          border: '1px solid var(--accent)',
          borderOpacity: 0.3,
          borderColor: 'color-mix(in srgb, var(--accent) 30%, transparent)',
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Compass size={14} style={{ color: 'var(--accent)' }} strokeWidth={2} />
            <span
              className="text-xs font-semibold tracking-wide"
              style={{ color: 'var(--accent)', fontFamily: 'var(--font-ui)' }}
            >
              Guide
            </span>
          </div>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={onDismiss}
            className="flex items-center justify-center rounded"
            style={{
              color: 'var(--text-muted)',
              width: '1.5rem',
              height: '1.5rem',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <X size={13} strokeWidth={2} />
          </motion.button>
        </div>

        <div
          className="whitespace-pre-wrap"
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '0.875rem',
            lineHeight: 1.8,
            color: 'var(--text-primary)',
          }}
        >
          {displayText}
          {isLoading && (
            <motion.span
              animate={{ opacity: [1, 0.2, 1] }}
              transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                display: 'inline-block',
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: 'var(--accent)',
                marginLeft: '3px',
                verticalAlign: 'middle',
              }}
            />
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
