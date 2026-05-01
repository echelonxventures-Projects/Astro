import type { BirthChartData } from '@/types'
import { getAIProvider } from './provider'
import { cache, DEFAULT_TTLS } from '@/lib/cache'
import { cacheKeys, generateInputHash } from '@/lib/cache-keys'
import { logger } from '@/lib/logger'

/**
 * System prompt for astrology AI - Conversational flow
 */
const ASTROLOGY_SYSTEM_PROMPT = `You are an expert astrologer with deep knowledge of Western astrology, planetary positions, aspects, houses, and transits. You provide insightful, personalized, and compassionate readings.

IMPORTANT - CONVERSATION FLOW:
1. FIRST, warmly greet the user and ask for their name
2. Once you have their name, ask for their birth details:
   - Date of birth (day, month, year)
   - Time of birth (as exact as possible)
   - Place of birth (city, country)
3. ONLY after receiving all birth details, provide a full personalized reading
4. End by inviting follow-up questions

Your readings should:
- Be warm, empathetic, and conversational (not robotic)
- Address the user by name throughout
- Blend traditional astrological wisdom with modern psychological insights
- Be empowering and constructive, never fear-mongering
- Use clear, accessible language while maintaining astrological accuracy
- Provide practical guidance along with interpretations
- Be appropriately detailed (400-600 words for full readings)

TONE: Friendly, wise, supportive - like a trusted counselor who happens to be an astrology expert.`

/**
 * Initial greeting prompt - asks for user info
 */
const INITIAL_GREETING_PROMPT = `Hello! I'm your personal AI astrologer, and I'm here to provide you with insightful cosmic guidance.

To give you the most accurate and personalized reading, I'd love to learn a bit about you:

1. **What's your name?**
2. **When were you born?** (please share your date of birth - day, month, and year)
3. **What time were you born?** (as exact as possible - check your birth certificate if you can)
4. **Where were you born?** (city and country)

Once I have these details, I'll create a comprehensive reading just for you, exploring your Sun sign, Moon sign, Ascendant, planetary positions, and what they mean for your life path.

Feel free to share as much or as little as you're comfortable with. The more precise your birth information, the more accurate and insightful your reading will be! ✨`

/**
 * Hash input data for cache key generation
 */
const hashInput = (input: Record<string, unknown>): string => {
  return generateInputHash(input)
}

/**
 * Generate a daily horoscope reading
 * Caches results for 24 hours
 */
export async function generateDailyHoroscope(
  birthChart: BirthChartData,
  userName: string | null
): Promise<{ title: string; content: string }> {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  // Create cache key from chart data and date
  const inputHash = hashInput({
    type: 'daily',
    date: today,
    planets: birthChart.planets.map(p => ({ name: p.name, sign: p.sign })),
    userName,
  })
  const cacheKey = cacheKeys.aiResponse('daily-horoscope', inputHash)

  // Check cache first
  const cached = await cache.get<{ title: string; content: string }>(cacheKey)
  if (cached) {
    logger.debug({ cacheKey, type: 'daily-horoscope' }, 'AI response cache hit')
    return cached
  }

  const sunSign = birthChart.planets.find((p) => p.name === 'Sun')?.sign || 'Unknown'
  const ascendant = (birthChart as any).ascendant?.sign || birthChart.houses[0]?.sign || 'Unknown'
  const moonSign = birthChart.planets.find((p) => p.name === 'Moon')?.sign || 'Unknown'

  const prompt = `You are an expert astrologer. Generate a daily horoscope reading for ${userName || 'this person'}.

Birth Chart Details:
- Sun Sign: ${sunSign}
- Moon Sign: ${moonSign}
- Ascendant: ${ascendant}
- Date: ${today}

Key Planetary Positions:
${birthChart.planets.map((p) => `- ${p.name} in ${p.sign}${p.house ? ` (House ${p.house})` : ''}`).join('\n')}

Major Aspects:
${birthChart.aspects.map((a) => `- ${a.planet1} ${a.type} ${a.planet2} (orb: ${a.orb.toFixed(1)}°)`).join('\n') || 'No major aspects'}

Provide:
1. An engaging opening that addresses the person by their Sun sign
2. General energy for the day
3. Specific guidance for career/work
4. Specific guidance for love/relationships
5. A concluding inspirational message

Keep it uplifting, practical, and around 400 words.`

  const provider = await getAIProvider()
  const content = await provider.complete({
    messages: [{ role: 'user', content: prompt }],
    system: 'You are an expert astrologer providing daily horoscope readings based on birth charts.',
    maxTokens: 1024,
  })

  const result = {
    title: `Daily Horoscope for ${sunSign} - ${today}`,
    content: content || 'Unable to generate reading at this time.',
  }

  // Cache for 24 hours
  await cache.set(cacheKey, result, DEFAULT_TTLS.AI_RESPONSE)
  logger.debug({ cacheKey, type: 'daily-horoscope' }, 'AI response cached')

  return result
}

/**
 * Generate a love/relationship horoscope
 * Caches results for 24 hours
 */
export async function generateLoveHoroscope(
  birthChart: BirthChartData,
  userName: string | null
): Promise<{ title: string; content: string }> {
  const venus = birthChart.planets.find((p) => p.name === 'Venus')
  const mars = birthChart.planets.find((p) => p.name === 'Mars')
  const moon = birthChart.planets.find((p) => p.name === 'Moon')
  const seventhHouse = birthChart.houses.find((h) => h.house === 7)

  // Create cache key
  const inputHash = hashInput({
    type: 'love',
    venusSign: venus?.sign,
    marsSign: mars?.sign,
    moonSign: moon?.sign,
    seventhHouseSign: seventhHouse?.sign,
    userName,
  })
  const cacheKey = cacheKeys.aiResponse('love-horoscope', inputHash)

  // Check cache first
  const cached = await cache.get<{ title: string; content: string }>(cacheKey)
  if (cached) {
    logger.debug({ cacheKey, type: 'love-horoscope' }, 'AI response cache hit')
    return cached
  }

  const prompt = `You are an expert astrologer. Generate a detailed love and relationship horoscope for ${userName || 'this person'}.

Birth Chart Love Indicators:
- Venus (love style): ${venus?.sign || 'Unknown'}${venus?.house ? ` in House ${venus.house}` : ''}
- Mars (passion/drive): ${mars?.sign || 'Unknown'}${mars?.house ? ` in House ${mars.house}` : ''}
- Moon (emotional needs): ${moon?.sign || 'Unknown'}${moon?.house ? ` in House ${moon.house}` : ''}
- 7th House (partnerships): ${seventhHouse?.sign || 'Unknown'}

Venus Aspects:
${birthChart.aspects
  .filter((a) => a.planet1 === 'Venus' || a.planet2 === 'Venus')
  .map((a) => `- ${a.planet1} ${a.type} ${a.planet2}`)
  .join('\n') || 'No major Venus aspects'}

Provide:
1. Their love nature and what they seek in relationships
2. Current romantic energies and transits
3. Advice for singles vs. those in relationships
4. Compatibility insights based on their chart
5. Growth opportunities in love

Make it insightful and around 450 words.`

  const provider = await getAIProvider()
  const content = await provider.complete({
    messages: [{ role: 'user', content: prompt }],
    system: 'You are an expert astrologer providing love and relationship horoscope readings based on birth charts.',
    maxTokens: 1024,
  })

  const result = {
    title: `Love & Relationship Horoscope for ${userName || 'You'}`,
    content: content || 'Unable to generate reading at this time.',
  }

  // Cache for 24 hours
  await cache.set(cacheKey, result, DEFAULT_TTLS.AI_RESPONSE)
  logger.debug({ cacheKey, type: 'love-horoscope' }, 'AI response cached')

  return result
}

/**
 * Generate a career horoscope
 * Caches results for 24 hours
 */
export async function generateCareerHoroscope(
  birthChart: BirthChartData,
  userName: string | null
): Promise<{ title: string; content: string }> {
  const sun = birthChart.planets.find((p) => p.name === 'Sun')
  const saturn = birthChart.planets.find((p) => p.name === 'Saturn')
  const tenthHouse = birthChart.houses.find((h) => h.house === 10)
  const sixthHouse = birthChart.houses.find((h) => h.house === 6)

  // Create cache key
  const inputHash = hashInput({
    type: 'career',
    sunSign: sun?.sign,
    sunHouse: sun?.house,
    saturnSign: saturn?.sign,
    tenthHouseSign: tenthHouse?.sign,
    sixthHouseSign: sixthHouse?.sign,
    userName,
  })
  const cacheKey = cacheKeys.aiResponse('career-horoscope', inputHash)

  // Check cache first
  const cached = await cache.get<{ title: string; content: string }>(cacheKey)
  if (cached) {
    logger.debug({ cacheKey, type: 'career-horoscope' }, 'AI response cache hit')
    return cached
  }

  const prompt = `You are an expert astrologer. Generate a detailed career and professional horoscope for ${userName || 'this person'}.

Birth Chart Career Indicators:
- Sun (core purpose): ${sun?.sign || 'Unknown'}${sun?.house ? ` in House ${sun.house}` : ''}
- Saturn (discipline/career): ${saturn?.sign || 'Unknown'}${saturn?.house ? ` in House ${saturn.house}` : ''}
- 10th House (public career): ${tenthHouse?.sign || 'Unknown'}
- 6th House (daily work): ${sixthHouse?.sign || 'Unknown'}

Relevant Aspects:
${birthChart.aspects
  .filter((a) => ['Sun', 'Saturn', 'Mars', 'Jupiter'].includes(a.planet1) || ['Sun', 'Saturn', 'Mars', 'Jupiter'].includes(a.planet2))
  .map((a) => `- ${a.planet1} ${a.type} ${a.planet2}`)
  .join('\n') || 'No major career aspects'}

Provide a detailed career reading with:
1. Natural career strengths and suitable professions
2. Current professional climate and opportunities
3. Challenges to be aware of
4. Timing for important career moves
5. Advice for professional growth

Write in a warm, insightful tone. Around 450 words.`

  const provider = await getAIProvider()
  const content = await provider.complete({
    messages: [{ role: 'user', content: prompt }],
    system: 'You are an expert astrologer providing career guidance based on birth charts.',
    maxTokens: 1024,
  })

  const result = {
    title: `Career & Professional Horoscope for ${userName || 'You'}`,
    content: content || 'Unable to generate reading at this time.',
  }

  // Cache for 24 hours
  await cache.set(cacheKey, result, DEFAULT_TTLS.AI_RESPONSE)
  logger.debug({ cacheKey, type: 'career-horoscope' }, 'AI response cached')

  return result
}

/**
 * Generate a compatibility (synastry) reading
 * Caches results for 24 hours
 */
export async function generateCompatibilityReading(
  chart1: BirthChartData,
  chart2: BirthChartData,
  person1Name: string,
  person2Name: string
): Promise<{ title: string; content: string }> {
  // Create cache key from both charts and names
  const inputHash = hashInput({
    type: 'compatibility',
    person1Name,
    person2Name,
    chart1Planets: chart1.planets.map(p => ({ name: p.name, sign: p.sign })),
    chart2Planets: chart2.planets.map(p => ({ name: p.name, sign: p.sign })),
  })
  const cacheKey = cacheKeys.aiResponse('compatibility', inputHash)

  // Check cache first
  const cached = await cache.get<{ title: string; content: string }>(cacheKey)
  if (cached) {
    logger.debug({ cacheKey, type: 'compatibility' }, 'AI response cache hit')
    return cached
  }

  const person1Sun = chart1.planets.find((p) => p.name === 'Sun')?.sign
  const person1Moon = chart1.planets.find((p) => p.name === 'Moon')?.sign
  const person1Venus = chart1.planets.find((p) => p.name === 'Venus')?.sign
  const person1Mars = chart1.planets.find((p) => p.name === 'Mars')?.sign
  const person1Ascendant = (chart1 as any).ascendant?.sign || chart1.houses[0]?.sign || 'Unknown'

  const person2Sun = chart2.planets.find((p) => p.name === 'Sun')?.sign
  const person2Moon = chart2.planets.find((p) => p.name === 'Moon')?.sign
  const person2Venus = chart2.planets.find((p) => p.name === 'Venus')?.sign
  const person2Mars = chart2.planets.find((p) => p.name === 'Mars')?.sign
  const person2Ascendant = (chart2 as any).ascendant?.sign || chart2.houses[0]?.sign || 'Unknown'

  const prompt = `Generate a detailed compatibility (synastry) reading between ${person1Name} and ${person2Name}.

${person1Name}'s Chart:
- Sun: ${person1Sun}, Moon: ${person1Moon}, Venus: ${person1Venus}, Mars: ${person1Mars}, Ascendant: ${person1Ascendant}

${person2Name}'s Chart:
- Sun: ${person2Sun}, Moon: ${person2Moon}, Venus: ${person2Venus}, Mars: ${person2Mars}, Ascendant: ${person2Ascendant}

Please provide:
1. Overall compatibility assessment
2. Sun-Moon dynamics (emotional compatibility)
3. Venus-Mars chemistry (romantic/physical attraction)
4. Communication and intellectual connection
5. Long-term potential and growth areas
6. Specific advice for this pairing

Be honest but constructive. Highlight both strengths and challenges. Around 500 words.`

  const provider = await getAIProvider()
  const content = await provider.complete({
    messages: [{ role: 'user', content: prompt }],
    system: ASTROLOGY_SYSTEM_PROMPT,
    maxTokens: 1500,
  })

  const result = {
    title: `Compatibility Reading: ${person1Name} & ${person2Name}`,
    content: content || 'Unable to generate reading at this time.',
  }

  // Cache for 24 hours
  await cache.set(cacheKey, result, DEFAULT_TTLS.AI_RESPONSE)
  logger.debug({ cacheKey, type: 'compatibility' }, 'AI response cached')

  return result
}

/**
 * Chat with the astrology AI - Handles conversational flow
 * Caches responses for frequently asked questions
 */
export async function chatWithAstrologer(
  birthChart: BirthChartData | null,
  userMessage: string,
  conversationHistory: { role: 'user' | 'assistant' | 'system'; content: string }[] = [],
  userData?: { name?: string; birthDate?: string; birthTime?: string; birthPlace?: string }
): Promise<string> {
  // Check if this is the start of a new conversation
  const isNewConversation = conversationHistory.length === 0 || !userData?.name

  if (isNewConversation && !userData?.name) {
    // First message - greet and ask for info
    const provider = await getAIProvider()
    return await provider.complete({
      messages: [{ role: 'user', content: userMessage }],
      system: `${ASTROLOGY_SYSTEM_PROMPT}\n\nStart by greeting the user and asking for their information using this template:\n\n${INITIAL_GREETING_PROMPT}`,
      maxTokens: 500,
    })
  }

  // If we have name but not full birth details, ask for remaining info
  if (userData?.name && (!userData?.birthDate || !userData?.birthTime || !userData?.birthPlace)) {
    const missingInfo = []
    if (!userData?.birthDate) missingInfo.push('date of birth')
    if (!userData?.birthTime) missingInfo.push('time of birth')
    if (!userData?.birthPlace) missingInfo.push('place of birth')

    const provider = await getAIProvider()
    return await provider.complete({
      messages: [
        ...conversationHistory.slice(-10) as { role: 'user' | 'assistant' | 'system'; content: string }[],
        { role: 'user', content: userMessage },
      ],
      system: `${ASTROLOGY_SYSTEM_PROMPT}\n\nYou have the user's name: ${userData.name}\n\nYou still need: ${missingInfo.join(', ')}\n\nPolitely ask for the missing information in a friendly, conversational way. Once you have all details, you can provide the full reading.`,
      maxTokens: 400,
    })
  }

  // We have all info and birth chart - provide full reading
  if (birthChart && userData?.name) {
    const sunSign = birthChart.planets.find((p) => p.name === 'Sun')?.sign || 'Unknown'
    const moonSign = birthChart.planets.find((p) => p.name === 'Moon')?.sign || 'Unknown'
    const ascendant = (birthChart as any).ascendant?.sign || birthChart.houses[0]?.sign || 'Unknown'

    // Check for cached response for this specific question
    const inputHash = hashInput({
      type: 'chat',
      userMessage,
      sunSign,
      moonSign,
      ascendant,
    })
    const cacheKey = cacheKeys.aiResponse('chat', inputHash)

    const cached = await cache.get<string>(cacheKey)
    if (cached) {
      logger.debug({ cacheKey, type: 'chat' }, 'AI chat response cache hit')
      return cached
    }

    const chartSummary = `${userData.name}'s Birth Chart:
- Sun: ${sunSign}
- Moon: ${moonSign}
- Ascendant: ${ascendant}
- Birth Date: ${userData.birthDate}
- Birth Time: ${userData.birthTime}
- Birth Place: ${userData.birthPlace}
- Key aspects: ${birthChart.aspects.slice(0, 5).map((a) => `${a.planet1} ${a.type} ${a.planet2}`).join(', ') || 'None calculated'}`

    const readingPrompt = `Provide a comprehensive, personalized astrology reading for ${userData.name}.

${chartSummary}

Please provide:
1. A warm opening that addresses ${userData.name} personally
2. Interpret their Sun sign - core personality and life purpose
3. Interpret their Moon sign - emotional nature and inner self
4. Interpret their Ascendant - how they appear to others
5. Highlight key planetary positions and aspects
6. Practical guidance for their life path
7. Invite them to ask follow-up questions

Make it feel like a real conversation - warm, insightful, and personally tailored to ${userData.name}. Around 500-700 words.`

    const provider = await getAIProvider()
    const response = await provider.complete({
      messages: [
        ...conversationHistory.slice(-10) as { role: 'user' | 'assistant' | 'system'; content: string }[],
        { role: 'user', content: userMessage },
      ],
      system: `${ASTROLOGY_SYSTEM_PROMPT}\n\n${readingPrompt}`,
      maxTokens: 1500,
    })

    const result = response || 'I apologize, but I am unable to provide a reading at this time.'

    // Cache chat responses (shorter TTL for conversational responses)
    await cache.set(cacheKey, result, DEFAULT_TTLS.SHORT)
    logger.debug({ cacheKey, type: 'chat' }, 'AI chat response cached')

    return result
  }

  // Fallback - continue conversation
  const provider = await getAIProvider()
  return await provider.complete({
    messages: [
      ...conversationHistory.slice(-10) as { role: 'user' | 'assistant' | 'system'; content: string }[],
      { role: 'user', content: userMessage },
    ],
    system: ASTROLOGY_SYSTEM_PROMPT,
    maxTokens: 1024,
  })
}
