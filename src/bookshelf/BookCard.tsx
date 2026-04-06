import { motion } from 'framer-motion'
import { BookOpen, Trash2 } from 'lucide-react'
import type { Book } from '../types'

interface BookCardProps {
  book: Book
  onOpen: (bookId: string) => void
  onDelete: (bookId: string) => void
}

// Generate a deterministic warm gradient based on book id
function getCoverGradient(id: string): string {
  const gradients = [
    'linear-gradient(135deg, #C06030 0%, #E8A878 100%)',
    'linear-gradient(135deg, #7A5C8A 0%, #C4A0D0 100%)',
    'linear-gradient(135deg, #3A6B8A 0%, #80BADA 100%)',
    'linear-gradient(135deg, #5A8A5A 0%, #9ABFA0 100%)',
    'linear-gradient(135deg, #8A6A3A 0%, #C8A878 100%)',
    'linear-gradient(135deg, #8A3A5A 0%, #D08A9A 100%)',
  ]
  const index = id.charCodeAt(0) % gradients.length
  return gradients[index]
}

export function BookCard({ book, onOpen, onDelete }: BookCardProps) {
  return (
    <motion.div
      whileHover={{ translateY: -2, boxShadow: 'var(--shadow-3)' }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="rounded-lg cursor-pointer group"
      style={{
        background: 'var(--bg-card)',
        boxShadow: 'var(--shadow-1)',
        border: '1px solid var(--border)',
        overflow: 'hidden',
      }}
      onClick={() => onOpen(book.id)}
    >
      {/* Book cover */}
      <div
        className="w-full flex items-center justify-center"
        style={{
          height: '9rem',
          background: getCoverGradient(book.id),
        }}
      >
        <BookOpen
          size={36}
          style={{ color: 'rgba(255,255,255,0.85)' }}
          strokeWidth={1.5}
        />
      </div>

      {/* Book info */}
      <div className="p-3">
        <h3
          className="text-sm truncate font-medium leading-snug"
          style={{
            fontFamily: 'var(--font-serif)',
            color: 'var(--text-primary)',
          }}
        >
          {book.title}
        </h3>
        <p
          className="text-xs truncate mt-0.5"
          style={{ color: 'var(--text-secondary)' }}
        >
          {book.author || 'Unknown author'}
        </p>

        {/* Delete button */}
        <motion.button
          onClick={e => { e.stopPropagation(); onDelete(book.id) }}
          className="mt-2 flex items-center gap-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: 'var(--text-muted)' }}
          whileHover={{ color: '#DC2626' }}
          transition={{ duration: 0.12 }}
        >
          <Trash2 size={12} strokeWidth={1.75} />
          <span>删除</span>
        </motion.button>
      </div>
    </motion.div>
  )
}
