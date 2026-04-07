import { useEffect, useRef, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Type } from 'lucide-react'
import ePub from 'epubjs'
import type Book from 'epubjs/types/book'
import type Rendition from 'epubjs/types/rendition'
import type { NavItem } from 'epubjs/types/navigation'
import { ghostButtonStyle } from '../ui/styles'

interface EpubViewerProps {
  fileData: ArrayBuffer
  onTextSelect?: (text: string, anchor: { page: number; rects: DOMRect[] }) => void
  onPageChange?: (page: number) => void
  onParagraphsReady?: (paragraphs: { index: number; text: string }[], page: number) => void
}

const FONT_SIZES = [14, 16, 18, 20, 22, 24]
const DEFAULT_FONT_SIZE_INDEX = 2 // 18px

function extractParagraphs(doc: Document): { index: number; text: string }[] {
  const paragraphs: { index: number; text: string }[] = []
  const elements = doc.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6, li, blockquote')

  let index = 0
  elements.forEach(el => {
    const text = (el.textContent ?? '').trim()
    if (text.length > 0) {
      paragraphs.push({ index, text })
      index += 1
    }
  })

  return paragraphs
}

export function EpubViewer({
  fileData,
  onTextSelect,
  onPageChange,
  onParagraphsReady,
}: EpubViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const bookRef = useRef<Book | null>(null)
  const renditionRef = useRef<Rendition | null>(null)

  const [chapterTitle, setChapterTitle] = useState('')
  const [toc, setToc] = useState<NavItem[]>([])
  const [fontSizeIndex, setFontSizeIndex] = useState(DEFAULT_FONT_SIZE_INDEX)
  const [currentCfi, setCurrentCfi] = useState('')

  const applyTheme = useCallback((rendition: Rendition, fontSize: number) => {
    rendition.themes.default({
      'body': {
        'font-family': 'Georgia, "Noto Serif SC", serif !important',
        'color': '#2C2C2C !important',
        'line-height': '1.8 !important',
        'background': '#FAF8F5 !important',
        'padding': '0 2em !important',
        'font-size': `${fontSize}px !important`,
      },
      'p': {
        'margin-bottom': '1em !important',
      },
      'h1, h2, h3, h4, h5, h6': {
        'color': '#2C2C2C !important',
        'margin-top': '1.5em !important',
        'margin-bottom': '0.5em !important',
      },
      'a': {
        'color': '#C06030 !important',
      },
    })
  }, [])

  // Initialize book and rendition
  useEffect(() => {
    if (!containerRef.current) return

    const book = ePub(fileData)
    bookRef.current = book

    const rendition = book.renderTo(containerRef.current, {
      flow: 'scrolled',
      width: '100%',
      height: '100%',
      manager: 'continuous',
    } as any)
    renditionRef.current = rendition

    applyTheme(rendition, FONT_SIZES[fontSizeIndex])

    rendition.display()

    // Load TOC
    book.loaded.navigation.then(nav => {
      setToc(nav.toc)
    })

    // Selection handler
    rendition.on('selected', (cfiRange: string, contents: { window: Window; document: Document }) => {
      const selection = contents.window.getSelection()
      const text = selection?.toString().trim() ?? ''
      if (!text || !onTextSelect) return

      const pseudoPage = Math.abs(
        cfiRange.split('').reduce((acc, c) => ((acc << 5) - acc) + c.charCodeAt(0), 0)
      ) % 100000

      // Get rects and offset from iframe to main page coordinates
      const rects: DOMRect[] = []
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        const clientRects = Array.from(range.getClientRects())

        // Find the iframe element to get its offset in the main page
        const iframe = containerRef.current?.querySelector('iframe')
        const iframeRect = iframe?.getBoundingClientRect()
        const offsetX = iframeRect?.left ?? 0
        const offsetY = iframeRect?.top ?? 0

        for (const r of clientRects) {
          rects.push(new DOMRect(r.x + offsetX, r.y + offsetY, r.width, r.height))
        }
      }

      onTextSelect(text, { page: pseudoPage, rects })
    })

    // Relocation handler
    rendition.on('relocated', (location: { start: { cfi: string; href: string; displayed: { page: number } } }) => {
      setCurrentCfi(location.start.cfi)

      const sectionHref = location.start.href
      const navItem = findNavItemByHref(toc, sectionHref)
      setChapterTitle(navItem?.label ?? '')

      onPageChange?.(location.start.displayed.page)

      // Extract paragraphs from current section
      try {
        const contents = rendition.getContents() as unknown
        if (contents && typeof contents === 'object' && 'document' in (contents as Record<string, unknown>)) {
          const doc = (contents as { document: Document }).document
          const paragraphs = extractParagraphs(doc)
          onParagraphsReady?.(paragraphs, location.start.displayed.page)
        } else if (Array.isArray(contents)) {
          const firstContents = (contents as Array<{ document: Document }>)[0]
          if (firstContents?.document) {
            const paragraphs = extractParagraphs(firstContents.document)
            onParagraphsReady?.(paragraphs, location.start.displayed.page)
          }
        }
      } catch {
        // Contents may not be available during initial load
      }
    })

    return () => {
      rendition.destroy()
      book.destroy()
      bookRef.current = null
      renditionRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileData])

  // Update chapter title when toc changes (for initial load)
  useEffect(() => {
    if (toc.length === 0 || !currentCfi) return
    // Try to find current chapter from toc
    const rendition = renditionRef.current
    if (!rendition?.location?.start?.href) return
    const navItem = findNavItemByHref(toc, rendition.location.start.href)
    if (navItem) setChapterTitle(navItem.label)
  }, [toc, currentCfi])

  const currentCfiRef = useRef(currentCfi)
  currentCfiRef.current = currentCfi

  useEffect(() => {
    const rendition = renditionRef.current
    if (!rendition) return
    applyTheme(rendition, FONT_SIZES[fontSizeIndex])
    if (currentCfiRef.current) {
      rendition.display(currentCfiRef.current)
    }
  }, [fontSizeIndex, applyTheme])

  const handlePrev = useCallback(() => {
    renditionRef.current?.prev()
  }, [])

  const handleNext = useCallback(() => {
    renditionRef.current?.next()
  }, [])

  const handleFontSizeDown = useCallback(() => {
    setFontSizeIndex(prev => Math.max(0, prev - 1))
  }, [])

  const handleFontSizeUp = useCallback(() => {
    setFontSizeIndex(prev => Math.min(FONT_SIZES.length - 1, prev + 1))
  }, [])


  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="flex items-center gap-2 px-4 py-2"
        style={{
          background: 'var(--bg-card)',
          borderBottom: '1px solid var(--border)',
          boxShadow: 'var(--shadow-1)',
        }}
      >
        {/* Prev chapter */}
        <motion.button
          onClick={handlePrev}
          whileHover={{ background: 'var(--bg-paper)' }}
          whileTap={{ scale: 0.93 }}
          style={ghostButtonStyle}
          title="Previous section"
        >
          <ChevronLeft size={14} strokeWidth={2} />
        </motion.button>

        {/* Chapter title */}
        <span
          className="truncate"
          style={{
            fontSize: '0.8rem',
            fontFamily: 'var(--font-serif)',
            color: 'var(--text-secondary)',
            maxWidth: '40ch',
          }}
          title={chapterTitle}
        >
          {chapterTitle || 'EPUB Reader'}
        </span>

        {/* Next chapter */}
        <motion.button
          onClick={handleNext}
          whileHover={{ background: 'var(--bg-paper)' }}
          whileTap={{ scale: 0.93 }}
          style={ghostButtonStyle}
          title="Next section"
        >
          <ChevronRight size={14} strokeWidth={2} />
        </motion.button>

        {/* Font size controls */}
        <div className="flex items-center gap-1" style={{ marginLeft: 'auto' }}>
          <motion.button
            onClick={handleFontSizeDown}
            whileHover={{ background: 'var(--bg-paper)' }}
            whileTap={{ scale: 0.93 }}
            style={ghostButtonStyle}
            title="Decrease font size"
            disabled={fontSizeIndex === 0}
          >
            <Type size={11} strokeWidth={2} />
          </motion.button>
          <span
            style={{
              fontSize: '0.75rem',
              fontFamily: 'var(--font-ui)',
              color: 'var(--text-secondary)',
              minWidth: '3rem',
              textAlign: 'center',
            }}
          >
            {FONT_SIZES[fontSizeIndex]}px
          </span>
          <motion.button
            onClick={handleFontSizeUp}
            whileHover={{ background: 'var(--bg-paper)' }}
            whileTap={{ scale: 0.93 }}
            style={ghostButtonStyle}
            title="Increase font size"
            disabled={fontSizeIndex === FONT_SIZES.length - 1}
          >
            <Type size={15} strokeWidth={2} />
          </motion.button>
        </div>
      </motion.div>

      {/* EPUB container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto"
        style={{ background: 'var(--bg-warm)' }}
      />
    </div>
  )
}

function findNavItemByHref(toc: NavItem[], href: string): NavItem | undefined {
  for (const item of toc) {
    // href may contain fragment identifiers, compare base path
    const itemBase = item.href.split('#')[0]
    const hrefBase = href.split('#')[0]
    if (hrefBase.endsWith(itemBase) || itemBase.endsWith(hrefBase) || itemBase === hrefBase) {
      return item
    }
    if (item.subitems) {
      const found = findNavItemByHref(item.subitems, href)
      if (found) return found
    }
  }
  return undefined
}
