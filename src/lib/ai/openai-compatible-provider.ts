/**
 * Generic OpenAI-compatible provider.
 * Works with any /chat/completions endpoint: OpenAI, OpenRouter, NVIDIA NIM,
 * Groq, Together, DeepSeek, LM Studio, llama.cpp server, etc.
 * New vendors require NO code - add an AIProviderCatalog row (kind openai-compatible).
 */

import type { AIProvider, TextCompletionRequest, VisionCompletionRequest } from './provider'

export interface OpenAICompatOptions {
  name: string
  baseUrl: string
  apiKey?: string
  model: string
  maxTokens: number
  extraHeaders?: Record<string, string>
  supportsVision?: boolean
}

export class OpenAICompatibleProvider implements AIProvider {
  name: string
  supportsVision: boolean
  private opts: OpenAICompatOptions

  constructor(opts: OpenAICompatOptions) {
    this.opts = opts
    this.name = opts.name
    this.supportsVision = opts.supportsVision ?? false
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (this.opts.apiKey) headers['Authorization'] = `Bearer ${this.opts.apiKey}`
    if (this.opts.extraHeaders) Object.assign(headers, this.opts.extraHeaders)
    return headers
  }

  private async call(body: Record<string, unknown>): Promise<string> {
    const response = await fetch(`${this.opts.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ model: this.opts.model, temperature: 0.7, ...body }),
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Unknown error' }))
      const message = err?.error?.message || err?.detail || `HTTP ${response.status}`
      if (response.status === 429) {
        throw new Error(`${this.name}: rate limit reached. Try again later or use a paid key.`)
      }
      throw new Error(`${this.name} error: ${message}`)
    }
    const data = await response.json()
    return data.choices?.[0]?.message?.content || ''
  }

  async complete(request: TextCompletionRequest): Promise<string> {
    const systemMessage = request.system || 'You are a helpful assistant.'
    return this.call({
      messages: [{ role: 'system', content: systemMessage }, ...request.messages],
      max_tokens: request.maxTokens || this.opts.maxTokens,
    })
  }

  async completeWithVision(request: VisionCompletionRequest): Promise<string> {
    if (!this.supportsVision) {
      throw new Error(
        `${this.name}: vision is not supported by this model (enable the "vision" capability in the provider catalog).`
      )
    }
    const systemMessage = request.system || 'You are a helpful assistant.'
    const messages = request.messages.map(msg => {
      if (msg.role === 'user' && request.imageUrl) {
        return {
          role: 'user' as const,
          content: [
            { type: 'text', text: msg.content },
            { type: 'image_url', image_url: { url: request.imageUrl } },
          ],
        }
      }
      return msg
    })
    return this.call({
      messages: [{ role: 'system', content: systemMessage }, ...messages],
      max_tokens: request.maxTokens || this.opts.maxTokens,
    })
  }
}
