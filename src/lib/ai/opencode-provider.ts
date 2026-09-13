/**
 * OpenCode AI Provider
 * Uses OpenCode server API (https://opencode.ai) to access various AI models
 * OpenCode provides free models like minimax-m2.5-free, nemotron-3-super-free
 */

import type {
  AIProvider,
  TextCompletionRequest,
  VisionCompletionRequest,
  AIProviderConfig,
} from './provider'

// Free models available on OpenCode
const _FREE_OPENCODE_MODELS = [
  { provider: 'opencode', model: 'hy3-preview-free' },
  { provider: 'opencode', model: 'minimax-m2.5-free' },
  { provider: 'opencode', model: 'nemotron-3-super-free' },
]

export class OpenCodeProvider implements AIProvider {
  name = 'OpenCode'
  supportsVision = true

  private baseUrl: string
  private model: string
  private providerId: string
  private _maxTokens: number
  private sessionId: string | null = null

  constructor(config: AIProviderConfig) {
    this.baseUrl = config.baseUrl || 'http://localhost:8080'
    // Parse model format "provider/model" or just "model"
    if ((config.model ?? '').includes('/')) {
      const parts = (config.model ?? '').split('/')
      this.providerId = parts[0] || 'opencode'
      this.model = parts[1] || 'minimax-m2.5-free'
    } else {
      this.providerId = 'opencode'
      this.model = config.model || 'minimax-m2.5-free'
    }
    this._maxTokens = config.maxTokens || 512
  }

  async complete(request: TextCompletionRequest): Promise<string> {
    const { messages, system, maxTokens: _maxTokens } = request

    // Create or reuse session
    const sessionId = await this.getOrCreateSession()

    // Format messages into parts
    const parts = this.formatMessagesToParts(messages)

    const systemMessage = system || 'You are a helpful astrology assistant.'

    try {
      const response = await fetch(`${this.baseUrl}/session/${sessionId}/prompt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          system: systemMessage,
          model: {
            providerID: this.providerId,
            modelID: this.model,
          },
          parts,
          tools: {},
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ _error: 'Unknown _error' }))
        const errorMessage =
          errorData._error?.message || errorData.message || `HTTP ${response.status}`
        throw new Error(`OpenCode _error: ${errorMessage}`)
      }

      const data = await response.json()
      // Extract text from response parts
      return this.extractTextFromParts(data.parts)
    } catch (_error: any) {
      if (_error.message.includes('fetch failed')) {
        throw new Error(
          'Unable to connect to OpenCode server. Make sure OpenCode server is running: opencode serve --port 8080'
        )
      }
      throw _error
    }
  }

  async completeWithVision(request: VisionCompletionRequest): Promise<string> {
    const { messages, system, maxTokens: _maxTokens, imageUrl } = request

    const sessionId = await this.getOrCreateSession()
    const parts = this.formatMessagesToParts(messages, imageUrl)

    const systemMessage = system || 'You are a helpful assistant.'

    try {
      const response = await fetch(`${this.baseUrl}/session/${sessionId}/prompt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          system: systemMessage,
          model: {
            providerID: this.providerId,
            modelID: this.model,
          },
          parts,
          tools: {},
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ _error: 'Unknown _error' }))
        throw new Error(`OpenCode _error: ${errorData._error?.message || response.status}`)
      }

      const data = await response.json()
      return this.extractTextFromParts(data.parts)
    } catch (_error: any) {
      if (_error.message.includes('fetch failed')) {
        throw new Error('Unable to connect to OpenCode server for image analysis.')
      }
      throw _error
    }
  }

  private async getOrCreateSession(): Promise<string> {
    if (this.sessionId) {
      return this.sessionId
    }

    try {
      const response = await fetch(`${this.baseUrl}/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: {
            providerID: this.providerId,
            modelID: this.model,
          },
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to create OpenCode session: ${response.status}`)
      }

      const data = await response.json()
      const newSessionId = data.id || data.sessionId
      if (!newSessionId) {
        throw new Error('OpenCode did not return a session ID')
      }
      this.sessionId = newSessionId
      return newSessionId
    } catch (_error) {
      throw new Error('Unable to create OpenCode session. Ensure OpenCode server is running.')
    }
  }

  private formatMessagesToParts(
    messages: { role: 'user' | 'assistant' | 'system'; content: string }[],
    imageUrl?: string
  ): Array<{ type: string; text?: string; url?: string }> {
    const parts: Array<{ type: string; text?: string; url?: string }> = []

    for (const msg of messages) {
      if (msg.role === 'user') {
        parts.push({
          type: 'text',
          text: msg.content,
        })
        if (imageUrl) {
          parts.push({
            type: 'file',
            url: imageUrl,
          })
        }
      } else if (msg.role === 'assistant') {
        // OpenCode handles assistant messages differently
        // For now, we'll just include user messages
      }
    }

    return parts
  }

  private extractTextFromParts(parts: any[]): string {
    if (!parts || !Array.isArray(parts)) {
      return ''
    }

    const textParts = parts.filter(p => p.type === 'text' && p.text).map(p => p.text)

    return textParts.join('\n')
  }
}
