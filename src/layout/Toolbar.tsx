import { FileDown, Settings, BookOpen, Brain, HelpCircle, Lightbulb } from 'lucide-react'
import type { AiMode } from '../ai/prompts'

const AI_MODES: { value: AiMode; label: string; icon: typeof Brain }[] = [
  { value: 'intellectual', label: 'Intellectual', icon: Brain },
  { value: 'socratic', label: 'Socratic', icon: HelpCircle },
  { value: 'eli5', label: 'ELI5', icon: Lightbulb },
]

interface ToolbarProps {
  guideEnabled: boolean
  onToggleGuide: () => void
  aiMode: AiMode
  onAiModeChange: (mode: AiMode) => void
  onExport: () => void
  onOpenSettings: () => void
}

export function Toolbar({ guideEnabled, onToggleGuide, aiMode, onAiModeChange, onExport, onOpenSettings }: ToolbarProps) {
  return (
    <div
      className="flex items-center justify-between px-3 py-3"
      style={{
        background: 'var(--bg-card)',
        boxShadow: 'var(--shadow-1)',
        fontFamily: 'var(--font-ui)',
      }}
    >
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleGuide}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors"
          style={
            guideEnabled
              ? {
                  background: 'var(--accent)',
                  color: '#fff',
                  border: 'none',
                }
              : {
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                }
          }
        >
          <BookOpen size={14} />
          <span>{guideEnabled ? 'Guide ON' : 'Guide OFF'}</span>
        </button>

        {/* AI Mode selector */}
        <div
          className="flex items-center rounded overflow-hidden"
          style={{ border: '1px solid var(--border)', marginLeft: '0.5rem' }}
        >
          {AI_MODES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => onAiModeChange(value)}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs transition-colors"
              style={
                aiMode === value
                  ? { background: 'var(--accent)', color: '#fff', border: 'none' }
                  : { background: 'transparent', color: 'var(--text-secondary)', border: 'none' }
              }
            >
              <Icon size={12} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          onClick={onExport}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors"
          style={{
            background: 'transparent',
            color: 'var(--text-secondary)',
            border: 'none',
          }}
          onMouseEnter={e => {
            ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-paper)'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'
          }}
          onMouseLeave={e => {
            ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'
          }}
        >
          <FileDown size={15} />
          <span>Export</span>
        </button>

        <button
          onClick={onOpenSettings}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors"
          style={{
            background: 'transparent',
            color: 'var(--text-secondary)',
            border: 'none',
          }}
          onMouseEnter={e => {
            ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-paper)'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'
          }}
          onMouseLeave={e => {
            ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'
          }}
        >
          <Settings size={15} />
          <span>Settings</span>
        </button>
      </div>
    </div>
  )
}
