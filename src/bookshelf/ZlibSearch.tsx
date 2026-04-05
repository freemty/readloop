import { useState, useCallback } from 'react'

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

      // Fetch details for top 10 results
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[640px] max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="font-semibold">Search Z-Library</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">X</button>
        </div>

        <div className="px-4 py-3 border-b">
          <form onSubmit={e => { e.preventDefault(); handleSearch() }} className="flex gap-2">
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search books..."
              className="flex-1 border rounded px-3 py-2 text-sm"
              autoFocus
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </form>
        </div>

        {error && (
          <div className="px-4 py-2 bg-red-50 text-red-600 text-sm">{error}</div>
        )}

        <div className="flex-1 overflow-auto">
          {results.length === 0 && !loading && (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
              {query ? 'No results' : 'Enter a book title to search'}
            </div>
          )}

          {results.map(r => (
            <div
              key={r.id}
              className="px-4 py-3 border-b hover:bg-gray-50 flex items-center justify-between"
            >
              <div className="flex-1 min-w-0 mr-3">
                <div className="font-medium text-sm truncate">{r.title}</div>
                <div className="text-xs text-gray-500 truncate">
                  {r.author || 'Unknown author'}
                  {r.size && ` · ${r.size}`}
                  {r.format && ` · ${r.format}`}
                </div>
              </div>
              <button
                onClick={() => handleDownload(r)}
                disabled={downloading === r.id || !r.dlId}
                className="px-3 py-1.5 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50 whitespace-nowrap"
              >
                {downloading === r.id ? 'Downloading...' : r.dlId ? 'Download' : 'N/A'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
