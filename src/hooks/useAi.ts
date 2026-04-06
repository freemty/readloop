import { useState, useCallback, useRef } from 'react'
import { createAiClient } from '../ai/client'
import { buildAskContext, buildGuideContext } from '../ai/context'
import { loadSettings } from '../settings/SettingsModal'
import type { Annotation } from '../types'

interface UseAiReturn {
  isLoading: boolean
  streamingText: string
  error: string | null
  askAi: (params: AskParams) => Promise<string>
  getGuide: (params: GuideParams) => Promise<string>
  cancelStream: () => void
}

interface AskParams {
  bookTitle: string
  bookAuthor: string
  currentChapter: string
  paragraphs: string[]
  currentParagraphIndex: number
  selectedText: string
  userQuery: string
  nearbyAnnotations: Annotation[]
}

interface GuideParams {
  bookTitle: string
  bookAuthor: string
  currentChapter: string
  paragraphs: string[]
  currentParagraphIndex: number
  recentGuideSummaries: string[]
}

export function useAi(): UseAiReturn {
  const [isLoading, setIsLoading] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef(false)

  const callAi = useCallback(async (
    systemPrompt: string,
    userPrompt: string,
  ): Promise<string> => {
    const settings = loadSettings()
    if (settings.provider !== 'bedrock' && !settings.apiKey) {
      throw new Error('Please configure your API key in Settings')
    }

    const client = createAiClient({
      provider: settings.provider,
      apiKey: settings.apiKey,
      model: settings.model,
      baseUrl: settings.baseUrl,
    })

    abortRef.current = false
    setIsLoading(true)
    setStreamingText('')
    setError(null)

    try {
      const result = await client.chat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        (chunk) => {
          if (!abortRef.current) {
            setStreamingText(prev => prev + chunk)
          }
        },
      )
      return result
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI request failed'
      setError(msg)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const askAi = useCallback(async (params: AskParams): Promise<string> => {
    const { systemPrompt, userPrompt } = buildAskContext(params)
    return callAi(systemPrompt, userPrompt)
  }, [callAi])

  const getGuide = useCallback(async (params: GuideParams): Promise<string> => {
    const { systemPrompt, userPrompt } = buildGuideContext(params)
    return callAi(systemPrompt, userPrompt)
  }, [callAi])

  const cancelStream = useCallback(() => {
    abortRef.current = true
    setIsLoading(false)
  }, [])

  return { isLoading, streamingText, error, askAi, getGuide, cancelStream }
}
