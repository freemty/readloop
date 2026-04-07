import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BookOpen, Send } from 'lucide-react'
import { GuideCard } from './GuideCard'
import { Conversation } from './Conversation'
import type { Message } from '../types'

interface AiPanelProps {
  guideEnabled: boolean
  guideContent: string | null
  guideLoading: boolean
  guideStreamingText: string
  onDismissGuide: () => void

  activeConversation: Message[] | null
  conversationLoading: boolean
  conversationStreamingText: string
  conversationError: string | null
  onSendMessage: (query: string) => void
  onCloseConversation: () => void
  onAskCurrentPage?: (query: string) => void
}

export function AiPanel({
  guideEnabled,
  guideContent,
  guideLoading,
  guideStreamingText,
  onDismissGuide,
  activeConversation,
  conversationLoading,
  conversationStreamingText,
  conversationError,
  onSendMessage,
  onCloseConversation,
  onAskCurrentPage,
}: AiPanelProps) {
  const [quickInput, setQuickInput] = useState('')
  const hasContent = guideEnabled || activeConversation

  const handleQuickAsk = (e: React.FormEvent) => {
    e.preventDefault()
    if (!quickInput.trim()) return
    if (activeConversation) {
      onSendMessage(quickInput.trim())
    } else {
      onAskCurrentPage?.(quickInput.trim())
    }
    setQuickInput('')
  }

  return (
    <div
      className="h-full flex flex-col overflow-hidden"
      style={{ background: 'var(--bg-paper)' }}
    >
      {/* Main content area */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <AnimatePresence mode="wait">
          {!hasContent ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center"
            >
              <BookOpen
                size={32}
                style={{ color: 'var(--text-muted)' }}
                strokeWidth={1.5}
              />
              <p
                style={{
                  fontFamily: 'var(--font-serif)',
                  color: 'var(--text-muted)',
                  fontSize: '0.9rem',
                  lineHeight: 1.7,
                  maxWidth: '18rem',
                }}
              >
                Ask anything about the current page, or select text for precise questions.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              {guideEnabled && (
                <div
                  className="px-4 pt-4 pb-3"
                  style={{ borderLeft: '2px solid var(--accent-light)' }}
                >
                  <GuideCard
                    content={guideContent}
                    isLoading={guideLoading}
                    streamingText={guideStreamingText}
                    onDismiss={onDismissGuide}
                  />
                </div>
              )}

              {activeConversation && (
                <div className="flex-1 min-h-0">
                  <Conversation
                    messages={activeConversation}
                    isLoading={conversationLoading}
                    streamingText={conversationStreamingText}
                    error={conversationError}
                    onSend={onSendMessage}
                    onClose={onCloseConversation}
                  />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Always-visible quick input */}
      {!activeConversation && (
        <form
          onSubmit={handleQuickAsk}
          className="p-3"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <div
            className="flex gap-2 items-end rounded-lg px-3 py-2"
            style={{
              border: '1px solid var(--border)',
              background: 'var(--bg-card)',
            }}
          >
            <textarea
              value={quickInput}
              onChange={e => setQuickInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleQuickAsk(e as unknown as React.FormEvent)
                }
              }}
              placeholder="Ask about this page..."
              rows={1}
              className="flex-1 bg-transparent resize-none outline-none"
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '0.85rem',
                color: 'var(--text-primary)',
                lineHeight: 1.5,
                maxHeight: '5rem',
                overflowY: 'auto',
              }}
            />
            <motion.button
              type="submit"
              disabled={!quickInput.trim()}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center justify-center rounded"
              style={{
                width: '2rem',
                height: '2rem',
                background: !quickInput.trim() ? 'var(--border)' : 'var(--accent)',
                color: !quickInput.trim() ? 'var(--text-muted)' : '#fff',
                border: 'none',
                cursor: !quickInput.trim() ? 'not-allowed' : 'pointer',
                flexShrink: 0,
                borderRadius: 'var(--radius-sm)',
                transition: 'background 0.15s',
              }}
            >
              <Send size={13} strokeWidth={2} />
            </motion.button>
          </div>
        </form>
      )}
    </div>
  )
}
