import { useState, useEffect, useCallback } from 'react'
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

export function Bookshelf({ onOpenBook, onOpenSettings }: BookshelfProps) {
  const [books, setBooks] = useState<Book[]>([])
  const [db, setDb] = useState<ReadLoopDB | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const fileCache = useState<Map<string, ArrayBuffer>>(() => new Map())[0]

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

    const book: Book = {
      id: crypto.randomUUID(),
      title: file.name.replace(/\.pdf$/i, ''),
      author: '',
      format: 'pdf',
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
    if (file?.type === 'application/pdf') addBook(file)
  }, [addBook])

  const openExistingBook = useCallback(async (bookId: string) => {
    // Try memory cache first
    const cached = fileCache.get(bookId)
    if (cached) {
      onOpenBook(bookId, cached)
      return
    }
    // Try IndexedDB
    if (db) {
      const stored = await db.getFileData(bookId)
      if (stored) {
        fileCache.set(bookId, stored)
        onOpenBook(bookId, stored)
        return
      }
    }
    // Fallback: ask user to re-select file
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.pdf'
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
      className="h-screen bg-gray-50 flex flex-col"
      onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <div className="flex items-center justify-between px-6 py-4 border-b bg-white">
        <h1 className="text-xl font-semibold">ReadLoop</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setSearchOpen(true)}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
          >
            Search Z-Library
          </button>
          <label className="cursor-pointer px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
            Add PDF
            <input
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) addBook(f) }}
            />
          </label>
          <button
            onClick={onOpenSettings}
            className="px-4 py-2 border rounded hover:bg-gray-100 text-sm"
          >
            Settings
          </button>
        </div>
      </div>

      <div className="flex-1 p-6">
        {isDragging && (
          <div className="border-2 border-dashed border-blue-400 rounded-lg p-12 text-center text-blue-500 mb-4">
            Drop PDF here
          </div>
        )}

        {books.length === 0 && !isDragging ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <span className="text-6xl mb-4">📚</span>
            <p>Drag a PDF here or click "Add PDF" to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {books.map(book => (
              <BookCard
                key={book.id}
                book={book}
                onOpen={openExistingBook}
                onDelete={deleteBook}
              />
            ))}
          </div>
        )}
      </div>

      {searchOpen && (
        <ZlibSearch
          onDownloaded={(file) => { setSearchOpen(false); addBook(file) }}
          onClose={() => setSearchOpen(false)}
        />
      )}
    </div>
  )
}
