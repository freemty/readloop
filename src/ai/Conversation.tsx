import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Send, X, Trash2, User, Sparkles, AlertCircle } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import type { Message } from '../types'

interface ConversationProps {
  messages: Message[]
  isLoading: boolean
  streamingText: string
  error: string | null
  onSend: (query: string) => void
  onClose: () => void
  onDelete?: () => void
}

export function Conversation({ messages, isLoading, streamingText, error, onSend, onClose, onDelete }: ConversationProps) {
  const [input, setInput] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    onSend(input.trim())
    setInput('')
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-paper)',
        }}
      >
        <div className="flex items-center gap-1.5">
          <Sparkles size={13} style={{ color: 'var(--accent)' }} strokeWidth={2} />
          <h3
            className="text-xs font-semibold tracking-wide"
            style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)' }}
          >
            Conversation
          </h3>
        </div>
        <div className="flex items-center gap-1">
          {onDelete && (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={onDelete}
              className="flex items-center justify-center rounded"
              style={{
                color: 'var(--text-muted)',
                width: '1.5rem',
                height: '1.5rem',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
              title="Delete conversation"
            >
              <Trash2 size={13} strokeWidth={2} />
            </motion.button>
          )}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClose}
            className="flex items-center justify-center rounded"
            style={{
              color: 'var(--text-muted)',
              width: '1.5rem',
              height: '1.5rem',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <X size={13} strokeWidth={2} />
          </motion.button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className="flex items-center gap-1"
                style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}
              >
                {msg.role === 'user' ? (
                  <>
                    <span style={{ fontFamily: 'var(--font-ui)' }}>You</span>
                    <User size={10} strokeWidth={2} />
                  </>
                ) : (
                  <>
                    <Sparkles size={10} strokeWidth={2} />
                    <span style={{ fontFamily: 'var(--font-ui)' }}>AI</span>
                  </>
                )}
              </div>
              <div
                className="rounded-lg px-3 py-2"
                style={{
                  maxWidth: '85%',
                  fontSize: '0.85rem',
                  lineHeight: 1.65,
                  fontFamily: msg.role === 'user' ? 'var(--font-ui)' : 'var(--font-serif)',
                  ...(msg.role === 'user'
                    ? {
                        background: 'var(--accent-light)',
                        color: 'var(--text-primary)',
                        borderRadius: 'var(--radius-lg)',
                        whiteSpace: 'pre-wrap' as const,
                      }
                    : {
                        background: 'var(--bg-card)',
                        color: 'var(--text-primary)',
                        boxShadow: 'var(--shadow-1)',
                        borderRadius: 'var(--radius-lg)',
                      }),
                }}
              >
                {msg.role === 'user' ? msg.content : (
                  <div className="prose prose-sm max-w-none" style={{ fontSize: 'inherit', lineHeight: 'inherit', fontFamily: 'inherit' }}>
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                )}
              </div>
            </motion.div>
          ))}

          {/* Streaming AI message */}
          {isLoading && streamingText && (
            <motion.div
              key="streaming"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-1 items-start"
            >
              <div
                className="flex items-center gap-1"
                style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}
              >
                <motion.span
                  animate={{ opacity: [1, 0.4, 1] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <Sparkles size={10} strokeWidth={2} />
                </motion.span>
                <span style={{ fontFamily: 'var(--font-ui)' }}>AI</span>
              </div>
              <div
                className="rounded-lg px-3 py-2"
                style={{
                  maxWidth: '85%',
                  fontSize: '0.85rem',
                  lineHeight: 1.65,
                  fontFamily: 'var(--font-serif)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  boxShadow: 'var(--shadow-1)',
                  borderRadius: 'var(--radius-lg)',
                }}
              >
                <div className="prose prose-sm max-w-none" style={{ fontSize: 'inherit', lineHeight: 'inherit', fontFamily: 'inherit' }}>
                  <ReactMarkdown>{streamingText}</ReactMarkdown>
                </div>
                <motion.span
                  animate={{ opacity: [1, 0.2, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
                  style={{
                    display: 'inline-block',
                    width: '5px',
                    height: '5px',
                    borderRadius: '50%',
                    background: 'var(--accent)',
                    marginLeft: '3px',
                    verticalAlign: 'middle',
                  }}
                />
              </div>
            </motion.div>
          )}

          {/* Error */}
          {error && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-start gap-2 rounded-lg px-3 py-2.5"
              style={{
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                color: '#B91C1C',
                fontSize: '0.8rem',
                borderRadius: 'var(--radius)',
              }}
            >
              <AlertCircle size={14} strokeWidth={2} style={{ marginTop: '1px', flexShrink: 0 }} />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input area */}
      <form
        onSubmit={handleSubmit}
        className="p-3"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <div
          className="flex gap-2 items-end rounded-lg px-3 py-2"
          style={{
            border: '1px solid var(--border)',
            background: 'var(--bg-card)',
            transition: 'border-color 0.15s',
          }}
        >
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit(e as any)
              }
            }}
            placeholder="Ask a question..."
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
            disabled={isLoading}
          />
          <motion.button
            type="submit"
            disabled={isLoading || !input.trim()}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center justify-center rounded"
            style={{
              width: '2rem',
              height: '2rem',
              background: isLoading || !input.trim() ? 'var(--border)' : 'var(--accent)',
              color: isLoading || !input.trim() ? 'var(--text-muted)' : '#fff',
              border: 'none',
              cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer',
              flexShrink: 0,
              borderRadius: 'var(--radius-sm)',
              transition: 'background 0.15s',
            }}
          >
            <Send size={13} strokeWidth={2} />
          </motion.button>
        </div>
      </form>
    </div>
  )
}
