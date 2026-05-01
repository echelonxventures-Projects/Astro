import type {
  AIProvider,
  AIProviderConfig,
  TextCompletionRequest,
  VisionCompletionRequest,
} from './provider'

/**
 * Ollama Provider
 * Free, local AI provider that supports multiple open-source models
 */
export class OllamaProvider implements AIProvider {
  name = 'Ollama'
  supportsVision = false

  private baseUrl: string
  private model: string
  private maxTokens: number

  constructor(config: AIProviderConfig) {
    this.baseUrl = config.ollamaUrl || 'http://localhost:11434'
    this.model = config.model || 'llama3.2'
    this.maxTokens = config.maxTokens || 2048
  }

  async complete(request: TextCompletionRequest): Promise<string> {
    const url = `${this.baseUrl}/api/generate`

    // Convert messages to Ollama prompt format
    const prompt = this.formatMessagesToPrompt(request.messages, request.system)

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt,
        stream: false,
        options: {
          num_predict: this.maxTokens,
          temperature: 0.7,
        },
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Ollama error: ${response.status} - ${error}`)
    }

    const data = await response.json()
    return data.response || ''
  }

  async completeWithVision(request: VisionCompletionRequest): Promise<string> {
    // Ollama supports vision with certain models (llava, bakllava)
    // For now, return an error if vision is requested without a vision model
    if (!this.isVisionModel()) {
      throw new Error(
        `Model '${this.model}' does not support vision. Use a vision-capable model like 'llava' or 'bakllava'`
      )
    }

    const url = `${this.baseUrl}/api/generate`

    // Convert base64 image to format Ollama expects
    let images: string[] = []
    if (request.imageUrl) {
      const base64Data = request.imageUrl.replace(/^data:image\/\w+;base64,/, '')
      images = [base64Data]
    }

    const prompt = this.formatMessagesToPrompt(request.messages, request.system)

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt,
        images,
        stream: false,
        options: {
          num_predict: this.maxTokens,
          temperature: 0.7,
        },
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Ollama error: ${response.status} - ${error}`)
    }

    const data = await response.json()
    return data.response || ''
  }

  private formatMessagesToPrompt(
    messages: { role: string; content: string }[],
    system?: string
  ): string {
    let prompt = ''

    if (system) {
      prompt += `System: ${system}\n\n`
    }

    for (const msg of messages) {
      const role = msg.role === 'assistant' ? 'Assistant' : 'User'
      prompt += `${role}: ${msg.content}\n\n`
    }

    prompt += 'Assistant: '
    return prompt
  }

  private isVisionModel(): boolean {
    const visionModels = ['llava', 'bakllava', 'llava-llama3', 'moondream']
    return visionModels.some(m => this.model.toLowerCase().includes(m))
  }
}
