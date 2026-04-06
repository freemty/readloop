import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Plus, Settings, Library } from 'lucide-react'
import { BookCard } from './BookCard'
import { ZlibSearch } from './ZlibSearch'
import { createStore, type ReadLoopDB } from '../db/store'
import type { Book } from '../types'

interface BookshelfProps {
  onOpenBook: (bookId: string, fileData: ArrayBuffer) => void
  onOpenSettings: () => void
}

async function hashFile(buffer: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

const containerVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.06,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: 'easeOut' } },
}

export function Bookshelf({ onOpenBook, onOpenSettings }: BookshelfProps) {
  const [books, setBooks] = useState<Book[]>([])
  const [db, setDb] = useState<ReadLoopDB | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const fileCache = useRef(new Map<string, ArrayBuffer>()).current

  useEffect(() => {
    createStore().then(store => {
      setDb(store)
      store.getAllBooks().then(setBooks)
    })
  }, [])

  const addBook = useCallback(async (file: File) => {
    if (!db) return
    const buffer = await file.arrayBuffer()
    const fileHash = await hashFile(buffer)

    const existing = books.find(b => b.fileHash === fileHash)
    if (existing) {
      fileCache.set(existing.id, buffer)
      await db.saveFileData(existing.id, buffer)
      onOpenBook(existing.id, buffer)
      return
    }

    const format = file.name.toLowerCase().endsWith('.epub') ? 'epub' as const : 'pdf' as const
    const book: Book = {
      id: crypto.randomUUID(),
      title: file.name.replace(/\.(pdf|epub)$/i, ''),
      author: '',
      format,
      fileHash,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    await db.addBook(book)
    await db.saveFileData(book.id, buffer)
    fileCache.set(book.id, buffer)
    setBooks(prev => [...prev, book])
    onOpenBook(book.id, buffer)
  }, [db, books, fileCache, onOpenBook])

  const deleteBook = useCallback(async (bookId: string) => {
    if (!db) return
    await db.deleteBook(bookId)
    await db.deleteFileData(bookId)
    setBooks(prev => prev.filter(b => b.id !== bookId))
    fileCache.delete(bookId)
  }, [db, fileCache])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file?.type === 'application/pdf' || file?.type === 'application/epub+zip' || file?.name.endsWith('.epub')) addBook(file)
  }, [addBook])

  const openExistingBook = useCallback(async (bookId: string) => {
    const cached = fileCache.get(bookId)
    if (cached) {
      onOpenBook(bookId, cached)
      return
    }
    if (db) {
      const stored = await db.getFileData(bookId)
      if (stored) {
        fileCache.set(bookId, stored)
        onOpenBook(bookId, stored)
        return
      }
    }
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.pdf,.epub'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const buffer = await file.arrayBuffer()
      fileCache.set(bookId, buffer)
      if (db) await db.saveFileData(bookId, buffer)
      onOpenBook(bookId, buffer)
    }
    input.click()
  }, [db, fileCache, onOpenBook])

  return (
    <div
      className="h-screen flex flex-col"
      style={{ background: 'var(--bg-warm)' }}
      onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4"
        style={{
          background: 'var(--bg-card)',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}
      >
        <h1
          className="text-xl font-semibold"
          style={{
            fontFamily: 'var(--font-serif)',
            color: 'var(--text-primary)',
          }}
        >
          ReadLoop
        </h1>
        <div className="flex items-center gap-2">
          {/* Search Z-Library */}
          <motion.button
            onClick={() => setSearchOpen(true)}
            whileHover={{ opacity: 0.88 }}
            whileTap={{ scale: 0.96 }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium"
            style={{
              background: 'var(--accent)',
              color: '#fff',
              fontFamily: 'var(--font-ui)',
            }}
          >
            <Search size={14} strokeWidth={2} />
            Search Z-Library
          </motion.button>

          {/* Add PDF */}
          <label
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer"
            style={{
              border: '1.5px solid var(--accent)',
              color: 'var(--accent)',
              fontFamily: 'var(--font-ui)',
            }}
          >
            <Plus size={14} strokeWidth={2} />
            Add Book
            <input
              type="file"
              accept=".pdf,.epub"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) addBook(f) }}
            />
          </label>

          {/* Settings */}
          <motion.button
            onClick={onOpenSettings}
            whileHover={{ background: 'var(--bg-paper)' }}
            whileTap={{ scale: 0.96 }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm"
            style={{
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-ui)',
            }}
          >
            <Settings size={15} strokeWidth={1.75} />
            <span>Settings</span>
          </motion.button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 p-6 overflow-auto">
        {/* Drag zone */}
        <AnimatePresence>
          {isDragging && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              className="rounded-xl p-12 text-center text-sm font-medium mb-4"
              style={{
                border: '2px dashed var(--accent)',
                background: 'var(--accent-light)',
                color: 'var(--accent)',
              }}
            >
              Drop PDF here
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty state */}
        {books.length === 0 && !isDragging ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <Library
              size={56}
              strokeWidth={1.25}
              style={{ color: 'var(--text-muted)' }}
            />
            <p
              className="text-base"
              style={{
                fontFamily: 'var(--font-serif)',
                color: 'var(--text-muted)',
              }}
            >
              Drag a PDF here or click "Add PDF" to get started
            </p>
          </div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4"
          >
            {books.map(book => (
              <motion.div key={book.id} variants={itemVariants}>
                <BookCard
                  book={book}
                  onOpen={openExistingBook}
                  onDelete={deleteBook}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      {/* Z-Library Search Modal */}
      <AnimatePresence>
        {searchOpen && (
          <ZlibSearch
            onDownloaded={(file) => { setSearchOpen(false); addBook(file) }}
            onClose={() => setSearchOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
