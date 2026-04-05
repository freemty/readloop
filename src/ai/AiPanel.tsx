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

  if (!hasContent) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm p-4 text-center">
        Select text and click &quot;Ask AI&quot; to start a conversation, or enable Guide mode from the toolbar.
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {guideEnabled && (
        <div className="p-4 border-b">
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
    </div>
  )
}
