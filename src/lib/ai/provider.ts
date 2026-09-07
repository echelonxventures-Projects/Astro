/**
 * AI Provider Interface
 * Unified interface for multiple AI providers (Anthropic, Ollama, Gemini, OpenRouter)
 * Priority: Free providers first, then paid providers
 */

export interface AIProviderConfig {
  provider: 'anthropic' | 'ollama' | 'gemini' | 'openrouter' | 'nvidia' | 'opencode'
  apiKey?: string // For Anthropic/Gemini/OpenRouter/NVIDIA
  ollamaUrl?: string // Default: http://localhost:11434
  baseUrl?: string // For OpenRouter, NVIDIA, OpenCode
  model: string
  maxTokens?: number
}

export interface TextCompletionRequest {
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[]
  system?: string
  maxTokens?: number
}

export interface VisionCompletionRequest extends TextCompletionRequest {
  imageUrl?: string // Base64 or URL of image
  imageMimeType?: string // e.g., 'image/jpeg'
}

export interface AIProvider {
  name: string
  supportsVision: boolean

  /**
   * Generate text completion
   */
  complete(request: TextCompletionRequest): Promise<string>

  /**
   * Generate completion with image analysis
   */
  completeWithVision?(request: VisionCompletionRequest): Promise<string>
}

// Free models available on OpenRouter
const FREE_OPENROUTER_MODELS = [
  'meta-llama/llama-3.2-3b-instruct:free',
  'google/gemma-3-1b-it:free',
  'qwen/qwen3-1.7b:free',
]

/**
 * Get current AI provider configuration from settings
 * Priority: Free providers first
 */
export async function getProviderConfig(): Promise<AIProviderConfig> {
  const { prisma } = await import('@/lib/db')

  const settings = await prisma.appSettings.findMany({
    where: {
      key: {
        in: [
          'AI_PROVIDER',
          'AI_MODEL',
          'OLLAMA_URL',
          'ANTHROPIC_API_KEY',
          'GEMINI_API_KEY',
          'OPENROUTER_API_KEY',
          'NVIDIA_API_KEY',
        ],
      },
    },
  })

  const settingsMap = Object.fromEntries(settings.map(s => [s.key, s.value]))

  // Priority 1: OpenRouter (free tier available)
  const openrouterKey = settingsMap['OPENROUTER_API_KEY'] || process.env.OPENROUTER_API_KEY
  if (openrouterKey && openrouterKey.length > 0) {
    return {
      provider: 'openrouter',
      apiKey: openrouterKey,
      baseUrl: 'https://openrouter.ai/api/v1',
      model: settingsMap['AI_MODEL'] || FREE_OPENROUTER_MODELS[0],
      maxTokens: 1024,
    }
  }

  // Priority 2: NVIDIA NIM (free tier available)
  const nvidiaKey = settingsMap['NVIDIA_API_KEY'] || process.env.NVIDIA_API_KEY
  if (nvidiaKey && nvidiaKey.length > 0) {
    return {
      provider: 'nvidia',
      apiKey: nvidiaKey,
      baseUrl: 'https://integrate.api.nvidia.com/v1',
      model: settingsMap['AI_MODEL'] || 'meta/llama-3.1-8b-instruct',
      maxTokens: 1024,
    }
  }

  // Priority 3: Ollama (free, local)
  const ollamaUrl = settingsMap['OLLAMA_URL'] || 'http://localhost:11434'
  // Try to check if Ollama is available
  try {
    const response = await fetch(ollamaUrl, { method: 'GET', signal: AbortSignal.timeout(2000) })
    if (response.ok) {
      return {
        provider: 'ollama',
        ollamaUrl,
        model: settingsMap['AI_MODEL'] || 'llama3.2',
        maxTokens: 512,
      }
    }
  } catch {
    // Ollama not available, continue to next provider
  }

  // Priority 4: Anthropic (paid, premium)
  const anthropicKey = settingsMap['ANTHROPIC_API_KEY'] || process.env.ANTHROPIC_API_KEY
  if (anthropicKey && anthropicKey.length > 0) {
    return {
      provider: 'anthropic',
      apiKey: anthropicKey,
      model: settingsMap['AI_MODEL'] || 'claude-sonnet-4-20250514',
      maxTokens: 2048,
    }
  }

  // Priority 5: Gemini (paid, alternative)
  const geminiKey = settingsMap['GEMINI_API_KEY'] || process.env.GEMINI_API_KEY
  if (geminiKey && geminiKey.length > 0) {
    return {
      provider: 'gemini',
      apiKey: geminiKey,
      model: settingsMap['AI_MODEL'] || 'gemini-2.0-flash',
      maxTokens: 1024,
    }
  }

  // Default fallback to OpenRouter free model (no key required for some free models)
  return {
    provider: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: FREE_OPENROUTER_MODELS[0],
    maxTokens: 512,
  }
}

function _getDefaultModel(provider: string): string {
  switch (provider) {
    case 'anthropic':
      return 'claude-sonnet-4-20250514'
    case 'gemini':
      return 'gemini-2.0-flash'
    case 'openrouter':
      return FREE_OPENROUTER_MODELS[0]
    case 'nvidia':
      return 'meta/llama-3.1-8b-instruct'
    case 'ollama':
    default:
      return 'llama3.2'
  }
}

/**
 * Factory function to get the configured AI provider
 */
export async function getAIProvider(): Promise<AIProvider> {
  const config = await getProviderConfig()

  switch (config.provider) {
    case 'anthropic':
      const { AnthropicProvider } = await import('./anthropic-provider')
      return new AnthropicProvider(config)
    case 'gemini':
      const { GeminiProvider } = await import('./gemini-provider')
      return new GeminiProvider(config)
    case 'openrouter':
      const { OpenRouterProvider } = await import('./openrouter-provider')
      return new OpenRouterProvider(config)
    case 'nvidia':
      const { NvidiaProvider } = await import('./nvidia-provider')
      return new NvidiaProvider(config)
    case 'opencode':
      const { OpenCodeProvider } = await import('./opencode-provider')
      return new OpenCodeProvider(config)
    case 'ollama':
    default:
      const { OllamaProvider } = await import('./ollama-provider')
      return new OllamaProvider(config)
  }
}

/**
 * Get AI provider for a specific subscription plan
 * This allows different tiers to use different models
 */
export async function getAIProviderForPlan(
  plan: 'free' | 'monthly' | 'yearly'
): Promise<AIProvider> {
  const { getAIPlanConfig } = await import('./plan-config')
  const config = await getAIPlanConfig(plan)

  if (!config || !config.enabled) {
    // Fallback to default provider if plan config is disabled
    return getAIProvider()
  }

  const providerConfig: AIProviderConfig = {
    provider: config.provider as
      | 'anthropic'
      | 'ollama'
      | 'gemini'
      | 'openrouter'
      | 'nvidia'
      | 'opencode',
    apiKey: config.apiKey || undefined,
    ollamaUrl: config.ollamaUrl || 'http://localhost:11434',
    baseUrl:
      config.provider === 'openrouter'
        ? 'https://openrouter.ai/api/v1'
        : config.provider === 'nvidia'
          ? 'https://integrate.api.nvidia.com/v1'
          : config.provider === 'opencode'
            ? 'http://localhost:8080'
            : undefined,
    model: config.model,
    maxTokens: config.maxTokens,
  }

  switch (providerConfig.provider) {
    case 'anthropic':
      const { AnthropicProvider } = await import('./anthropic-provider')
      return new AnthropicProvider(providerConfig)
    case 'gemini':
      const { GeminiProvider } = await import('./gemini-provider')
      return new GeminiProvider(providerConfig)
    case 'openrouter':
      const { OpenRouterProvider } = await import('./openrouter-provider')
      return new OpenRouterProvider(providerConfig)
    case 'nvidia':
      const { NvidiaProvider } = await import('./nvidia-provider')
      return new NvidiaProvider(providerConfig)
    case 'opencode':
      const { OpenCodeProvider } = await import('./opencode-provider')
      return new OpenCodeProvider(providerConfig)
    case 'ollama':
    default:
      const { OllamaProvider } = await import('./ollama-provider')
      return new OllamaProvider(providerConfig)
  }
}
