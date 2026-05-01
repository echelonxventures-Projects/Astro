export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getAIProviderConfig, setSetting } from '@/lib/settings'
import { logError } from '@/lib/logger'

/**
 * GET /api/settings
 * Get current AI provider configuration
 */
export async function GET(req: NextRequest) {
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

  const config = await getAIProviderConfig()
  return NextResponse.json(config)
}

/**
 * POST /api/settings
 * Save AI provider configuration
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

    // Validate provider
    if (!['anthropic', 'ollama', 'gemini'].includes(provider)) {
      return NextResponse.json(
        { error: 'Invalid provider. Must be anthropic, ollama, or gemini' },
        { status: 400 }
      )
    }

    // Validate API keys for paid providers
    if (provider === 'anthropic' && !anthropicApiKey) {
      return NextResponse.json(
        { error: 'Anthropic API key is required for Anthropic provider' },
        { status: 400 }
      )
    }

    if (provider === 'gemini' && !geminiApiKey) {
      return NextResponse.json(
        { error: 'Google Gemini API key is required for Gemini provider' },
        { status: 400 }
      )
    }

    // Save settings
    await setSetting('AI_PROVIDER', provider, 'AI provider: anthropic, ollama, or gemini')
    await setSetting('AI_MODEL', model, 'Model name to use')
    await setSetting('OLLAMA_URL', ollamaUrl || 'http://localhost:5566', 'Ollama server URL')
    await setSetting('ANTHROPIC_API_KEY', anthropicApiKey || '', 'Anthropic API key')
    await setSetting('GEMINI_API_KEY', geminiApiKey || '', 'Google Gemini API key')

    return NextResponse.json({ success: true })
  } catch (error) {
    logError('Error saving settings', error, { userId: session.user.id })
    return NextResponse.json(
      { error: 'Failed to save settings' },
      { status: 500 }
    )
  }
}
