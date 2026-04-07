import { useEffect, useRef, useState, useCallback } from 'react'
import { ZoomIn, ZoomOut, Camera } from 'lucide-react'
import * as pdfjsLib from 'pdfjs-dist'
import { ghostButtonStyle } from '../ui/styles'
import { ScreenshotTool } from './ScreenshotTool'
import type { ScreenshotBbox } from './ScreenshotTool'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

interface PdfViewerProps {
  fileData: ArrayBuffer
  onTextSelect?: (text: string, anchor: { page: number; rects: DOMRect[] }) => void
  onPageChange?: (page: number) => void
  onParagraphsReady?: (paragraphs: { index: number; text: string }[], page: number) => void
  onScreenshot?: (imageDataUrl: string, bbox: ScreenshotBbox) => void
}

export function PdfViewer({ fileData, onTextSelect, onPageChange, onParagraphsReady, onScreenshot }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [scale, setScale] = useState(1.5)
  const [screenshotActive, setScreenshotActive] = useState(false)
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map())
  const textLayerRefs = useRef<Map<number, HTMLDivElement>>(new Map())

  useEffect(() => {
    const loadPdf = async () => {
      const doc = await pdfjsLib.getDocument({ data: fileData }).promise
      setPdf(doc)
      setTotalPages(doc.numPages)
    }
    loadPdf()
  }, [fileData])

  const renderPage = useCallback(async (pageNum: number) => {
    if (!pdf) return
    const page = await pdf.getPage(pageNum)
    const viewport = page.getViewport({ scale })

    const canvas = canvasRefs.current.get(pageNum)
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.height = viewport.height
    canvas.width = viewport.width
    await page.render({ canvasContext: ctx, viewport, canvas } as any).promise

    const textLayerDiv = textLayerRefs.current.get(pageNum)
    if (textLayerDiv) {
      textLayerDiv.innerHTML = ''
      textLayerDiv.style.width = `${viewport.width}px`
      textLayerDiv.style.height = `${viewport.height}px`

      const textLayer = new pdfjsLib.TextLayer({
        textContentSource: page.streamTextContent(),
        container: textLayerDiv,
        viewport,
      })
      await textLayer.render()

      if (onParagraphsReady) {
        const textContent = await page.getTextContent()
        const textItems = textContent.items as Array<{ str: string; transform: number[]; height: number }>
        const mapped = textItems.map(item => {
          const t = pdfjsLib.Util.transform(viewport.transform, item.transform)
          return { str: item.str, height: item.height, y: t[5] }
        })
        const { detectParagraphs } = await import('./paragraph')
        const paragraphs = detectParagraphs(mapped)
        onParagraphsReady(paragraphs, pageNum)
      }
    }
  }, [pdf, scale, onParagraphsReady])

  useEffect(() => {
    if (!pdf) return
    const pagesToRender = [currentPage - 1, currentPage, currentPage + 1].filter(
      p => p >= 1 && p <= totalPages
    )
    pagesToRender.forEach(renderPage)
  }, [pdf, currentPage, scale, totalPages, renderPage])

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return
      const container = containerRef.current
      const pages = container.querySelectorAll('[data-page]')
      for (const pageEl of pages) {
        const rect = pageEl.getBoundingClientRect()
        const containerRect = container.getBoundingClientRect()
        if (rect.top < containerRect.bottom && rect.bottom > containerRect.top) {
          const pageNum = parseInt(pageEl.getAttribute('data-page') || '1')
          if (pageNum !== currentPage) {
            setCurrentPage(pageNum)
            onPageChange?.(pageNum)
          }
          break
        }
      }
    }
    const container = containerRef.current
    container?.addEventListener('scroll', handleScroll)
    return () => container?.removeEventListener('scroll', handleScroll)
  }, [currentPage, onPageChange])

  useEffect(() => {
    const handleMouseUp = () => {
      const selection = window.getSelection()
      if (!selection || selection.isCollapsed) return
      const text = selection.toString().trim()
      if (!text) return

      const range = selection.getRangeAt(0)
      const rects = Array.from(range.getClientRects())
      onTextSelect?.(text, { page: currentPage, rects })
    }
    document.addEventListener('mouseup', handleMouseUp)
    return () => document.removeEventListener('mouseup', handleMouseUp)
  }, [currentPage, onTextSelect])


  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div
        className="flex items-center gap-2 px-4 py-2"
        style={{
          background: 'var(--bg-card)',
          borderBottom: '1px solid var(--border)',
          boxShadow: 'var(--shadow-1)',
        }}
      >
        <span
          style={{
            fontSize: '0.8rem',
            fontFamily: 'var(--font-ui)',
            color: 'var(--text-secondary)',
          }}
        >
          Page {currentPage} / {totalPages}
        </span>

        <div className="flex items-center gap-1" style={{ marginLeft: 'auto' }}>
          <button
            onClick={() => setScreenshotActive(prev => !prev)}
            style={{
              ...ghostButtonStyle,
              ...(screenshotActive
                ? {
                    background: 'var(--accent)',
                    color: '#fff',
                    borderColor: 'var(--accent)',
                  }
                : {}),
            }}
            title={screenshotActive ? 'Cancel screenshot (Esc)' : 'Screenshot region for AI'}
          >
            <Camera size={13} strokeWidth={2} />
          </button>
          <button
            onClick={() => setScale(s => Math.max(0.5, s - 0.25))}
            style={ghostButtonStyle}
            title="Zoom out"
          >
            <ZoomOut size={13} strokeWidth={2} />
          </button>
          <span
            style={{
              fontSize: '0.75rem',
              fontFamily: 'var(--font-ui)',
              color: 'var(--text-secondary)',
              minWidth: '3rem',
              textAlign: 'center',
            }}
          >
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale(s => Math.min(3, s + 0.25))}
            style={ghostButtonStyle}
            title="Zoom in"
          >
            <ZoomIn size={13} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* PDF container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto relative"
        style={{ background: 'var(--bg-paper)' }}
      >
        <div className="flex flex-col items-center gap-4 py-6">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
            <div
              key={pageNum}
              data-page={pageNum}
              className="relative bg-white"
              style={{ boxShadow: 'var(--shadow-1)' }}
            >
              <canvas
                ref={el => { if (el) canvasRefs.current.set(pageNum, el) }}
              />
              <div
                ref={el => { if (el) textLayerRefs.current.set(pageNum, el) }}
                className="textLayer"
              />
            </div>
          ))}
        </div>
        <ScreenshotTool
          active={screenshotActive}
          canvasRefs={canvasRefs}
          currentPage={currentPage}
          onCapture={(dataUrl, bbox) => {
            setScreenshotActive(false)
            onScreenshot?.(dataUrl, bbox)
          }}
          onCancel={() => setScreenshotActive(false)}
        />
      </div>
    </div>
  )
}
