import { FileDown, Settings, BookOpen } from 'lucide-react'

interface ToolbarProps {
  guideEnabled: boolean
  onToggleGuide: () => void
  onExport: () => void
  onOpenSettings: () => void
}

export function Toolbar({ guideEnabled, onToggleGuide, onExport, onOpenSettings }: ToolbarProps) {
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
