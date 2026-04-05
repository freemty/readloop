import { useState, useEffect } from 'react'
import type { AiProvider } from '../ai/client'

interface Settings {
  provider: AiProvider
  apiKey: string
  model: string
}

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (settings: Settings) => void
}

const DEFAULT_MODELS: Record<AiProvider, string> = {
  openai: 'gpt-4o',
  claude: 'claude-sonnet-4-5-20250514',
}

function loadSettings(): Settings {
  const raw = localStorage.getItem('readloop-settings')
  if (!raw) return { provider: 'openai', apiKey: '', model: DEFAULT_MODELS.openai }
  return JSON.parse(raw) as Settings
}

function saveSettings(settings: Settings): void {
  localStorage.setItem('readloop-settings', JSON.stringify(settings))
}

export function SettingsModal({ isOpen, onClose, onSave }: SettingsModalProps) {
  const [settings, setSettings] = useState<Settings>(loadSettings)

  useEffect(() => {
    if (isOpen) setSettings(loadSettings())
  }, [isOpen])

  if (!isOpen) return null

  const handleProviderChange = (provider: AiProvider) => {
    setSettings(prev => ({
      ...prev,
      provider,
      model: DEFAULT_MODELS[provider],
    }))
  }

  const handleSave = () => {
    saveSettings(settings)
    onSave(settings)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 shadow-xl">
        <h2 className="text-lg font-semibold mb-4">Settings</h2>

        <label className="block text-sm font-medium mb-1">Provider</label>
        <select
          value={settings.provider}
          onChange={e => handleProviderChange(e.target.value as AiProvider)}
          className="w-full border rounded px-3 py-2 mb-3"
        >
          <option value="openai">OpenAI</option>
          <option value="claude">Claude</option>
        </select>

        <label className="block text-sm font-medium mb-1">API Key</label>
        <input
          type="password"
          value={settings.apiKey}
          onChange={e => setSettings(prev => ({ ...prev, apiKey: e.target.value }))}
          placeholder="sk-... or sk-ant-..."
          className="w-full border rounded px-3 py-2 mb-3"
        />

        <label className="block text-sm font-medium mb-1">Model</label>
        <input
          value={settings.model}
          onChange={e => setSettings(prev => ({ ...prev, model: e.target.value }))}
          className="w-full border rounded px-3 py-2 mb-4"
        />

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">
            Cancel
          </button>
          <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

export { loadSettings, type Settings }
