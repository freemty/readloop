import { useEffect, useRef, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Type } from 'lucide-react'
import ePub from 'epubjs'
import type Book from 'epubjs/types/book'
import type Rendition from 'epubjs/types/rendition'
import type { NavItem } from 'epubjs/types/navigation'
import { ghostButtonStyle } from '../ui/styles'

import type { Annotation } from '../types'

interface EpubViewerProps {
  fileData: ArrayBuffer
  annotations?: Annotation[]
  jumpToText?: string | null
  onTextSelect?: (text: string, anchor: { page: number; rects: DOMRect[] }) => void
  onAnnotationClick?: (annotation: Annotation) => void
  onPageChange?: (page: number) => void
  onParagraphsReady?: (paragraphs: { index: number; text: string }[], page: number, chapter?: string) => void
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

function applyHighlightsToDoc(doc: Document, annotations: Annotation[]) {
  const relevant = annotations.filter(
    a => (a.type === 'highlight' || a.type === 'conversation' || a.type === 'note') && a.anchor.selectedText
  )
  if (relevant.length === 0) return

  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text)

  for (const ann of relevant) {
    const searchText = ann.anchor.selectedText

    for (const node of textNodes) {
      const idx = node.textContent?.indexOf(searchText) ?? -1
      if (idx === -1) continue

      const range = doc.createRange()
      range.setStart(node, idx)
      range.setEnd(node, idx + searchText.length)

      const mark = doc.createElement('mark')
      mark.setAttribute('data-readloop', '1')
      mark.setAttribute('data-annotation-id', ann.id)

      if (ann.type === 'highlight') {
        const color = ann.color || '#ffeb3b'
        mark.style.backgroundColor = color
        mark.style.opacity = '0.4'
        mark.style.borderRadius = '2px'
        mark.style.padding = '0 1px'
      } else if (ann.type === 'conversation') {
        mark.style.backgroundColor = 'transparent'
        mark.style.borderBottom = '2px dotted #C06030'
        mark.style.padding = '0'
        mark.style.cursor = 'pointer'
      } else if (ann.type === 'note') {
        mark.style.backgroundColor = 'transparent'
        mark.style.borderBottom = '2px dotted #8C8578'
        mark.style.padding = '0'
        mark.style.cursor = 'pointer'
      }

      const contents = range.extractContents()
      mark.appendChild(contents)

      // Add a small chat icon badge for conversation annotations
      if (ann.type === 'conversation') {
        const badge = doc.createElement('span')
        badge.setAttribute('data-readloop-badge', '1')
        badge.textContent = '💬'
        badge.style.cssText = 'font-size:10px;margin-left:2px;vertical-align:super;cursor:pointer;user-select:none;'
        mark.appendChild(badge)
      }

      range.insertNode(mark)
      break
    }
  }
}

export function EpubViewer({
  fileData,
  annotations: externalAnnotations,
  jumpToText,
  onTextSelect,
  onAnnotationClick,
  onPageChange,
  onParagraphsReady,
}: EpubViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const bookRef = useRef<Book | null>(null)
  const renditionRef = useRef<Rendition | null>(null)
  const annotationsRef = useRef(externalAnnotations)
  annotationsRef.current = externalAnnotations
  const onAnnotationClickRef = useRef(onAnnotationClick)
  onAnnotationClickRef.current = onAnnotationClick

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

    // Content hook — inject mouseup + click listeners into each iframe
    // (highlights are applied by the separate externalAnnotations effect)
    rendition.hooks.content.register((contents: { window: Window; document: Document }) => {
      const iframeDoc = contents.document
      const iframeWin = contents.window

      // Click on annotation marks → open conversation
      iframeDoc.addEventListener('click', (e: MouseEvent) => {
        const target = e.target as HTMLElement
        const mark = target.closest('mark[data-annotation-id]') as HTMLElement | null
        if (!mark) return
        const annId = mark.getAttribute('data-annotation-id')
        if (!annId || !onAnnotationClickRef.current || !annotationsRef.current) return
        const ann = annotationsRef.current.find(a => a.id === annId)
        if (ann && (ann.type === 'conversation' || ann.type === 'note')) {
          e.stopPropagation()
          onAnnotationClickRef.current(ann)
        }
      })

      iframeDoc.addEventListener('mouseup', () => {
        setTimeout(() => {
          const selection = iframeWin.getSelection()
          const text = selection?.toString().trim() ?? ''
          if (!text || !onTextSelect) return

          const rects: DOMRect[] = []
          if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0)
            const clientRects = Array.from(range.getClientRects())

            // Find which iframe this content belongs to
            const iframes = containerRef.current?.querySelectorAll('iframe') ?? []
            let offsetX = 0
            let offsetY = 0
            for (const iframe of iframes) {
              if ((iframe as HTMLIFrameElement).contentWindow === iframeWin) {
                const rect = iframe.getBoundingClientRect()
                offsetX = rect.left
                offsetY = rect.top
                break
              }
            }

            for (const r of clientRects) {
              rects.push(new DOMRect(r.x + offsetX, r.y + offsetY, r.width, r.height))
            }
          }

          onTextSelect(text, { page: 0, rects })
        }, 10)
      })
    })

    // Relocation handler
    rendition.on('relocated', (location: { start: { cfi: string; href: string; displayed: { page: number } } }) => {
      setCurrentCfi(location.start.cfi)

      const sectionHref = location.start.href
      const navItem = findNavItemByHref(toc, sectionHref)
      const chapterLabel = navItem?.label ?? ''
      setChapterTitle(chapterLabel)

      onPageChange?.(location.start.displayed.page)

      // Extract paragraphs from current section
      try {
        const contents = rendition.getContents() as unknown
        if (contents && typeof contents === 'object' && 'document' in (contents as Record<string, unknown>)) {
          const doc = (contents as { document: Document }).document
          const paragraphs = extractParagraphs(doc)
          onParagraphsReady?.(paragraphs, location.start.displayed.page, chapterLabel)
        } else if (Array.isArray(contents)) {
          const firstContents = (contents as Array<{ document: Document }>)[0]
          if (firstContents?.document) {
            const paragraphs = extractParagraphs(firstContents.document)
            onParagraphsReady?.(paragraphs, location.start.displayed.page, chapterLabel)
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

  // Re-apply highlights when annotations change
  useEffect(() => {
    const rendition = renditionRef.current
    if (!rendition || !externalAnnotations) return

    try {
      const contents = rendition.getContents()
      if (Array.isArray(contents)) {
        for (const c of contents as Array<{ document: Document }>) {
          if (c?.document) {
            // Remove existing marks first
            const marks = c.document.querySelectorAll('mark[data-readloop]')
            marks.forEach(m => {
              const parent = m.parentNode
              if (parent) {
                parent.replaceChild(c.document.createTextNode(m.textContent || ''), m)
                parent.normalize()
              }
            })
            applyHighlightsToDoc(c.document, externalAnnotations)
          }
        }
      }
    } catch {
      // contents may not be ready
    }
  }, [externalAnnotations])

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

  // Jump to text — search iframe text nodes and scroll into view
  useEffect(() => {
    if (!jumpToText) return
    const rendition = renditionRef.current
    if (!rendition) return

    const tryJump = () => {
      try {
        const contents = rendition.getContents()
        const contentsList = Array.isArray(contents) ? contents as Array<{ document: Document }> : []
        for (const c of contentsList) {
          if (!c?.document) continue
          const walker = c.document.createTreeWalker(c.document.body, NodeFilter.SHOW_TEXT)
          while (walker.nextNode()) {
            const node = walker.currentNode as Text
            const idx = node.textContent?.indexOf(jumpToText) ?? -1
            if (idx === -1) continue
            const range = c.document.createRange()
            range.setStart(node, idx)
            range.setEnd(node, idx + jumpToText.length)
            const rect = range.getBoundingClientRect()
            if (rect.height > 0) {
              const el = node.parentElement
              el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
              return
            }
          }
        }
      } catch {
        // contents may not be ready yet
      }
    }

    // Small delay to ensure content is rendered
    const timer = setTimeout(tryJump, 200)
    return () => clearTimeout(timer)
  }, [jumpToText])

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
