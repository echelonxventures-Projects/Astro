/**
 * OpenRouter AI Provider
 * Uses OpenRouter API (https://openrouter.ai) to access various AI models
 * Supports free models without API key
 */

import type { AIProvider, TextCompletionRequest, VisionCompletionRequest, AIProviderConfig } from './provider'

// Free models that work without API key (rate limited)
const FREE_MODELS_NO_KEY = [
  'meta-llama/llama-3.2-3b-instruct:free',
  'google/gemma-3-1b-it:free',
]

export class OpenRouterProvider implements AIProvider {
  name = 'OpenRouter'
  supportsVision = true

  private apiKey: string
  private baseUrl: string
  private model: string
  private maxTokens: number
  private isFreeModel: boolean

  constructor(config: AIProviderConfig) {
    this.apiKey = config.apiKey || ''
    this.baseUrl = config.baseUrl || 'https://openrouter.ai/api/v1'
    this.model = config.model || 'meta-llama/llama-3.2-3b-instruct:free'
    this.maxTokens = config.maxTokens || 512
    this.isFreeModel = FREE_MODELS_NO_KEY.some(m => this.model.includes(m.split(':')[0])) || !this.apiKey
  }

  async complete(request: TextCompletionRequest): Promise<string> {
    const { messages, system, maxTokens } = request

    const systemMessage = system || 'You are a helpful assistant.'

    const formattedMessages = [
      { role: 'system' as const, content: systemMessage },
      ...messages
    ]

    // Build headers - free models may not need auth
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`
    }

    // Add optional headers for attribution
    headers['HTTP-Referer'] = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    headers['X-Title'] = 'StarPath Astrology'

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: this.model,
          messages: formattedMessages,
          max_tokens: maxTokens || this.maxTokens,
          temperature: 0.7,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        const errorMessage = errorData.error?.message || `HTTP ${response.status}`

        // Handle rate limiting for free tier
        if (response.status === 429) {
          throw new Error('Rate limit reached. Please try again later or add an API key for unlimited access.')
        }

        throw new Error(`OpenRouter error: ${errorMessage}`)
      }

      const data = await response.json()
      return data.choices?.[0]?.message?.content || ''
    } catch (error: any) {
      // Re-throw with helpful message
      if (error.message.includes('fetch failed')) {
        throw new Error('Unable to connect to OpenRouter. Please check your internet connection.')
      }
      throw error
    }
  }

  async completeWithVision(request: VisionCompletionRequest): Promise<string> {
    const { messages, system, maxTokens, imageUrl } = request

    const systemMessage = system || 'You are a helpful assistant.'

    const formattedMessages = [
      { role: 'system' as const, content: systemMessage },
      ...messages.map(msg => {
        if (msg.role === 'user' && imageUrl) {
          return {
            role: 'user' as const,
            content: [
              { type: 'text', text: msg.content },
              { type: 'image_url', image_url: { url: imageUrl } }
            ]
          }
        }
        return msg
      })
    ]

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`
    }

    headers['HTTP-Referer'] = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    headers['X-Title'] = 'StarPath Astrology'

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: this.model,
          messages: formattedMessages,
          max_tokens: maxTokens || this.maxTokens,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(`OpenRouter error: ${errorData.error?.message || response.status}`)
      }

      const data = await response.json()
      return data.choices?.[0]?.message?.content || ''
    } catch (error: any) {
      if (error.message.includes('fetch failed')) {
        throw new Error('Unable to connect to OpenRouter for image analysis.')
      }
      throw error
    }
  }
}
