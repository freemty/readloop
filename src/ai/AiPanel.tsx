import { AnimatePresence, motion } from 'framer-motion'
import { BookOpen } from 'lucide-react'
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
}: AiPanelProps) {
  const hasContent = guideEnabled || activeConversation

  return (
    <div
      className="h-full flex flex-col overflow-hidden"
      style={{ background: 'var(--bg-paper)' }}
    >
      <AnimatePresence mode="wait">
        {!hasContent ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="h-full flex flex-col items-center justify-center gap-3 p-8 text-center"
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
              Select text and click &quot;Ask AI&quot; to start a conversation, or enable Guide mode from the toolbar.
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="h-full flex flex-col overflow-hidden"
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
  )
}
