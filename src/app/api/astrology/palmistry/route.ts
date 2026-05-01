export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getAIProvider } from '@/lib/ai/provider'
import { logError } from '@/lib/logger'

/**
 * POST /api/astrology/palmistry
 * Analyze palm image with AI
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { image } = body

    if (!image) {
      return NextResponse.json(
        { error: 'Image required for palm analysis' },
        { status: 400 }
      )
    }

    const provider = await getAIProvider()

    if (!provider.supportsVision || !provider.completeWithVision) {
      return NextResponse.json(
        { error: 'Current AI provider does not support vision. Please use Anthropic or Gemini, or configure Ollama with a vision model like llava.' },
        { status: 501 }
      )
    }

    const response = await provider.completeWithVision({
      messages: [
        {
          role: 'user',
          content: `You are an expert palmistry reader with deep knowledge of chiromancy. Analyze this palm image and provide a detailed reading.

Please analyze the following aspects:
1. Hand type (Earth, Air, Fire, or Water based on palm shape and finger length)
2. Life Line (curvature, depth, breaks - indicating vitality and life changes)
3. Heart Line (shape, length, branches - emotional nature and relationships)
4. Head Line (angle, length, clarity - thinking style and communication)
5. Fate Line (presence, clarity - career path and life direction)

Return your analysis in this exact JSON format:
{
  "handType": "string - the identified hand type with brief description",
  "lifeLine": "string - detailed reading of the life line",
  "heartLine": "string - detailed reading of the heart line",
  "headLine": "string - detailed reading of the head line",
  "fateLine": "string - detailed reading of the fate line or note if not visible",
  "overallReading": "string - comprehensive overall interpretation combining all lines",
  "recommendations": ["array of 3-5 practical life recommendations based on the reading"]
}

If the palm image is unclear or lines cannot be distinguished, politely explain this and provide general guidance based on what is visible.`,
        },
      ],
      imageUrl: image,
      imageMimeType: 'image/jpeg',
      maxTokens: 2048,
    })

    // Parse the JSON response
    let reading
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      reading = JSON.parse(jsonMatch[0])
    } else {
      throw new Error('Could not parse AI response')
    }

    return NextResponse.json({ reading })
  } catch (error) {
    logError('Error analyzing palm', error, { userId: session.user.id })
    return NextResponse.json(
      { error: 'Failed to analyze palm' },
      { status: 500 }
    )
  }
}
