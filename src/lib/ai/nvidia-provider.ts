/**
 * NVIDIA NIM AI Provider
 * Uses NVIDIA NIM API (https://build.nvidia.com) to access various AI models
 * Supports free tier with rate limits
 */

import type {
  AIProvider,
  TextCompletionRequest,
  VisionCompletionRequest,
  AIProviderConfig,
} from './provider'

// Popular models available on NVIDIA NIM
const _NVIDIA_MODELS = [
  'meta/llama-3.1-8b-instruct',
  'meta/llama-3.2-3b-instruct',
  'meta/llama-3.2-1b-instruct',
  'google/gemma-2-9b-it',
  'google/gemma-2-2b-it',
  'mistralai/mistral-7b-instruct-v0.3',
  'nvidia/nemotron-4-mini-hindi-4k',
]

export class NvidiaProvider implements AIProvider {
  name = 'NVIDIA NIM'
  supportsVision = true

  private apiKey: string
  private baseUrl: string
  private model: string
  private maxTokens: number

  constructor(config: AIProviderConfig) {
    this.apiKey = config.apiKey || ''
    this.baseUrl = config.baseUrl || 'https://integrate.api.nvidia.com/v1'
    this.model = config.model || 'meta/llama-3.1-8b-instruct'
    this.maxTokens = config.maxTokens || 512
  }

  async complete(request: TextCompletionRequest): Promise<string> {
    const { messages, system, maxTokens } = request

    const systemMessage = system || 'You are a helpful assistant.'

    const formattedMessages = [{ role: 'system' as const, content: systemMessage }, ...messages]

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    }

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: this.model,
          messages: formattedMessages,
          max_tokens: maxTokens || this.maxTokens,
          temperature: 0.7,
          top_p: 0.9,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        const errorMessage = errorData.error?.message || `HTTP ${response.status}`

        // Handle rate limiting
        if (response.status === 429) {
          throw new Error('NVIDIA API rate limit reached. Please try again later.')
        }

        throw new Error(`NVIDIA NIM error: ${errorMessage}`)
      }

      const data = await response.json()
      return data.choices?.[0]?.message?.content || ''
    } catch (error: any) {
      if (error.message.includes('fetch failed')) {
        throw new Error('Unable to connect to NVIDIA NIM. Please check your internet connection.')
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
              { type: 'image_url', image_url: { url: imageUrl } },
            ],
          }
        }
        return msg
      }),
    ]

    // Use vision-capable model
    const visionModel = this.getVisionModel()

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    }

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: visionModel,
          messages: formattedMessages,
          max_tokens: maxTokens || this.maxTokens,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(`NVIDIA NIM error: ${errorData.error?.message || response.status}`)
      }

      const data = await response.json()
      return data.choices?.[0]?.message?.content || ''
    } catch (error: any) {
      if (error.message.includes('fetch failed')) {
        throw new Error('Unable to connect to NVIDIA NIM for image analysis.')
      }
      throw error
    }
  }

  private getVisionModel(): string {
    // Llama 3.2 supports vision
    if (this.model.includes('llama-3.2')) {
      return this.model
    }
    // Fallback to a vision-capable model
    return 'meta/llama-3.2-11b-vision-instruct'
  }
}
