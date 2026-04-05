import { useState } from 'react'
import type { Message } from '../types'

interface ConversationProps {
  messages: Message[]
  isLoading: boolean
  streamingText: string
  error: string | null
  onSend: (query: string) => void
  onClose: () => void
}

export function Conversation({ messages, isLoading, streamingText, error, onSend, onClose }: ConversationProps) {
  const [input, setInput] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    onSend(input.trim())
    setInput('')
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <h3 className="text-sm font-semibold">Conversation</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-sm">
          Close
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`text-sm ${msg.role === 'user' ? 'text-blue-800' : 'text-gray-700'}`}>
            <span className="font-medium">{msg.role === 'user' ? 'You' : 'AI'}:</span>
            <div className="mt-1 whitespace-pre-wrap">{msg.content}</div>
          </div>
        ))}
        {isLoading && streamingText && (
          <div className="text-sm text-gray-700">
            <span className="font-medium">AI:</span>
            <div className="mt-1 whitespace-pre-wrap">
              {streamingText}<span className="animate-pulse">|</span>
            </div>
          </div>
        )}
        {error && (
          <div className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-3 border-t">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask a question..."
            className="flex-1 border rounded px-3 py-2 text-sm"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  )
}
