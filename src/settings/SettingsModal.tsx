import { useState, useEffect } from 'react'
import type { AiProvider } from '../ai/client'

interface Settings {
  provider: AiProvider
  apiKey: string
  model: string
  baseUrl: string
}

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (settings: Settings) => void
}

const PRESETS: Record<string, { provider: AiProvider; baseUrl: string; model: string; apiKey?: string }> = {
  yunstorm: {
    provider: 'openai',
    baseUrl: 'https://dl.yunstorm.com/v1',
    model: 'claude-sonnet-4',
    apiKey: 'REDACTED_KEY',
  },
  openai: {
    provider: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o',
  },
  claude: {
    provider: 'claude',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-sonnet-4-5-20250514',
  },
}

function loadSettings(): Settings {
  const raw = localStorage.getItem('readloop-settings')
  if (!raw) return { ...PRESETS.yunstorm, apiKey: PRESETS.yunstorm.apiKey ?? '' }
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

  const handlePreset = (name: string) => {
    const preset = PRESETS[name]
    if (!preset) return
    setSettings(prev => ({
      ...prev,
      provider: preset.provider,
      baseUrl: preset.baseUrl,
      model: preset.model,
      apiKey: preset.apiKey ?? prev.apiKey,
    }))
  }

  const handleSave = () => {
    saveSettings(settings)
    onSave(settings)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-[28rem] shadow-xl">
        <h2 className="text-lg font-semibold mb-4">Settings</h2>

        <label className="block text-sm font-medium mb-1">Quick Preset</label>
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => handlePreset('yunstorm')}
            className="px-3 py-1.5 text-xs border rounded hover:bg-blue-50 border-blue-300 text-blue-700"
          >
            Yunstorm (Azure)
          </button>
          <button
            onClick={() => handlePreset('openai')}
            className="px-3 py-1.5 text-xs border rounded hover:bg-gray-50"
          >
            OpenAI
          </button>
          <button
            onClick={() => handlePreset('claude')}
            className="px-3 py-1.5 text-xs border rounded hover:bg-gray-50"
          >
            Claude Direct
          </button>
        </div>

        <label className="block text-sm font-medium mb-1">Provider</label>
        <select
          value={settings.provider}
          onChange={e => setSettings(prev => ({ ...prev, provider: e.target.value as AiProvider }))}
          className="w-full border rounded px-3 py-2 mb-3"
        >
          <option value="openai">OpenAI Compatible</option>
          <option value="claude">Claude Direct</option>
        </select>

        <label className="block text-sm font-medium mb-1">Base URL</label>
        <input
          value={settings.baseUrl}
          onChange={e => setSettings(prev => ({ ...prev, baseUrl: e.target.value }))}
          placeholder="https://api.openai.com/v1"
          className="w-full border rounded px-3 py-2 mb-3 text-sm"
        />

        <label className="block text-sm font-medium mb-1">API Key</label>
        <input
          type="password"
          value={settings.apiKey}
          onChange={e => setSettings(prev => ({ ...prev, apiKey: e.target.value }))}
          placeholder="sk-... or api key"
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
