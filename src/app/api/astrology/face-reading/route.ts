export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getAIProvider } from '@/lib/ai/provider'
import { auth } from '@/lib/auth'
import { logError } from '@/lib/logger'

/**
 * POST /api/astrology/face-reading
 * Analyze face image with AI
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
      return NextResponse.json({ error: 'Image required for face analysis' }, { status: 400 })
    }

    const provider = await getAIProvider()

    if (!provider.supportsVision || !provider.completeWithVision) {
      return NextResponse.json(
        {
          error:
            'Current AI provider does not support vision. Please use Anthropic or Gemini, or configure Ollama with a vision model like llava.',
        },
        { status: 501 }
      )
    }

    const response = await provider.completeWithVision({
      messages: [
        {
          role: 'user',
          content: `You are an expert in Chinese face reading (Mian Xiang) and Western physiognomy. Analyze this face image and provide a detailed reading.

Please analyze the following aspects:
1. Face Shape (Round, Square, Oval, Long, or Heart)
2. Forehead (height, width, smoothness - early life and intellect)
3. Eyes (shape, size, spacing - emotional nature and perception)
4. Nose (bridge, tip, nostrils - career and wealth potential)
5. Lips (fullness, shape - communication and relationships)
6. Chin (shape, prominence - later life and stability)

Return your analysis in this exact JSON format:
{
  "faceShape": "string - the identified face shape with brief description",
  "forehead": "string - detailed reading of the forehead",
  "eyes": "string - detailed reading of the eyes",
  "nose": "string - detailed reading of the nose",
  "lips": "string - detailed reading of the lips",
  "chin": "string - detailed reading of the chin",
  "overallReading": "string - comprehensive overall interpretation combining all features",
  "personalityTraits": ["array of 5-7 key personality traits indicated by the features"],
  "strengths": ["array of 3-5 natural strengths based on the reading"],
  "recommendations": ["array of 3-5 practical life recommendations"]
}

If the face image is unclear or features cannot be distinguished, politely explain this and provide general guidance based on what is visible.`,
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
    logError('Error analyzing face', error, { userId: session.user.id })
    return NextResponse.json({ error: 'Failed to analyze face' }, { status: 500 })
  }
}
