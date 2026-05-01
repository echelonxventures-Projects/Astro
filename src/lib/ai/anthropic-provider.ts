import Anthropic from '@anthropic-ai/sdk'
import type {
  AIProvider,
  AIProviderConfig,
  TextCompletionRequest,
  VisionCompletionRequest,
} from './provider'

/**
 * Anthropic Provider
 * Premium provider using Claude models
 */
export class AnthropicProvider implements AIProvider {
  name = 'Anthropic'
  supportsVision = true

  private client: Anthropic
  private model: string
  private maxTokens: number

  constructor(config: AIProviderConfig) {
    if (!config.apiKey) {
      throw new Error('Anthropic API key is required')
    }
    this.client = new Anthropic({ apiKey: config.apiKey })
    this.model = config.model || 'claude-sonnet-4-20250514'
    this.maxTokens = config.maxTokens || 2048
  }

  async complete(request: TextCompletionRequest): Promise<string> {
    const messages = request.messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))

    const systemPrompt = request.system || ''

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      system: systemPrompt,
      messages,
    })

    const content = response.content[0]
    return content.type === 'text' ? content.text : ''
  }

  async completeWithVision(request: VisionCompletionRequest): Promise<string> {
    const messages = request.messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))

    // Add image to the last user message
    const lastUserMessageIndex = messages.findLastIndex(m => m.role === 'user')
    if (lastUserMessageIndex >= 0 && request.imageUrl) {
      const base64Data = request.imageUrl.replace(/^data:image\/\w+;base64,/, '')
      const mimeType = request.imageMimeType || 'image/jpeg'

      const existingContent = messages[lastUserMessageIndex].content
      messages[lastUserMessageIndex] = {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64Data } },
          { type: 'text', text: existingContent },
        ] as any,
      }
    }

    const systemPrompt = request.system || ''

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      system: systemPrompt,
      messages: messages as any,
    })

    const content = response.content[0]
    return content.type === 'text' ? content.text : ''
  }
}
