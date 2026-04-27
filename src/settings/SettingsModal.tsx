import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Settings as SettingsIcon, X } from 'lucide-react'
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
  siliconflow: {
    provider: 'openai',
    baseUrl: 'https://api.siliconflow.cn/v1',
    model: 'claude-sonnet-4',
    apiKey: import.meta.env.VITE_SILICONFLOW_API_KEY ?? '',
  },
  bedrock: {
    provider: 'bedrock',
    baseUrl: 'http://localhost:3001/api/bedrock/chat',
    model: 'arn:aws:bedrock:us-east-2:533595510084:inference-profile/us.anthropic.claude-sonnet-4-6',
    apiKey: 'bedrock',
  },
  yunstorm: {
    provider: 'openai',
    baseUrl: 'https://dl.yunstorm.com/v1',
    model: 'gpt-4.1',
    apiKey: import.meta.env.VITE_YUNSTORM_API_KEY ?? '',
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
  if (!raw) return { ...PRESETS.bedrock, apiKey: PRESETS.bedrock.apiKey ?? '' }
  return JSON.parse(raw) as Settings
}

function saveSettings(settings: Settings): void {
  localStorage.setItem('readloop-settings', JSON.stringify(settings))
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  padding: '0.5rem 0.75rem',
  fontSize: '0.875rem',
  fontFamily: 'var(--font-ui)',
  color: 'var(--text-primary)',
  background: 'var(--bg-card)',
  outline: 'none',
  transition: 'border-color 0.15s, box-shadow 0.15s',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.75rem',
  fontFamily: 'var(--font-ui)',
  color: 'var(--text-secondary)',
  marginBottom: '0.375rem',
  fontWeight: 500,
}

export function SettingsModal({ isOpen, onClose, onSave }: SettingsModalProps) {
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const [focusedField, setFocusedField] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) setSettings(loadSettings())
  }, [isOpen])

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

  const activePreset = Object.entries(PRESETS).find(
    ([, p]) => p.baseUrl === settings.baseUrl && p.model === settings.model
  )?.[0] ?? null

  const focusedInputStyle = (field: string): React.CSSProperties => ({
    ...inputStyle,
    borderColor: focusedField === field ? 'var(--accent)' : 'var(--border)',
    boxShadow: focusedField === field ? '0 0 0 2px color-mix(in srgb, var(--accent) 20%, transparent)' : 'none',
  })

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50"
            style={{ background: 'rgba(0,0,0,0.45)' }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
          >
            <div
              className="pointer-events-auto w-[30rem]"
              style={{
                background: 'var(--bg-card)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-3)',
                padding: '1.75rem',
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <SettingsIcon size={16} style={{ color: 'var(--accent)' }} strokeWidth={2} />
                  <h2
                    style={{
                      fontSize: '1rem',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-ui)',
                      margin: 0,
                    }}
                  >
                    Settings
                  </h2>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onClose}
                  style={{
                    width: '1.75rem',
                    height: '1.75rem',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  <X size={14} strokeWidth={2} />
                </motion.button>
              </div>

              {/* Presets */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={labelStyle}>Quick Preset</label>
                <div className="flex gap-2 flex-wrap">
                  {Object.keys(PRESETS).map(name => {
                    const isActive = activePreset === name
                    return (
                      <motion.button
                        key={name}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => handlePreset(name)}
                        style={{
                          padding: '0.3rem 0.875rem',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          fontFamily: 'var(--font-ui)',
                          fontWeight: 500,
                          border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                          background: isActive ? 'var(--accent)' : 'transparent',
                          color: isActive ? '#fff' : 'var(--text-secondary)',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}
                      >
                        {name === 'siliconflow' ? 'SiliconFlow'
                          : name === 'bedrock' ? 'Bedrock Claude'
                          : name === 'yunstorm' ? 'Yunstorm'
                          : name === 'openai' ? 'OpenAI'
                          : 'Claude Direct'}
                      </motion.button>
                    )
                  })}
                </div>
              </div>

              {/* Provider */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>Provider</label>
                <select
                  value={settings.provider}
                  onChange={e => setSettings(prev => ({ ...prev, provider: e.target.value as AiProvider }))}
                  style={focusedInputStyle('provider')}
                  onFocus={() => setFocusedField('provider')}
                  onBlur={() => setFocusedField(null)}
                >
                  <option value="bedrock">AWS Bedrock (via proxy)</option>
                  <option value="openai">OpenAI Compatible</option>
                  <option value="claude">Claude Direct</option>
                </select>
              </div>

              {/* Base URL */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>Base URL</label>
                <input
                  value={settings.baseUrl}
                  onChange={e => setSettings(prev => ({ ...prev, baseUrl: e.target.value }))}
                  placeholder="https://api.openai.com/v1"
                  style={focusedInputStyle('baseUrl')}
                  onFocus={() => setFocusedField('baseUrl')}
                  onBlur={() => setFocusedField(null)}
                />
              </div>

              {/* API Key */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>API Key</label>
                <input
                  type="password"
                  value={settings.apiKey}
                  onChange={e => setSettings(prev => ({ ...prev, apiKey: e.target.value }))}
                  placeholder="sk-... or api key"
                  style={focusedInputStyle('apiKey')}
                  onFocus={() => setFocusedField('apiKey')}
                  onBlur={() => setFocusedField(null)}
                />
              </div>

              {/* Model */}
              <div style={{ marginBottom: '1.75rem' }}>
                <label style={labelStyle}>Model</label>
                <input
                  value={settings.model}
                  onChange={e => setSettings(prev => ({ ...prev, model: e.target.value }))}
                  style={focusedInputStyle('model')}
                  onFocus={() => setFocusedField('model')}
                  onBlur={() => setFocusedField(null)}
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={onClose}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: 'var(--radius)',
                    fontSize: '0.875rem',
                    fontFamily: 'var(--font-ui)',
                    color: 'var(--text-secondary)',
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleSave}
                  style={{
                    padding: '0.5rem 1.25rem',
                    borderRadius: 'var(--radius)',
                    fontSize: '0.875rem',
                    fontFamily: 'var(--font-ui)',
                    fontWeight: 500,
                    color: '#fff',
                    background: 'var(--accent)',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'opacity 0.15s',
                  }}
                >
                  Save
                </motion.button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export { loadSettings, type Settings }
