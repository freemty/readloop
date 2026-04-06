export type AiProvider = 'openai' | 'claude'

interface AiClientConfig {
  provider: AiProvider
  apiKey: string
  model?: string
  baseUrl?: string
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AiClient {
  chat(messages: ChatMessage[], onChunk: (text: string) => void): Promise<string>
}

export function createAiClient(config: AiClientConfig): AiClient {
  if (!config.apiKey) {
    throw new Error('API key is required')
  }

  const provider = config.provider
  const model = config.model ?? (provider === 'claude' ? 'claude-sonnet-4-5-20250514' : 'gpt-4o')

  const baseUrl = config.baseUrl ?? (provider === 'claude' ? 'https://api.anthropic.com' : 'https://api.openai.com/v1')

  return {
    async chat(messages, onChunk) {
      if (provider === 'openai') {
        return chatOpenAI(baseUrl, config.apiKey, model, messages, onChunk)
      }
      return chatClaude(baseUrl, config.apiKey, model, messages, onChunk)
    },
  }
}

async function chatOpenAI(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  onChunk: (text: string) => void,
): Promise<string> {
  const url = baseUrl.endsWith('/v1') ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, stream: true }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`OpenAI API error: ${response.status} ${err}`)
  }

  return readSSEStream(response, (data) => {
    if (data === '[DONE]') return null
    const parsed = JSON.parse(data)
    return parsed.choices?.[0]?.delta?.content ?? null
  }, onChunk)
}

async function chatClaude(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  onChunk: (text: string) => void,
): Promise<string> {
  const systemMsg = messages.find(m => m.role === 'system')
  const nonSystem = messages.filter(m => m.role !== 'system')

  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      system: systemMsg?.content ?? '',
      messages: nonSystem.map(m => ({ role: m.role, content: m.content })),
      stream: true,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Claude API error: ${response.status} ${err}`)
  }

  return readSSEStream(response, (data) => {
    const parsed = JSON.parse(data)
    if (parsed.type === 'content_block_delta') {
      return parsed.delta?.text ?? null
    }
    return null
  }, onChunk)
}

async function readSSEStream(
  response: Response,
  extractChunk: (data: string) => string | null,
  onChunk: (text: string) => void,
): Promise<string> {
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let full = ''
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (!data) continue

      try {
        const chunk = extractChunk(data)
        if (chunk) {
          full += chunk
          onChunk(chunk)
        }
      } catch {
        // skip unparseable lines
      }
    }
  }

  return full
}
