interface ToolbarProps {
  guideEnabled: boolean
  onToggleGuide: () => void
  onExport: () => void
  onOpenSettings: () => void
}

export function Toolbar({ guideEnabled, onToggleGuide, onExport, onOpenSettings }: ToolbarProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2 border-b bg-white">
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleGuide}
          className={`px-3 py-1.5 rounded text-sm ${
            guideEnabled
              ? 'bg-amber-100 text-amber-800 border border-amber-300'
              : 'hover:bg-gray-100 border border-gray-200'
          }`}
        >
          {guideEnabled ? 'Guide ON' : 'Guide OFF'}
        </button>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onExport}
          className="px-3 py-1.5 rounded text-sm hover:bg-gray-100 border border-gray-200"
        >
          Export JSON
        </button>
        <button
          onClick={onOpenSettings}
          className="px-3 py-1.5 rounded text-sm hover:bg-gray-100 border border-gray-200"
        >
          Settings
        </button>
      </div>
    </div>
  )
}
