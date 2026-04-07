import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, HardDrive, BookOpen } from 'lucide-react'

const PROXY_BASE = 'http://localhost:3001'

interface LocalBook {
  path: string
  name: string
  format: string
  size: number
  modified: number
}

interface LocalBooksProps {
  onImport: (file: File) => void
  onClose: () => void
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function LocalBooks({ onImport, onClose }: LocalBooksProps) {
  const [books, setBooks] = useState<LocalBook[]>([])
  const [loading, setLoading] = useState(false)
  const [scanned, setScanned] = useState(false)
  const [importing, setImporting] = useState<string | null>(null)

  const handleScan = useCallback(async () => {
    setLoading(true)
    try {
      const resp = await fetch(`${PROXY_BASE}/api/local-books`)
      const data = await resp.json()
      setBooks(data)
      setScanned(true)
    } catch {
      setBooks([])
    } finally {
      setLoading(false)
    }
  }, [])

  const handleImport = useCallback(async (book: LocalBook) => {
    setImporting(book.path)
    try {
      const resp = await fetch(`${PROXY_BASE}/api/local-file?path=${encodeURIComponent(book.path)}`)
      const blob = await resp.blob()
      const file = new File([blob], `${book.name}.${book.format}`, {
        type: book.format === 'epub' ? 'application/epub+zip' : 'application/pdf',
      })
      onImport(file)
    } catch {
      // silently fail
    } finally {
      setImporting(null)
    }
  }, [onImport])

  const epubs = books.filter(b => b.format === 'epub')
  const pdfs = books.filter(b => b.format === 'pdf')

  return (
    <>
      <motion.div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.45)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <motion.div
          className="pointer-events-auto flex flex-col"
          style={{
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-3)',
            width: 580,
            maxHeight: '80vh',
            overflow: 'hidden',
          }}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.22 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2">
              <HardDrive size={16} style={{ color: 'var(--accent)' }} />
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1rem', fontWeight: 600 }}>
                Local Books
              </h2>
            </div>
            <motion.button
              onClick={onClose}
              whileHover={{ background: 'var(--bg-paper)' }}
              whileTap={{ scale: 0.93 }}
              className="flex items-center justify-center rounded-full"
              style={{ width: 30, height: 30, color: 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              <X size={16} />
            </motion.button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto">
            {!scanned ? (
              <div className="flex flex-col items-center justify-center gap-4 py-12">
                <BookOpen size={36} style={{ color: 'var(--text-muted)' }} strokeWidth={1.5} />
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontFamily: 'var(--font-serif)' }}>
                  Scan Downloads, Documents, Desktop for books
                </p>
                <motion.button
                  onClick={handleScan}
                  disabled={loading}
                  whileHover={{ opacity: 0.88 }}
                  whileTap={{ scale: 0.96 }}
                  className="px-5 py-2.5 rounded-lg text-sm font-medium"
                  style={{ background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer' }}
                >
                  {loading ? 'Scanning...' : 'Scan Local Files'}
                </motion.button>
              </div>
            ) : books.length === 0 ? (
              <div className="flex items-center justify-center py-12" style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                No books found
              </div>
            ) : (
              <div>
                {epubs.length > 0 && (
                  <div>
                    <div className="px-5 pt-3 pb-1" style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                      EPUB ({epubs.length})
                    </div>
                    {epubs.map((book, i) => (
                      <motion.div
                        key={book.path}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="flex items-center justify-between px-5 py-2.5"
                        style={{ borderBottom: '1px solid var(--border)' }}
                      >
                        <div className="flex-1 min-w-0 mr-3">
                          <div className="text-sm truncate" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{book.name}</div>
                          <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{formatSize(book.size)}</div>
                        </div>
                        <motion.button
                          onClick={() => handleImport(book)}
                          disabled={importing === book.path}
                          whileTap={{ scale: 0.95 }}
                          className="px-3 py-1 rounded text-xs font-medium"
                          style={{ background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', opacity: importing === book.path ? 0.5 : 1 }}
                        >
                          {importing === book.path ? '...' : 'Import'}
                        </motion.button>
                      </motion.div>
                    ))}
                  </div>
                )}
                {pdfs.length > 0 && (
                  <div>
                    <div className="px-5 pt-3 pb-1" style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                      PDF ({pdfs.length})
                    </div>
                    {pdfs.slice(0, 20).map((book, i) => (
                      <motion.div
                        key={book.path}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="flex items-center justify-between px-5 py-2.5"
                        style={{ borderBottom: '1px solid var(--border)' }}
                      >
                        <div className="flex-1 min-w-0 mr-3">
                          <div className="text-sm truncate" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{book.name}</div>
                          <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{formatSize(book.size)}</div>
                        </div>
                        <motion.button
                          onClick={() => handleImport(book)}
                          disabled={importing === book.path}
                          whileTap={{ scale: 0.95 }}
                          className="px-3 py-1 rounded text-xs font-medium"
                          style={{ background: 'var(--text-secondary)', color: '#fff', border: 'none', cursor: 'pointer', opacity: importing === book.path ? 0.5 : 1 }}
                        >
                          {importing === book.path ? '...' : 'Import'}
                        </motion.button>
                      </motion.div>
                    ))}
                    {pdfs.length > 20 && (
                      <div className="px-5 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                        ...and {pdfs.length - 20} more PDFs
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </>
  )
}
