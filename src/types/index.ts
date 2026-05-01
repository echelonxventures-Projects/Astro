export interface PlanetPosition {
  name: string
  longitude: number
  latitude: number
  speed: number
  sign: string
  degree: number
  house?: number
}

export interface HouseCusp {
  house: number
  longitude: number
  sign: string
  degree: number
}

export interface Aspect {
  planet1: string
  planet2: string
  type: string // conjunction, opposition, trine, square, sextile
  angle: number
  orb: number
}

export interface BirthChartData {
  planets: PlanetPosition[]
  houses: HouseCusp[]
  aspects: Aspect[]
  ascendant: { sign: string; degree: number }
  midheaven: { sign: string; degree: number }
}

export interface AstrologyReading {
  type: 'daily' | 'love' | 'career' | 'compatibility' | 'natal' | 'transit'
  title: string
  content: string
  generatedAt: Date
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
}
