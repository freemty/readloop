import { describe, it, expect } from 'vitest'
import { createAiClient } from '../src/ai/client'

describe('createAiClient', () => {
  it('throws if no API key configured', () => {
    expect(() => createAiClient({ provider: 'openai', apiKey: '' }))
      .toThrow('API key is required')
  })

  it('creates client with valid config', () => {
    const client = createAiClient({ provider: 'openai', apiKey: 'sk-test-123' })
    expect(client).toBeDefined()
    expect(client.chat).toBeTypeOf('function')
  })
})
