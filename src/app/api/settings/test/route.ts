export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { logError } from '@/lib/logger'

/**
 * POST /api/settings/test
 * Test connection to the configured AI provider
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check admin role
  const { prisma } = await import('@/lib/db')
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  })

  if (user?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { provider, model, ollamaUrl, anthropicApiKey, geminiApiKey } = body

    // Create a test provider instance
    let testProvider
    switch (provider) {
      case 'anthropic':
        if (!anthropicApiKey) {
          return NextResponse.json({ success: false, error: 'API key required' }, { status: 400 })
        }
        const { AnthropicProvider } = await import('@/lib/ai/anthropic-provider')
        testProvider = new AnthropicProvider({
          provider: 'anthropic',
          apiKey: anthropicApiKey,
          model: model || 'claude-sonnet-4-20250514',
        })
        break
      case 'gemini':
        if (!geminiApiKey) {
          return NextResponse.json({ success: false, error: 'API key required' }, { status: 400 })
        }
        const { GeminiProvider } = await import('@/lib/ai/gemini-provider')
        testProvider = new GeminiProvider({
          provider: 'gemini',
          apiKey: geminiApiKey,
          model: model || 'gemini-2.0-flash',
        })
        break
      case 'ollama':
      default:
        const { OllamaProvider } = await import('@/lib/ai/ollama-provider')
        testProvider = new OllamaProvider({
          provider: 'ollama',
          ollamaUrl: ollamaUrl || 'http://localhost:5566',
          model: model || 'llama3.2',
        })
    }

    // Test with a simple prompt
    const testResponse = await testProvider.complete({
      messages: [{ role: 'user', content: 'Reply with just "OK" to confirm you are working.' }],
      maxTokens: 10,
    })

    if (testResponse) {
      return NextResponse.json({ success: true, message: 'Connection successful' })
    } else {
      return NextResponse.json(
        { success: false, error: 'Empty response from provider' },
        { status: 500 }
      )
    }
  } catch (error) {
    logError('Connection test failed', error, { userId: user?.id })
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
