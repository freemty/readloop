import type { Book } from '../types'

interface BookCardProps {
  book: Book
  onOpen: (bookId: string) => void
  onDelete: (bookId: string) => void
}

export function BookCard({ book, onOpen, onDelete }: BookCardProps) {
  return (
    <div
      className="bg-white rounded-lg shadow p-4 cursor-pointer hover:shadow-md transition-shadow group"
      onClick={() => onOpen(book.id)}
    >
      <div className="w-full h-40 bg-gradient-to-br from-blue-100 to-blue-200 rounded mb-3 flex items-center justify-center">
        <span className="text-4xl">📖</span>
      </div>
      <h3 className="font-medium text-sm truncate">{book.title}</h3>
      <p className="text-xs text-gray-500 truncate">{book.author || 'Unknown author'}</p>
      <button
        onClick={e => { e.stopPropagation(); onDelete(book.id) }}
        className="mt-2 text-xs text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        Delete
      </button>
    </div>
  )
}
