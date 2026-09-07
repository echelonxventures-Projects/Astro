/**
 * Astrology Calculation Engine
 * Calculates planetary positions, houses, and aspects based on birth data
 */

// Zodiac signs
export const ZODIAC_SIGNS = [
  'Aries',
  'Taurus',
  'Gemini',
  'Cancer',
  'Leo',
  'Virgo',
  'Libra',
  'Scorpio',
  'Sagittarius',
  'Capricorn',
  'Aquarius',
  'Pisces',
]

// Planet names
export const PLANETS = [
  'Sun',
  'Moon',
  'Mercury',
  'Venus',
  'Mars',
  'Jupiter',
  'Saturn',
  'Uranus',
  'Neptune',
  'Pluto',
]

// Aspect types with their angles and orbs
export const ASPECTS = {
  conjunction: { angle: 0, orb: 8 },
  sextile: { angle: 60, orb: 6 },
  square: { angle: 90, orb: 8 },
  trine: { angle: 120, orb: 8 },
  opposition: { angle: 180, orb: 8 },
}

/**
 * Convert degrees to zodiac sign and degree within sign
 */
export function degreesToSign(degrees: number): { sign: string; degree: number } {
  const normalizedDegrees = ((degrees % 360) + 360) % 360
  const signIndex = Math.floor(normalizedDegrees / 30)
  const degreeInSign = normalizedDegrees % 30
  return {
    sign: ZODIAC_SIGNS[signIndex],
    degree: degreeInSign,
  }
}

/**
 * Calculate the Julian Day Number from a date
 */
export function dateToJulianDay(year: number, month: number, day: number): number {
  const a = Math.floor((14 - month) / 12)
  const y = year + 4800 - a
  const m = month + 12 * a - 3
  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  )
}

/**
 * Calculate planetary longitude using simplified ephemeris
 * This is a simplified calculation - for production, use Swiss Ephemeris
 */
export function calculatePlanetLongitude(
  planet: string,
  julianDay: number,
  birthTime: string
): number {
  // Convert birth time to decimal hours
  const [hours, minutes] = birthTime.split(':').map(Number)
  const timeFraction = (hours + minutes / 60) / 24

  // Days since J2000 epoch (January 1, 2000, 12:00 TT)
  const J2000 = 2451545.0
  const daysSinceJ2000 = julianDay + timeFraction - J2000

  // Mean longitude calculations (simplified)
  // These are approximate formulas for educational purposes
  const T = daysSinceJ2000 / 36525 // Julian centuries

  switch (planet) {
    case 'Sun': {
      // Sun's mean longitude
      const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T
      return normalizeDegrees(L0)
    }
    case 'Moon': {
      // Moon's mean longitude (faster movement)
      const L = 218.3164477 + 481267.88123421 * T - 0.0015786 * T * T
      return normalizeDegrees(L)
    }
    case 'Mercury': {
      const L = 252.2509055 + 149472.6741117 * T + 0.0003938 * T * T
      return normalizeDegrees(L)
    }
    case 'Venus': {
      const L = 181.9797995 + 21066.9106391 * T + 0.0002916 * T * T
      return normalizeDegrees(L)
    }
    case 'Mars': {
      const L = 355.4332755 + 19140.2993127 * T + 0.0000236 * T * T
      return normalizeDegrees(L)
    }
    case 'Jupiter': {
      const L = 34.3515187 + 3034.9057289 * T - 0.0000928 * T * T
      return normalizeDegrees(L)
    }
    case 'Saturn': {
      const L = 50.0774714 + 1222.1137941 * T - 0.0001663 * T * T
      return normalizeDegrees(L)
    }
    case 'Uranus': {
      const L = 314.0550051 + 428.4669983 * T + 0.0003082 * T * T
      return normalizeDegrees(L)
    }
    case 'Neptune': {
      const L = 304.3486655 + 218.4862002 * T + 0.0000717 * T * T
      return normalizeDegrees(L)
    }
    case 'Pluto': {
      const L = 238.958956 + 145.2078051 * T + 0.0001197 * T * T
      return normalizeDegrees(L)
    }
    default:
      return 0
  }
}

/**
 * Normalize degrees to 0-360 range
 */
export function normalizeDegrees(degrees: number): number {
  return ((degrees % 360) + 360) % 360
}

/**
 * Calculate Ascendant (Rising Sign) using simplified formula
 */
export function calculateAscendant(
  latitude: number,
  longitude: number,
  date: Date,
  time: string
): { longitude: number; sign: string; degree: number } {
  // Simplified sidereal time calculation
  const [hours, minutes] = time.split(':').map(Number)

  // Calculate Local Sidereal Time (simplified)
  const UT = hours + minutes / 60
  const dayOfYear = Math.floor(
    (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000
  )

  // Approximate GST at 0h UT
  let GST = 6.6563298 + 0.0657098242 * dayOfYear + UT
  GST = GST % 24

  // Local Sidereal Time
  const LST = (GST + longitude / 15) % 24

  // Convert to degrees
  const LSTDegrees = LST * 15

  // Simplified Ascendant calculation (actual formula is more complex)
  const RAMC = LSTDegrees // Right Ascension of Midheaven
  const epsilon = 23.44 // Obliquity of ecliptic

  // Ascendant formula (simplified)
  const tanASC =
    -Math.cos((Math.PI * RAMC) / 180) /
    (Math.sin((Math.PI * RAMC) / 180) * Math.cos((Math.PI * latitude) / 180) +
      Math.tan((Math.PI * epsilon) / 180) * Math.sin((Math.PI * latitude) / 180))

  let ascendant = (Math.atan(tanASC) * 180) / Math.PI

  // Adjust quadrant
  if (RAMC >= 0 && RAMC < 180) {
    ascendant += 180
  } else if (ascendant < 0) {
    ascendant += 360
  }

  return {
    longitude: normalizeDegrees(ascendant),
    ...degreesToSign(ascendant),
  }
}

/**
 * Calculate Midheaven (MC)
 */
export function calculateMidheaven(
  latitude: number,
  longitude: number,
  date: Date,
  time: string
): { longitude: number; sign: string; degree: number } {
  const [hours, minutes] = time.split(':').map(Number)

  const UT = hours + minutes / 60
  const dayOfYear = Math.floor(
    (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000
  )

  let GST = 6.6563298 + 0.0657098242 * dayOfYear + UT
  GST = GST % 24

  const LST = (GST + longitude / 15) % 24
  const LSTDegrees = LST * 15

  const epsilon = 23.44
  const tanMC = Math.tan((Math.PI * LSTDegrees) / 180) / Math.cos((Math.PI * epsilon) / 180)

  let mc = (Math.atan(tanMC) * 180) / Math.PI

  if (LSTDegrees >= 0 && LSTDegrees < 180) {
    // Keep as is
  } else if (mc < 0) {
    mc += 180
  }

  // Adjust for quadrant
  if (LSTDegrees >= 180 && LSTDegrees < 270 && mc >= 0 && mc < 90) {
    mc += 180
  } else if (LSTDegrees >= 270 && mc >= 0 && mc < 90) {
    mc += 180
  }

  return {
    longitude: normalizeDegrees(mc),
    ...degreesToSign(mc),
  }
}

/**
 * Calculate house cusps using Equal House system (simplified)
 */
export function calculateHouses(
  ascendant: number
): { house: number; longitude: number; sign: string; degree: number }[] {
  const houses: { house: number; longitude: number; sign: string; degree: number }[] = []

  for (let i = 0; i < 12; i++) {
    const houseLongitude = normalizeDegrees(ascendant + i * 30)
    houses.push({
      house: i + 1,
      longitude: houseLongitude,
      ...degreesToSign(houseLongitude),
    })
  }

  return houses
}

/**
 * Calculate aspects between planets
 */
export function calculateAspects(
  planets: { name: string; longitude: number }[]
): { planet1: string; planet2: string; type: string; angle: number; orb: number }[] {
  const aspects: { planet1: string; planet2: string; type: string; angle: number; orb: number }[] =
    []

  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      const p1 = planets[i]
      const p2 = planets[j]

      let angle = Math.abs(p1.longitude - p2.longitude)
      if (angle > 180) {
        angle = 360 - angle
      }

      // Check for each aspect type
      for (const [aspectName, { angle: targetAngle, orb }] of Object.entries(ASPECTS)) {
        const orbDifference = Math.abs(angle - targetAngle)
        if (orbDifference <= orb) {
          aspects.push({
            planet1: p1.name,
            planet2: p2.name,
            type: aspectName,
            angle: targetAngle,
            orb: orbDifference,
          })
        }
      }
    }
  }

  return aspects
}

/**
 * Generate complete birth chart data
 */
export function generateBirthChart(
  birthDate: Date,
  birthTime: string,
  birthPlace: string,
  latitude: number,
  longitude: number,
  _timezone: string
): {
  planets: {
    name: string
    longitude: number
    latitude: number
    speed: number
    sign: string
    degree: number
    house?: number
  }[]
  houses: { house: number; longitude: number; sign: string; degree: number }[]
  aspects: { planet1: string; planet2: string; type: string; angle: number; orb: number }[]
  ascendant: { sign: string; degree: number }
  midheaven: { sign: string; degree: number }
} {
  const year = birthDate.getFullYear()
  const month = birthDate.getMonth() + 1
  const day = birthDate.getDate()

  const julianDay = dateToJulianDay(year, month, day)

  // Calculate planetary positions
  const planets = PLANETS.map(planet => {
    const longitude = calculatePlanetLongitude(planet, julianDay, birthTime)
    const signData = degreesToSign(longitude)
    return {
      name: planet,
      longitude,
      latitude: 0, // Simplified
      speed: 0, // Simplified
      ...signData,
    }
  })

  // Calculate angles
  const ascendant = calculateAscendant(latitude, longitude, birthDate, birthTime)
  const midheaven = calculateMidheaven(latitude, longitude, birthDate, birthTime)

  // Calculate houses
  const houses = calculateHouses(ascendant.longitude)

  // Assign houses to planets
  planets.forEach(planet => {
    for (let i = 0; i < houses.length; i++) {
      const currentHouse = houses[i]
      const nextHouse = houses[(i + 1) % 12]

      const houseStart = currentHouse.longitude
      const houseEnd = nextHouse.longitude

      if (houseEnd < houseStart) {
        if (planet.longitude >= houseStart || planet.longitude < houseEnd) {
          ;(planet as any).house = i + 1
          break
        }
      } else {
        if (planet.longitude >= houseStart && planet.longitude < houseEnd) {
          ;(planet as any).house = i + 1
          break
        }
      }
    }
  })

  // Calculate aspects
  const aspects = calculateAspects(planets)

  return {
    planets,
    houses,
    aspects,
    ascendant: { sign: ascendant.sign, degree: ascendant.degree },
    midheaven: { sign: midheaven.sign, degree: midheaven.degree },
  }
}
