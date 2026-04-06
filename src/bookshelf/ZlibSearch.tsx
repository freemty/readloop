import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Search, Download } from 'lucide-react'

const PROXY_BASE = 'http://localhost:3001'

interface SearchResult {
  id: string
  slug: string
  title: string
  author: string
  format: string
  size: string
  year: string
  dlId: string
}

interface ZlibSearchProps {
  onDownloaded: (file: File) => void
  onClose: () => void
}

function decodeHtmlEntities(text: string): string {
  const el = document.createElement('textarea')
  el.innerHTML = text
  return el.value
}

function parseSearchResults(html: string): SearchResult[] {
  const results: SearchResult[] = []
  const bookRegex = /href="\/book\/([^/]+)\/([^"]+)\.html"/g
  let match

  while ((match = bookRegex.exec(html)) !== null) {
    const id = match[1]
    const slug = match[2]
    results.push({
      id,
      slug,
      title: decodeHtmlEntities(decodeURIComponent(slug).replace(/-/g, ' ')),
      author: '',
      format: '',
      size: '',
      year: '',
      dlId: '',
    })
  }

  return results.filter((r, i, arr) => arr.findIndex(x => x.id === r.id) === i)
}

async function fetchBookDetail(bookId: string, slug: string): Promise<{ title: string; author: string; format: string; size: string; dlId: string }> {
  const resp = await fetch(`${PROXY_BASE}/api/book/${bookId}/${slug}.html`)
  const html = await resp.text()

  const titleMatch = html.match(/<h1[^>]*class="book-title"[^>]*>([^<]+)<\/h1>/)
  const title = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : decodeURIComponent(slug).replace(/-/g, ' ')

  const authorMatch = html.match(/<i class="authors"><a[^>]*>([^<]+)<\/a>/)
  const author = authorMatch ? authorMatch[1].trim() : ''

  const dlMatch = html.match(/href="\/dl\/([^"]+)"/)
  const dlId = dlMatch ? dlMatch[1] : ''

  const sizeMatch = html.match(/(\d+\.?\d*)\s*(MB|KB|GB)/i)
  const size = sizeMatch ? `${sizeMatch[1]} ${sizeMatch[2]}` : ''

  const formatMatch = html.match(/\b(pdf|epub|mobi|djvu|fb2)\b/i)
  const format = formatMatch ? formatMatch[1].toUpperCase() : 'PDF'

  return { title, author, format, size, dlId }
}

// Loading spinner dots
function LoadingDots() {
  return (
    <div className="flex items-center gap-1.5 justify-center py-2">
      {[0, 1, 2].map(i => (
        <motion.span
          key={i}
          className="block rounded-full"
          style={{ width: 6, height: 6, background: '#fff' }}
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{
            duration: 1.1,
            repeat: Infinity,
            delay: i * 0.2,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  )
}

const resultVariants = {
  hidden: { opacity: 0, y: 8 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.24, delay: i * 0.05, ease: 'easeOut' },
  }),
}

export function ZlibSearch({ onDownloaded, onClose }: ZlibSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    setResults([])

    try {
      const resp = await fetch(`${PROXY_BASE}/api/search?q=${encodeURIComponent(query)}&ext=pdf`)
      if (!resp.ok) throw new Error(`Search failed: ${resp.status}`)
      const html = await resp.text()
      const parsed = parseSearchResults(html)

      const detailed = await Promise.all(
        parsed.slice(0, 10).map(async (r) => {
          try {
            const detail = await fetchBookDetail(r.id, r.slug)
            return { ...r, ...detail }
          } catch {
            return r
          }
        })
      )

      setResults(detailed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed. Is the proxy running? (node proxy.mjs)')
    } finally {
      setLoading(false)
    }
  }, [query])

  const handleDownload = useCallback(async (result: SearchResult) => {
    if (!result.dlId) {
      setError('No download link found for this book')
      return
    }

    setDownloading(result.id)
    setError(null)

    try {
      const resp = await fetch(`${PROXY_BASE}/api/dl/${result.dlId}`)
      if (!resp.ok) throw new Error(`Download failed: ${resp.status}`)

      const blob = await resp.blob()
      const filename = `${result.title || result.slug}.pdf`
      const file = new File([blob], filename, { type: 'application/pdf' })
      onDownloaded(file)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed')
    } finally {
      setDownloading(null)
    }
  }, [onDownloaded])

  return (
    <>
      {/* Backdrop */}
      <motion.div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.45)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
      >
        <motion.div
          className="pointer-events-auto flex flex-col"
          style={{
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-3)',
            width: 640,
            maxHeight: '80vh',
            overflow: 'hidden',
          }}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
        >
          {/* Modal header */}
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <h2
              className="font-semibold text-base"
              style={{
                fontFamily: 'var(--font-serif)',
                color: 'var(--text-primary)',
              }}
            >
              Search Z-Library
            </h2>
            <motion.button
              onClick={onClose}
              whileHover={{ background: 'var(--bg-paper)' }}
              whileTap={{ scale: 0.93 }}
              className="flex items-center justify-center rounded-full"
              style={{
                width: 30,
                height: 30,
                color: 'var(--text-secondary)',
              }}
            >
              <X size={16} strokeWidth={2} />
            </motion.button>
          </div>

          {/* Search input */}
          <div
            className="px-5 py-3"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <form
              onSubmit={e => { e.preventDefault(); handleSearch() }}
              className="flex gap-2"
            >
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search books..."
                className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
                style={{
                  border: '1.5px solid var(--border)',
                  color: 'var(--text-primary)',
                  background: 'var(--bg-paper)',
                  fontFamily: 'var(--font-ui)',
                }}
                autoFocus
              />
              <motion.button
                type="submit"
                disabled={loading || !query.trim()}
                whileHover={{ opacity: 0.88 }}
                whileTap={{ scale: 0.96 }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
                style={{
                  background: 'var(--accent)',
                  color: '#fff',
                  fontFamily: 'var(--font-ui)',
                  minWidth: 90,
                  justifyContent: 'center',
                }}
              >
                {loading ? <LoadingDots /> : (
                  <>
                    <Search size={13} strokeWidth={2} />
                    Search
                  </>
                )}
              </motion.button>
            </form>
          </div>

          {/* Error */}
          {error && (
            <div
              className="px-5 py-2 text-sm"
              style={{ background: '#FEF2F2', color: '#DC2626' }}
            >
              {error}
            </div>
          )}

          {/* Results */}
          <div className="flex-1 overflow-auto">
            {results.length === 0 && !loading && (
              <div
                className="flex items-center justify-center text-sm"
                style={{ height: 160, color: 'var(--text-muted)' }}
              >
                {query ? 'No results' : 'Enter a book title to search'}
              </div>
            )}

            {results.map((r, i) => (
              <motion.div
                key={r.id}
                custom={i}
                variants={resultVariants}
                initial="hidden"
                animate="show"
                className="flex items-center justify-between px-5 py-3"
                style={{ borderBottom: '1px solid var(--border)' }}
                whileHover={{ background: 'var(--bg-paper)' }}
              >
                <div className="flex-1 min-w-0 mr-3">
                  <div
                    className="text-sm truncate font-medium"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {r.title}
                  </div>
                  <div
                    className="text-xs truncate mt-0.5"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {r.author || 'Unknown author'}
                    {r.size && ` · ${r.size}`}
                    {r.format && ` · ${r.format}`}
                  </div>
                </div>

                <motion.button
                  onClick={() => handleDownload(r)}
                  disabled={downloading === r.id || !r.dlId}
                  whileHover={{ opacity: 0.85 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40 whitespace-nowrap"
                  style={{
                    background: r.dlId ? 'var(--accent)' : 'var(--bg-paper)',
                    color: r.dlId ? '#fff' : 'var(--text-muted)',
                    border: r.dlId ? 'none' : '1px solid var(--border)',
                    fontFamily: 'var(--font-ui)',
                  }}
                >
                  {downloading === r.id ? (
                    <LoadingDots />
                  ) : r.dlId ? (
                    <>
                      <Download size={12} strokeWidth={2} />
                      Download
                    </>
                  ) : (
                    'N/A'
                  )}
                </motion.button>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </>
  )
}
