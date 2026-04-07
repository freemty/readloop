import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export interface ScreenshotBbox {
  x: number
  y: number
  width: number
  height: number
  page: number
}

interface SelectionRect {
  startX: number
  startY: number
  endX: number
  endY: number
}

interface ScreenshotToolProps {
  active: boolean
  canvasRefs: React.MutableRefObject<Map<number, HTMLCanvasElement>>
  currentPage: number
  onCapture: (imageDataUrl: string, bbox: ScreenshotBbox) => void
  onCancel: () => void
}

function normalizeRect(r: SelectionRect) {
  return {
    x: Math.min(r.startX, r.endX),
    y: Math.min(r.startY, r.endY),
    width: Math.abs(r.endX - r.startX),
    height: Math.abs(r.endY - r.startY),
  }
}

export function ScreenshotTool({ active, canvasRefs, currentPage, onCapture, onCancel }: ScreenshotToolProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const [selection, setSelection] = useState<SelectionRect | null>(null)
  const dragOrigin = useRef<{ x: number; y: number } | null>(null)

  // Reset state when deactivated
  useEffect(() => {
    if (!active) {
      setDragging(false)
      setSelection(null)
      dragOrigin.current = null
    }
  }, [active])

  // Escape key cancels
  useEffect(() => {
    if (!active) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [active, onCancel])

  const getOverlayPos = useCallback((e: React.MouseEvent<HTMLDivElement>): { x: number; y: number } => {
    const rect = overlayRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const pos = getOverlayPos(e)
    dragOrigin.current = pos
    setDragging(true)
    setSelection({ startX: pos.x, startY: pos.y, endX: pos.x, endY: pos.y })
  }, [getOverlayPos])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragging || !dragOrigin.current) return
    const pos = getOverlayPos(e)
    setSelection({
      startX: dragOrigin.current.x,
      startY: dragOrigin.current.y,
      endX: pos.x,
      endY: pos.y,
    })
  }, [dragging, getOverlayPos])

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragging || !selection) return
    setDragging(false)

    const normalized = normalizeRect(selection)
    if (normalized.width < 5 || normalized.height < 5) {
      setSelection(null)
      return
    }

    // Find the canvas for the current page and capture the region
    const canvas = canvasRefs.current.get(currentPage)
    if (!canvas) {
      setSelection(null)
      return
    }

    // The overlay covers the entire viewer container; we need to find
    // the canvas position relative to the overlay
    const overlayRect = overlayRef.current?.getBoundingClientRect()
    const canvasRect = canvas.getBoundingClientRect()
    if (!overlayRect) {
      setSelection(null)
      return
    }

    // Offset of canvas within the overlay coordinate space
    const canvasOffsetX = canvasRect.left - overlayRect.left
    const canvasOffsetY = canvasRect.top - overlayRect.top

    // Scale factor: canvas logical pixels vs displayed pixels
    const scaleX = canvas.width / canvasRect.width
    const scaleY = canvas.height / canvasRect.height

    // Region in canvas logical coords
    const bboxX = (normalized.x - canvasOffsetX) * scaleX
    const bboxY = (normalized.y - canvasOffsetY) * scaleY
    const bboxW = normalized.width * scaleX
    const bboxH = normalized.height * scaleY

    // Clamp to canvas bounds
    const clampedX = Math.max(0, Math.round(bboxX))
    const clampedY = Math.max(0, Math.round(bboxY))
    const clampedW = Math.min(canvas.width - clampedX, Math.round(bboxW))
    const clampedH = Math.min(canvas.height - clampedY, Math.round(bboxH))

    if (clampedW <= 0 || clampedH <= 0) {
      setSelection(null)
      return
    }

    try {
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('No canvas context')
      const imageData = ctx.getImageData(clampedX, clampedY, clampedW, clampedH)

      const offscreen = document.createElement('canvas')
      offscreen.width = clampedW
      offscreen.height = clampedH
      const offCtx = offscreen.getContext('2d')
      if (!offCtx) throw new Error('No offscreen context')
      offCtx.putImageData(imageData, 0, 0)
      const dataUrl = offscreen.toDataURL('image/png')

      onCapture(dataUrl, {
        x: clampedX,
        y: clampedY,
        width: clampedW,
        height: clampedH,
        page: currentPage,
      })
    } catch (err) {
      console.error('Screenshot capture failed:', err)
    }

    setSelection(null)
  }, [dragging, selection, canvasRefs, currentPage, onCapture])

  if (!active) return null

  const selectionStyle = selection ? (() => {
    const n = normalizeRect(selection)
    return {
      left: n.x,
      top: n.y,
      width: n.width,
      height: n.height,
    }
  })() : null

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          ref={overlayRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 50,
            cursor: 'crosshair',
            userSelect: 'none',
          }}
        >
          {/* Hint label */}
          {!dragging && (
            <div
              style={{
                position: 'absolute',
                top: 12,
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'var(--accent)',
                color: '#fff',
                fontSize: '0.72rem',
                fontFamily: 'var(--font-ui)',
                padding: '4px 10px',
                borderRadius: 'var(--radius-sm)',
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
                boxShadow: 'var(--shadow-1)',
              }}
            >
              拖拽选择区域截图 · Esc 取消
            </div>
          )}

          {/* Selection rectangle */}
          {selectionStyle && (
            <div
              style={{
                position: 'absolute',
                left: selectionStyle.left,
                top: selectionStyle.top,
                width: selectionStyle.width,
                height: selectionStyle.height,
                border: '2px dashed var(--accent)',
                background: 'var(--accent-light, rgba(201, 159, 105, 0.15))',
                pointerEvents: 'none',
                boxSizing: 'border-box',
              }}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
