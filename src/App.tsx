import { useState, useCallback, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bookshelf } from './bookshelf/Bookshelf'
import { PdfViewer } from './pdf/PdfViewer'
import { EpubViewer } from './epub/EpubViewer'
import { AiPanel } from './ai/AiPanel'
import { Sidebar } from './layout/Sidebar'
import { Toolbar } from './layout/Toolbar'
import { SelectionMenu } from './annotations/SelectionMenu'
import { SettingsModal, loadSettings } from './settings/SettingsModal'
import { useAnnotations } from './hooks/useAnnotations'
import { useAi } from './hooks/useAi'
import { useGuideCache } from './hooks/useGuideCache'
import { createAnchor } from './pdf/anchor'
import { getStore } from './db/store'
import { screenshotSystemPrompt, type AiMode } from './ai/prompts'
import type { AppView, Annotation, Book, Message } from './types'
import type { ScreenshotBbox } from './pdf/ScreenshotTool'
import { initWiki, type ChapterText } from './wiki/initWiki'
import { updateWiki } from './wiki/updateWiki'
import { readChapterConcepts, listWikiFiles } from './wiki/readWiki'
import { buildWikiContextBlock } from './wiki/prompts'
import { bookSlug, nodeSlug } from './wiki/slugify'

export default function App() {
  const [view, setViewState] = useState<AppView>('bookshelf')
  const [currentBook, setCurrentBook] = useState<Book | null>(null)
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null)

  // Sync view with browser history
  const setView = useCallback((v: AppView) => {
    setViewState(v)
    if (v === 'reader') {
      history.pushState({ view: 'reader' }, '', '#reader')
    } else {
      history.replaceState({ view: 'bookshelf' }, '', '#')
    }
  }, [])

  useEffect(() => {
    const handlePopState = () => {
      const hash = window.location.hash
      if (hash === '#reader' && view === 'reader') {
        // User pressed back while in reader → go to bookshelf
        setViewState('bookshelf')
        setCurrentBook(null)
        setPdfData(null)
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [view])

  // Settings
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Selection
  const [selectionMenuPos, setSelectionMenuPos] = useState<{ x: number; y: number } | null>(null)
  const [selectedText, setSelectedText] = useState('')
  const [selectionPage, setSelectionPage] = useState(0)

  const [aiMode, setAiMode] = useState<AiMode>(() => {
    const stored = localStorage.getItem('readloop-ai-mode')
    if (stored === 'concise' || stored === 'normal' || stored === 'verbose') return stored
    return 'normal'
  })
  const handleAiModeChange = useCallback((mode: AiMode) => {
    setAiMode(mode)
    localStorage.setItem('readloop-ai-mode', mode)
  }, [])

  // Guide mode
  const [guideEnabled, setGuideEnabled] = useState(false)
  const [guideContent, setGuideContent] = useState<string | null>(null)
  const [guideLoading, setGuideLoading] = useState(false)
  const [guideStreamingText, setGuideStreamingText] = useState('')

  // Conversation
  const [activeConversation, setActiveConversation] = useState<Message[] | null>(null)
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(null)

  // Paragraph & chapter tracking (used by guide mode + ask current page + wiki)
  const [currentChapter, setCurrentChapter] = useState('')
  const [currentParagraphs, setCurrentParagraphs] = useState<{ index: number; text: string }[]>([])
  const [currentParagraphIndex, setCurrentParagraphIndex] = useState(0)

  const [jumpToText, setJumpToText] = useState<string | null>(null)

  // Auto-clear jumpToText after it's consumed
  useEffect(() => {
    if (!jumpToText) return
    const timer = setTimeout(() => setJumpToText(null), 300)
    return () => clearTimeout(timer)
  }, [jumpToText])

  // Hooks
  const bookId = currentBook?.id ?? ''
  const { annotations, addAnnotation, updateAnnotation, deleteAnnotation } = useAnnotations(bookId)
  const { getCachedGuide, addGuide } = useGuideCache(bookId)
  const ai = useAi()

  const handleOpenBook = useCallback(async (id: string, fileData: ArrayBuffer) => {
    const db = await getStore()
    const book = await db.getBook(id)
    if (book) {
      setCurrentBook(book)
      if (!book.wikiReady) {
        // Check if wiki was already initialized externally (e.g. via CLI script)
        const slug = bookSlug(book.title, book.author)
        ;(async () => {
          try {
            const files = await listWikiFiles(slug)
            if (files.length > 0) {
              const updatedBook = { ...book, wikiSlug: slug, wikiReady: true, updatedAt: Date.now() }
              const freshDb = await getStore()
              await freshDb.updateBook(updatedBook)
              setCurrentBook(prev => prev ? { ...prev, wikiSlug: slug, wikiReady: true } : prev)
            } else {
              const chapters = await extractChaptersFromBook(book, fileData)
              if (chapters.length > 0) {
                const wikiSlug = await initWiki(book, chapters)
                setCurrentBook(prev => prev ? { ...prev, wikiSlug, wikiReady: true } : prev)
              }
            }
          } catch {
            // Proxy not running or wiki init failed — skip wiki
          }
        })()
      }
    }
    setPdfData(fileData)
    setView('reader')
  }, [])

  async function extractChaptersFromBook(book: Book, fileData: ArrayBuffer): Promise<ChapterText[]> {
    if (book.format !== 'epub') return []
    try {
      const ePubLib = await import('epubjs')
      const epubBook = ePubLib.default(fileData)
      await epubBook.ready
      const nav = await epubBook.loaded.navigation
      const spine = epubBook.spine as unknown as { items: Array<{ href: string; load: (resolver: unknown) => Promise<{ document: Document }> }> }
      const chapters: ChapterText[] = []
      let chapterIndex = 0
      for (const item of spine.items) {
        try {
          const section = await item.load(epubBook.load.bind(epubBook))
          const text = section.document.body?.textContent?.trim() ?? ''
          if (text.length < 50) continue
          const navItem = nav.toc.find(t => {
            const tocBase = t.href.split('#')[0]
            return item.href.endsWith(tocBase) || tocBase.endsWith(item.href)
          })
          const title = navItem?.label?.trim() ?? `Section ${chapterIndex + 1}`
          const slug = `${String(chapterIndex + 1).padStart(2, '0')}-${nodeSlug(title).slice(0, 50)}`
          chapters.push({ title, slug, text: text.slice(0, 8000) })
          chapterIndex++
        } catch {
          // Skip sections that fail to load
        }
      }
      epubBook.destroy()
      return chapters
    } catch (err) {
      console.error('Chapter extraction failed:', err)
      return []
    }
  }

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

  const handleAskCurrentPage = useCallback((query: string) => {
    if (!currentBook) return
    const pageText = currentParagraphs.map(p => p.text).join('\n')
    setSelectedText(pageText.slice(0, 500))
    setActiveConversation([])
    setActiveAnnotationId(null)

    const annotation: Annotation = {
      id: crypto.randomUUID(),
      bookId,
      anchor: createAnchor({
        chapter: '',
        paragraph: currentParagraphIndex,
        fullText: pageText,
        selectedText: pageText.slice(0, 200),
        selectionStart: 0,
      }),
      type: 'conversation',
      conversation: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    addAnnotation(annotation)
    setActiveAnnotationId(annotation.id)

    // Immediately send the query
    const userMsg: Message = { role: 'user', content: query, timestamp: Date.now() }
    setActiveConversation([userMsg])

    ai.askAi({
      bookTitle: currentBook.title,
      bookAuthor: currentBook.author,
      currentChapter: '',
      paragraphs: currentParagraphs.map(p => p.text),
      currentParagraphIndex,
      selectedText: pageText.slice(0, 500),
      userQuery: query,
      nearbyAnnotations: annotations,
      mode: aiMode,
    }).then(result => {
      const assistantMsg: Message = { role: 'assistant', content: result, timestamp: Date.now() }
      setActiveConversation(prev => {
        const updated = prev ? [...prev, assistantMsg] : [assistantMsg]
        const ann = annotations.find(a => a.id === annotation.id) ?? annotation
        updateAnnotation({ ...ann, conversation: updated, updatedAt: Date.now() })
        return updated
      })
    }).catch(() => {})
  }, [currentBook, currentParagraphs, currentParagraphIndex, bookId, annotations, addAnnotation, ai, updateAnnotation, aiMode])

  const handleScreenshot = useCallback((imageDataUrl: string, bbox: ScreenshotBbox) => {
    if (!currentBook) return

    const regionDesc = `[Screenshot from page ${bbox.page}, region: ${bbox.x},${bbox.y},${bbox.width}×${bbox.height}]`
    const userMsg: Message = {
      role: 'user',
      content: `Please analyze this section of the page.\n${regionDesc}`,
      timestamp: Date.now(),
    }

    const annotation: Annotation = {
      id: crypto.randomUUID(),
      bookId,
      anchor: {
        chapter: '',
        paragraph: 0,
        textPrefix: '',
        selectedText: regionDesc,
        textSuffix: '',
        pageHint: bbox.page,
        bbox: { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height },
      },
      type: 'conversation',
      noteText: imageDataUrl,
      conversation: [userMsg],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    addAnnotation(annotation)
    setActiveAnnotationId(annotation.id)
    setSelectedText(regionDesc)
    setActiveConversation([userMsg])

    const systemPrompt = screenshotSystemPrompt(currentBook.title)
    ai.askWithImage(systemPrompt, `Please analyze this section of the page. ${regionDesc}`, imageDataUrl).then(result => {
      const assistantMsg: Message = { role: 'assistant', content: result, timestamp: Date.now() }
      setActiveConversation(prev => {
        const updated = prev ? [...prev, assistantMsg] : [assistantMsg]
        updateAnnotation({ ...annotation, conversation: updated, updatedAt: Date.now() })
        return updated
      })
    }).catch(() => {})
  }, [currentBook, bookId, currentParagraphs, currentParagraphIndex, annotations, addAnnotation, ai, updateAnnotation])

  const handleSendMessage = useCallback(async (query: string) => {
    if (!currentBook) return

    const userMsg: Message = { role: 'user', content: query, timestamp: Date.now() }
    setActiveConversation(prev => prev ? [...prev, userMsg] : [userMsg])

    let wikiContext: string | undefined
    if (currentBook.wikiReady && currentBook.wikiSlug) {
      try {
        const chapterSlug = currentChapter ? nodeSlug(currentChapter) : ''
        const concepts = await readChapterConcepts(currentBook.wikiSlug, chapterSlug)
        wikiContext = buildWikiContextBlock(concepts)
      } catch {
        // Wiki read failed — continue without wiki context
      }
    }

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
        mode: aiMode,
        wikiContext,
        conversationHistory: activeConversation ?? [],
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

        if (currentBook.wikiReady && currentBook.wikiSlug) {
          const chSlug = currentChapter ? nodeSlug(currentChapter) : ''
          updateWiki(currentBook, updated, currentChapter, chSlug).catch(err =>
            console.error('Wiki update failed:', err)
          )
        }

        return updated
      })
    } catch {
      // error is handled by useAi hook
    }
  }, [currentBook, selectedText, annotations, activeAnnotationId, ai, updateAnnotation, aiMode, currentChapter, activeConversation])

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
    if (ann.anchor.selectedText) {
      setJumpToText(ann.anchor.selectedText)
    }
  }, [])

  const handleDeleteConversation = useCallback(() => {
    if (activeAnnotationId) {
      deleteAnnotation(activeAnnotationId)
    }
    setActiveConversation(null)
    setActiveAnnotationId(null)
  }, [activeAnnotationId, deleteAnnotation])

  const handleParagraphsReady = useCallback((paragraphs: { index: number; text: string }[], _page: number, chapter?: string) => {
    setCurrentParagraphs(paragraphs)
    setCurrentParagraphIndex(0)
    if (chapter !== undefined) setCurrentChapter(prev => prev === chapter ? prev : chapter)
  }, [])

  // Trigger guide when enabled and paragraphs change
  useEffect(() => {
    if (!guideEnabled || !currentBook || currentParagraphs.length === 0) return

    const paragraph = currentParagraphs[currentParagraphIndex]
    if (!paragraph) return

    const cached = getCachedGuide('', currentParagraphIndex)
    if (cached) {
      setGuideContent(cached.guideContent)
      return
    }

    setGuideLoading(true)
    setGuideStreamingText('')

    ai.getGuide({
      bookTitle: currentBook.title,
      bookAuthor: currentBook.author,
      currentChapter: '',
      paragraphs: currentParagraphs.map(p => p.text),
      currentParagraphIndex,
      recentGuideSummaries: [],
    }).then(result => {
      setGuideContent(result)
      setGuideLoading(false)
      addGuide({
        id: crypto.randomUUID(),
        bookId,
        anchor: { chapter: '', paragraph: currentParagraphIndex, textPrefix: '', selectedText: '', textSuffix: '' },
        guideContent: result,
        model: loadSettings().model,
        createdAt: Date.now(),
      })
    }).catch(() => {
      setGuideLoading(false)
    })
  }, [guideEnabled, currentParagraphIndex, currentBook, currentParagraphs, getCachedGuide, ai, addGuide, bookId])

  const handleExport = useCallback(async () => {
    const db = await getStore()
    const data = await db.exportAll()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `readloop-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  return (
    <AnimatePresence mode="wait">
      {view === 'bookshelf' ? (
        <motion.div
          key="bookshelf"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="h-screen"
        >
          <Bookshelf onOpenBook={handleOpenBook} onOpenSettings={() => setSettingsOpen(true)} />
          <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} onSave={() => {}} />
        </motion.div>
      ) : (
        <motion.div
          key="reader"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="h-screen flex flex-col"
        >
          <Toolbar
            guideEnabled={guideEnabled}
            onToggleGuide={() => setGuideEnabled(prev => !prev)}
            aiMode={aiMode}
            onAiModeChange={handleAiModeChange}
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
              {pdfData && currentBook?.format === 'epub' ? (
                <EpubViewer
                  fileData={pdfData}
                  annotations={annotations}
                  jumpToText={jumpToText}
                  onTextSelect={handleTextSelect}
                  onAnnotationClick={handleAnnotationSelect}
                  onParagraphsReady={handleParagraphsReady}
                />
              ) : pdfData ? (
                <PdfViewer
                  fileData={pdfData}
                  annotations={annotations}
                  onTextSelect={handleTextSelect}
                  onAnnotationClick={handleAnnotationSelect}
                  onParagraphsReady={handleParagraphsReady}
                  onScreenshot={handleScreenshot}
                />
              ) : null}
              <SelectionMenu
                position={selectionMenuPos}
                onAskAi={handleAskAi}
                onHighlight={handleHighlight}
                onNote={handleNote}
                onDismiss={() => setSelectionMenuPos(null)}
              />
            </div>
            <div
              className="w-80"
              style={{
                borderLeft: '1px solid var(--border)',
                background: 'var(--bg-paper)',
              }}
            >
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
                onDeleteConversation={handleDeleteConversation}
                onAskCurrentPage={handleAskCurrentPage}
              />
            </div>
          </div>
          <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} onSave={() => {}} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
