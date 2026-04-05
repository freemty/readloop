import { useState, useCallback } from 'react'
import { Bookshelf } from './bookshelf/Bookshelf'
import { PdfViewer } from './pdf/PdfViewer'
import { AiPanel } from './ai/AiPanel'
import { Sidebar } from './layout/Sidebar'
import { Toolbar } from './layout/Toolbar'
import { SelectionMenu } from './annotations/SelectionMenu'
import { SettingsModal, loadSettings } from './settings/SettingsModal'
import { useAnnotations } from './hooks/useAnnotations'
import { useAi } from './hooks/useAi'
import { useGuideCache } from './hooks/useGuideCache'
import { createAnchor } from './pdf/anchor'
import { createStore } from './db/store'
import type { AppView, Annotation, Book, Message } from './types'

export default function App() {
  // Navigation
  const [view, setView] = useState<AppView>('bookshelf')
  const [currentBook, setCurrentBook] = useState<Book | null>(null)
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null)

  // Settings
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Selection
  const [selectionMenuPos, setSelectionMenuPos] = useState<{ x: number; y: number } | null>(null)
  const [selectedText, setSelectedText] = useState('')
  const [selectionPage, setSelectionPage] = useState(0)

  // Guide mode
  const [guideEnabled, setGuideEnabled] = useState(false)
  const [guideContent, setGuideContent] = useState<string | null>(null)
  const [guideLoading, setGuideLoading] = useState(false)
  const [guideStreamingText, setGuideStreamingText] = useState('')

  // Conversation
  const [activeConversation, setActiveConversation] = useState<Message[] | null>(null)
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(null)

  // Hooks
  const bookId = currentBook?.id ?? ''
  const { annotations, addAnnotation, updateAnnotation } = useAnnotations(bookId)
  const { getCachedGuide, addGuide } = useGuideCache(bookId)
  const ai = useAi()

  const handleOpenBook = useCallback(async (id: string, fileData: ArrayBuffer) => {
    const db = await createStore()
    const book = await db.getBook(id)
    if (book) setCurrentBook(book)
    setPdfData(fileData)
    setView('reader')
  }, [])

  const handleTextSelect = useCallback((text: string, anchor: { page: number; rects: DOMRect[] }) => {
    if (!text.trim()) return
    setSelectedText(text)
    setSelectionPage(anchor.page)
    const lastRect = anchor.rects[anchor.rects.length - 1]
    if (lastRect) {
      setSelectionMenuPos({ x: lastRect.right, y: lastRect.bottom })
    }
  }, [])

  const handleAskAi = useCallback(() => {
    setSelectionMenuPos(null)
    const messages: Message[] = []
    setActiveConversation(messages)
    setActiveAnnotationId(null)

    const annotation: Annotation = {
      id: crypto.randomUUID(),
      bookId,
      anchor: createAnchor({
        chapter: '',
        paragraph: 0,
        fullText: selectedText,
        selectedText,
        selectionStart: 0,
        pageHint: selectionPage,
      }),
      type: 'conversation',
      conversation: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    addAnnotation(annotation)
    setActiveAnnotationId(annotation.id)
  }, [bookId, selectedText, selectionPage, addAnnotation])

  const handleSendMessage = useCallback(async (query: string) => {
    if (!currentBook) return

    const userMsg: Message = { role: 'user', content: query, timestamp: Date.now() }
    setActiveConversation(prev => prev ? [...prev, userMsg] : [userMsg])

    try {
      const result = await ai.askAi({
        bookTitle: currentBook.title,
        bookAuthor: currentBook.author,
        currentChapter: '',
        paragraphs: [selectedText],
        currentParagraphIndex: 0,
        selectedText,
        userQuery: query,
        nearbyAnnotations: annotations,
      })

      const assistantMsg: Message = { role: 'assistant', content: result, timestamp: Date.now() }
      setActiveConversation(prev => {
        const updated = prev ? [...prev, assistantMsg] : [assistantMsg]
        if (activeAnnotationId) {
          const ann = annotations.find(a => a.id === activeAnnotationId)
          if (ann) {
            updateAnnotation({
              ...ann,
              conversation: updated,
              updatedAt: Date.now(),
            })
          }
        }
        return updated
      })
    } catch {
      // error is handled by useAi hook
    }
  }, [currentBook, selectedText, annotations, activeAnnotationId, ai, updateAnnotation])

  const handleHighlight = useCallback((color: string) => {
    setSelectionMenuPos(null)
    const annotation: Annotation = {
      id: crypto.randomUUID(),
      bookId,
      anchor: createAnchor({
        chapter: '',
        paragraph: 0,
        fullText: selectedText,
        selectedText,
        selectionStart: 0,
        pageHint: selectionPage,
      }),
      type: 'highlight',
      color,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    addAnnotation(annotation)
  }, [bookId, selectedText, selectionPage, addAnnotation])

  const handleNote = useCallback(() => {
    setSelectionMenuPos(null)
    const noteText = prompt('Enter your note:')
    if (!noteText) return
    const annotation: Annotation = {
      id: crypto.randomUUID(),
      bookId,
      anchor: createAnchor({
        chapter: '',
        paragraph: 0,
        fullText: selectedText,
        selectedText,
        selectionStart: 0,
        pageHint: selectionPage,
      }),
      type: 'note',
      noteText,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    addAnnotation(annotation)
  }, [bookId, selectedText, selectionPage, addAnnotation])

  const handleAnnotationSelect = useCallback((ann: Annotation) => {
    if (ann.type === 'conversation' && ann.conversation) {
      setActiveConversation(ann.conversation)
      setActiveAnnotationId(ann.id)
      setSelectedText(ann.anchor.selectedText)
    }
  }, [])

  const handleExport = useCallback(async () => {
    const db = await createStore()
    const data = await db.exportAll()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `readloop-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  if (view === 'bookshelf') {
    return (
      <>
        <Bookshelf onOpenBook={handleOpenBook} onOpenSettings={() => setSettingsOpen(true)} />
        <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} onSave={() => {}} />
      </>
    )
  }

  return (
    <div className="h-screen flex flex-col">
      <Toolbar
        guideEnabled={guideEnabled}
        onToggleGuide={() => setGuideEnabled(prev => !prev)}
        onExport={handleExport}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <div className="flex-1 flex min-h-0">
        <Sidebar
          bookTitle={currentBook?.title ?? 'Untitled'}
          annotations={annotations}
          onAnnotationSelect={handleAnnotationSelect}
          onBackToShelf={() => { setView('bookshelf'); setCurrentBook(null); setPdfData(null) }}
        />
        <div className="flex-1 relative">
          {pdfData && (
            <PdfViewer
              fileData={pdfData}
              onTextSelect={handleTextSelect}
            />
          )}
          <SelectionMenu
            position={selectionMenuPos}
            onAskAi={handleAskAi}
            onHighlight={handleHighlight}
            onNote={handleNote}
            onDismiss={() => setSelectionMenuPos(null)}
          />
        </div>
        <div className="w-80 border-l bg-white">
          <AiPanel
            guideEnabled={guideEnabled}
            guideContent={guideContent}
            guideLoading={guideLoading}
            guideStreamingText={guideStreamingText}
            onDismissGuide={() => setGuideContent(null)}
            activeConversation={activeConversation}
            conversationLoading={ai.isLoading}
            conversationStreamingText={ai.streamingText}
            conversationError={ai.error}
            onSendMessage={handleSendMessage}
            onCloseConversation={() => { setActiveConversation(null); setActiveAnnotationId(null) }}
          />
        </div>
      </div>
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} onSave={() => {}} />
    </div>
  )
}
