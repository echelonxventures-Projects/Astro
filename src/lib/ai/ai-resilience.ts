import { logger } from '../logger';
import { CircuitBreaker, getCircuitBreakerForAI } from '../resilience/circuit-breaker';
import { withRetry, RetryPresets } from '../resilience/retry';
import { withFallback, withGracefulDegradation, FallbackValues } from '../resilience/fallback';
import { withTimeout, TimeoutPresets } from '../resilience/timeout';
import { getBulkheadForAI } from '../resilience/bulkhead';

export interface AIResilienceConfig {
  provider: string;
  enableCircuitBreaker?: boolean;
  enableRetry?: boolean;
  enableTimeout?: boolean;
  enableBulkhead?: boolean;
  enableFallback?: boolean;
}

/**
 * Execute an AI request with full resilience patterns
 */
export async function resilientAIRequest<T>(
  provider: string,
  requestFn: () => Promise<T>,
  config: Partial<AIResilienceConfig> = {}
): Promise<T> {
  const fullConfig: AIResilienceConfig = {
    provider,
    enableCircuitBreaker: true,
    enableRetry: true,
    enableTimeout: true,
    enableBulkhead: true,
    enableFallback: true,
    ...config
  };

  let operation = requestFn;

  // Apply bulkhead (limit concurrent AI requests)
  if (fullConfig.enableBulkhead) {
    const bulkhead = getBulkheadForAI(provider);
    const originalFn = operation;
    operation = () => bulkhead.execute(originalFn);
  }

  // Apply circuit breaker
  if (fullConfig.enableCircuitBreaker) {
    const breaker = getCircuitBreakerForAI(provider);
    const originalFn = operation;
    operation = () => breaker.execute(originalFn);
  }

  // Apply retry
  if (fullConfig.enableRetry) {
    const originalFn = operation;
    operation = () => withRetry(originalFn, RetryPresets.aiService);
  }

  // Apply timeout
  if (fullConfig.enableTimeout) {
    const originalFn = operation;
    operation = () => withTimeout(originalFn(), TimeoutPresets.aiService);
  }

  return await operation();
}

/**
 * Generate horoscope with graceful degradation
 */
export interface HoroscopeParams {
  chartData: {
    sunSign: string;
    moonSign?: string;
    risingSign?: string;
    houses?: Record<string, number>;
  };
  date: Date;
  type: 'daily' | 'weekly' | 'monthly';
  focus?: string;
}

export interface HoroscopeResult {
  title: string;
  content: string;
  insights?: string[];
  planetaryInfluences?: Array<{
    planet: string;
    aspect: string;
    effect: string;
  }>;
  confidence?: number;
}

export async function generateHoroscopeSafe(
  params: HoroscopeParams,
  generateFn: (params: HoroscopeParams) => Promise<HoroscopeResult>
): Promise<HoroscopeResult> {
  return withGracefulDegradation(
    () => generateFn(params),
    (error) => {
      logger.warn('AI horoscope generation failed, using graceful degradation', {
        error: error.message,
        params
      });

      const sunSign = params.chartData?.sunSign || 'general';
      return getGenericHoroscope(sunSign, params.type);
    }
  );
}

/**
 * Generate natal chart with graceful degradation
 */
export interface NatalChartParams {
  birthDate: Date;
  birthTime?: string;
  birthLocation: {
    latitude: number;
    longitude: number;
    timezone: string;
  };
}

export interface NatalChartResult {
  planets: Record<string, {
    sign: string;
    degree: number;
    house: number;
    retrograde?: boolean;
  }>;
  houses: Record<number, {
    sign: string;
    degree: number;
  }>;
  aspects: Array<{
    planet1: string;
    planet2: string;
    aspect: string;
    orb: number;
  }>;
  interpretation?: string;
}

export async function generateNatalChartSafe(
  params: NatalChartParams,
  generateFn: (params: NatalChartParams) => Promise<NatalChartResult>
): Promise<NatalChartResult> {
  return withGracefulDegradation(
    () => generateFn(params),
    (error) => {
      logger.warn('AI natal chart generation failed, using graceful degradation', {
        error: error.message,
        params
      });

      return getGenericNatalChart(params);
    }
  );
}

/**
 * Generate compatibility analysis with graceful degradation
 */
export interface CompatibilityParams {
  person1: {
    sunSign: string;
    moonSign?: string;
    venusSign?: string;
  };
  person2: {
    sunSign: string;
    moonSign?: string;
    venusSign?: string;
  };
  relationshipType?: 'romantic' | 'friendship' | 'professional';
}

export interface CompatibilityResult {
  compatibility: number;
  summary: string;
  strengths: string[];
  challenges: string[];
  advice: string[];
}

export async function generateCompatibilitySafe(
  params: CompatibilityParams,
  generateFn: (params: CompatibilityParams) => Promise<CompatibilityResult>
): Promise<CompatibilityResult> {
  return withGracefulDegradation(
    () => generateFn(params),
    (error) => {
      logger.warn('AI compatibility generation failed, using graceful degradation', {
        error: error.message,
        params
      });

      return getGenericCompatibility(params);
    }
  );
}

/**
 * Generate transit analysis with graceful degradation
 */
export interface TransitParams {
  natalChart: NatalChartResult;
  startDate: Date;
  endDate: Date;
}

export interface TransitResult {
  transits: Array<{
    planet: string;
    aspect: string;
    natalPlanet: string;
    date: Date;
    effect: string;
  }>;
  summary: string;
  recommendations: string[];
}

export async function generateTransitSafe(
  params: TransitParams,
  generateFn: (params: TransitParams) => Promise<TransitResult>
): Promise<TransitResult> {
  return withGracefulDegradation(
    () => generateFn(params),
    (error) => {
      logger.warn('AI transit generation failed, using graceful degradation', {
        error: error.message,
        params
      });

      return getGenericTransit(params);
    }
  );
}

// Helper functions for graceful degradation

function getGenericHoroscope(sunSign: string, type: string): HoroscopeResult {
  const sign = sunSign.toLowerCase();
  const templates: Record<string, Record<string, HoroscopeResult>> = {
    daily: {
      aries: {
        title: 'Daily Guidance for Aries',
        content: 'Today brings opportunities for leadership and initiative. Your natural confidence serves you well. Focus on completing pending tasks while staying open to unexpected opportunities.',
        insights: ['Take the lead on important projects', 'Energy is high - channel it productively', 'Be mindful of impulsive decisions'],
        confidence: 0.6
      },
      taurus: {
        title: 'Daily Guidance for Taurus',
        content: 'Stability and patience are your allies today. Focus on practical matters and long-term goals. Your determination will help overcome any obstacles.',
        insights: ['Financial planning brings rewards', 'Stay grounded in decisions', 'Comfort comes from steady progress'],
        confidence: 0.6
      },
      gemini: {
        title: 'Daily Guidance for Gemini',
        content: 'Communication flows easily today. Your curiosity leads to interesting discoveries. Share ideas with others and remain flexible with changing plans.',
        insights: ['Great day for networking', 'Multiple interests call for attention', 'Adaptability is key'],
        confidence: 0.6
      }
    },
    weekly: {
      aries: {
        title: 'Weekly Outlook for Aries',
        content: 'This week emphasizes action and progress. Mars energy supports your initiatives. Balance assertiveness with diplomacy in relationships.',
        insights: ['Mid-week brings important opportunities', 'Physical activity enhances clarity', 'Collaboration yields better results'],
        confidence: 0.6
      }
    },
    monthly: {
      aries: {
        title: 'Monthly Overview for Aries',
        content: 'This month highlights personal growth and new beginnings. Your ruling planet Mars encourages bold moves while Saturn reminds you of responsibilities.',
        insights: ['New projects initiated now have lasting impact', 'Relationships deepen through honest communication', 'Health routines benefit from consistency'],
        confidence: 0.6
      }
    }
  };

  return templates[type]?.[sign] || {
    title: `Your ${type.charAt(0).toUpperCase() + type.slice(1)} Guidance`,
    content: FallbackValues.ai.genericHoroscope,
    confidence: 0.5
  };
}

function getGenericNatalChart(params: NatalChartParams): NatalChartResult {
  // Generate basic chart structure based on birth date
  const date = params.birthDate;
  const month = date.getMonth() + 1;
  const day = date.getDate();

  // Simple sun sign determination
  const sunSigns = ['capricorn', 'aquarius', 'pisces', 'aries', 'taurus', 'gemini',
                   'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius'];
  const sunSignIndex = Math.floor((month - 1 + (day / 30)) % 12);
  const sunSign = sunSigns[sunSignIndex];

  return {
    planets: {
      sun: { sign: sunSign, degree: (day % 30), house: 1 },
      moon: { sign: 'taurus', degree: 15, house: 2 },
      mercury: { sign: sunSign, degree: (day % 30) + 5, house: 1 },
      venus: { sign: 'pisces', degree: 20, house: 12 },
      mars: { sign: 'aries', degree: 10, house: 1 }
    },
    houses: {
      1: { sign: sunSign, degree: 0 },
      2: { sign: 'taurus', degree: 0 },
      3: { sign: 'gemini', degree: 0 },
      4: { sign: 'cancer', degree: 0 },
      5: { sign: 'leo', degree: 0 },
      6: { sign: 'virgo', degree: 0 }
    },
    aspects: []
  };
}

function getGenericCompatibility(params: CompatibilityParams): CompatibilityResult {
  const sign1 = params.person1.sunSign.toLowerCase();
  const sign2 = params.person2.sunSign.toLowerCase();

  // Element compatibility (simplified)
  const elements: Record<string, string> = {
    aries: 'fire', leo: 'fire', sagittarius: 'fire',
    taurus: 'earth', virgo: 'earth', capricorn: 'earth',
    gemini: 'air', libra: 'air', aquarius: 'air',
    cancer: 'water', scorpio: 'water', pisces: 'water'
  };

  const element1 = elements[sign1] || 'fire';
  const element2 = elements[sign2] || 'air';

  const compatibility = element1 === element2 ? 80 :
                       (element1 === 'fire' && element2 === 'air') ||
                       (element1 === 'air' && element2 === 'fire') ? 75 :
                       (element1 === 'earth' && element2 === 'water') ||
                       (element1 === 'water' && element2 === 'earth') ? 70 : 60;

  return {
    compatibility,
    summary: `${sign1.charAt(0).toUpperCase() + sign1.slice(1)} and ${sign2.charAt(0).toUpperCase() + sign2.slice(1)} share interesting dynamics. Your ${element1} and ${element2} elements create ${compatibility > 70 ? 'strong' : 'moderate'} compatibility.`,
    strengths: ['Complementary energies', 'Growth opportunities', 'Balance through differences'],
    challenges: ['Different approaches to life', 'Communication styles may differ', 'Need for compromise'],
    advice: ['Practice active listening', 'Respect individual needs', 'Find common ground']
  };
}

function getGenericTransit(params: TransitParams): TransitResult {
  return {
    transits: [
      {
        planet: 'jupiter',
        aspect: 'trine',
        natalPlanet: 'sun',
        date: new Date(),
        effect: 'Favorable period for expansion and growth'
      }
    ],
    summary: 'Current planetary movements suggest a period of steady progress. Focus on practical matters while remaining open to growth opportunities.',
    recommendations: ['Maintain steady routines', 'Stay open to learning', 'Balance work and rest']
  };
}

/**
 * Check if AI service is healthy
 */
export async function checkAIProviderHealth(provider: string): Promise<{
  healthy: boolean;
  circuitState: string;
  metrics: any;
}> {
  const breaker = getCircuitBreakerForAI(provider);

  return {
    healthy: breaker.getState() === 'closed',
    circuitState: breaker.getState(),
    metrics: breaker.getMetrics()
  };
}
