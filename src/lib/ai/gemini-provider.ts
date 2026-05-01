import type {
  AIProvider,
  AIProviderConfig,
  TextCompletionRequest,
  VisionCompletionRequest,
} from './provider'

/**
 * Google Gemini Provider
 * Premium provider using Google's Gemini models
 */
export class GeminiProvider implements AIProvider {
  name = 'Gemini'
  supportsVision = true

  private apiKey: string
  private model: string
  private maxTokens: number
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta'

  constructor(config: AIProviderConfig) {
    if (!config.apiKey) {
      throw new Error('Google Gemini API key is required')
    }
    this.apiKey = config.apiKey
    this.model = config.model || 'gemini-2.0-flash'
    this.maxTokens = config.maxTokens || 2048
  }

  async complete(request: TextCompletionRequest): Promise<string> {
    const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`

    const contents = this.formatMessagesToContents(request.messages)

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: {
          maxOutputTokens: this.maxTokens,
          temperature: 0.7,
        },
        systemInstruction: request.system ? { parts: [{ text: request.system }] } : undefined,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Gemini error: ${response.status} - ${JSON.stringify(error)}`)
    }

    const data = await response.json()
    return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  }

  async completeWithVision(request: VisionCompletionRequest): Promise<string> {
    const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`

    // Build contents with image support
    const contents = this.formatMessagesToContentsWithImage(
      request.messages,
      request.imageUrl
    )

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: {
          maxOutputTokens: this.maxTokens,
          temperature: 0.7,
        },
        systemInstruction: request.system ? { parts: [{ text: request.system }] } : undefined,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Gemini error: ${response.status} - ${JSON.stringify(error)}`)
    }

    const data = await response.json()
    return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  }

  private formatMessagesToContents(
    messages: { role: string; content: string }[]
  ): Array<{ role: string; parts: Array<{ text: string }> }> {
    return messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }))
  }

  private formatMessagesToContentsWithImage(
    messages: { role: string; content: string }[],
    imageUrl?: string
  ): any {
    const contents = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }))

    // Add image to the last user message
    if (imageUrl) {
      const lastUserIndex = contents.findLastIndex(c => c.role === 'user')
      if (lastUserIndex >= 0) {
        const base64Data = imageUrl.replace(/^data:image\/\w+;base64,/, '')
        const mimeType = this.extractMimeType(imageUrl) || 'image/jpeg'

        const existingText = contents[lastUserIndex].parts[0]?.text || ''
        contents[lastUserIndex].parts = [
          { inlineData: { mimeType, data: base64Data } } as any,
          { text: existingText },
        ]
      }
    }

    return contents
  }

  private extractMimeType(dataUrl: string): string | null {
    const match = dataUrl.match(/^data:(image\/\w+);base64/)
    return match?.[1] || null
  }
}
