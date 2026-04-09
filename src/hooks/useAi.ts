import { useState, useCallback, useRef } from 'react'
import { createAiClient, type ChatMessage } from '../ai/client'
import { buildAskContext, buildGuideContext } from '../ai/context'
import { loadSettings } from '../settings/SettingsModal'
import type { AiMode } from '../ai/prompts'
import type { Annotation, Message } from '../types'

interface UseAiReturn {
  isLoading: boolean
  streamingText: string
  error: string | null
  askAi: (params: AskParams) => Promise<string>
  askWithImage: (systemPrompt: string, userText: string, imageDataUrl: string) => Promise<string>
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
  mode?: AiMode
  wikiContext?: string
  conversationHistory?: Message[]
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
    messages: ChatMessage[],
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
        messages,
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
    const context = buildAskContext(params)
    return callAi(context.messages as ChatMessage[])
  }, [callAi])

  const askWithImage = useCallback(async (systemPrompt: string, userText: string, imageDataUrl: string): Promise<string> => {
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

    // Extract base64 data from data URL
    const base64Match = imageDataUrl.match(/^data:([^;]+);base64,(.+)$/)
    const mediaType = base64Match?.[1] || 'image/png'
    const base64Data = base64Match?.[2] || ''

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
          { type: 'text', text: userText },
        ],
      },
    ]

    abortRef.current = false
    setIsLoading(true)
    setStreamingText('')
    setError(null)

    try {
      const result = await client.chat(messages, (chunk) => {
        if (!abortRef.current) setStreamingText(prev => prev + chunk)
      })
      return result
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI request failed'
      setError(msg)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const getGuide = useCallback(async (params: GuideParams): Promise<string> => {
    const context = buildGuideContext(params)
    return callAi(context.messages as ChatMessage[])
  }, [callAi])

  const cancelStream = useCallback(() => {
    abortRef.current = true
    setIsLoading(false)
  }, [])

  return { isLoading, streamingText, error, askAi, askWithImage, getGuide, cancelStream }
}
