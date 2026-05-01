import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST as chartPostHandler, GET as chartGetHandler } from '../astrology/chart/route'

// Mock dependencies
const mockCreate = vi.fn()
const mockFindMany = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    birthChart: {
      create: (...args: any[]) => mockCreate(...args),
      findMany: (...args: any[]) => mockFindMany(...args)
    }
  }
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn()
  }
}))

vi.mock('@/lib/auth', () => ({
  auth: vi.fn()
}))

vi.mock('@/lib/astrology/calculations', () => ({
  generateBirthChart: vi.fn()
}))

const { auth } = await import('@/lib/auth')
const { generateBirthChart } = await import('@/lib/astrology/calculations')

function createRequest(body?: unknown, method = 'POST'): NextRequest {
  return {
    json: () => Promise.resolve(body),
    method
  } as NextRequest
}

describe('Chart API', () => {
  const mockUser = { id: 'user-123', email: 'test@example.com' }
  const mockChartData = {
    planets: [{ name: 'Sun', sign: 'Leo', degree: 15.5 }],
    houses: [{ number: 1, sign: 'Aries' }],
    aspects: [{ name: 'Sun-Moon', angle: 120 }]
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockCreate.mockReset()
    mockFindMany.mockReset()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('POST /api/astrology/chart', () => {
    it('should require authentication', async () => {
      ;(auth as any).mockResolvedValue(null)

      const request = createRequest({
        birthDate: '1990-01-01',
        birthTime: '12:30',
        latitude: 40.7128,
        longitude: -74.006
      })

      const response = await chartPostHandler(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should create chart with valid data', async () => {
      ;(auth as any).mockResolvedValue({ user: mockUser })
      ;(generateBirthChart as any).mockReturnValue(mockChartData)

      mockCreate.mockResolvedValue({
        id: 'chart-123',
        userId: mockUser.id,
        name: 'My Birth Chart',
        birthDate: new Date('1990-01-01'),
        birthTime: '12:30',
        birthPlace: 'New York',
        latitude: 40.7128,
        longitude: -74.006,
        timezone: 'America/New_York',
        planets: mockChartData.planets,
        houses: mockChartData.houses,
        aspects: mockChartData.aspects
      })

      const request = createRequest({
        name: 'My Birth Chart',
        birthDate: '1990-01-01',
        birthTime: '12:30',
        birthPlace: 'New York',
        latitude: 40.7128,
        longitude: -74.006,
        timezone: 'America/New_York'
      })

      const response = await chartPostHandler(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.id).toBe('chart-123')
      expect(data.planets).toEqual(mockChartData.planets)
    })

    it('should validate required fields', async () => {
      ;(auth as any).mockResolvedValue({ user: mockUser })

      const request = createRequest({
        name: 'My Chart'
        // Missing birthDate, birthTime, latitude, longitude
      })

      const response = await chartPostHandler(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Missing required fields')
    })

    it('should validate missing birthDate', async () => {
      ;(auth as any).mockResolvedValue({ user: mockUser })

      const request = createRequest({
        birthTime: '12:30',
        latitude: 40.7128,
        longitude: -74.006
      })

      const response = await chartPostHandler(request)

      expect(response.status).toBe(400)
    })

    it('should validate missing latitude/longitude', async () => {
      ;(auth as any).mockResolvedValue({ user: mockUser })

      const request = createRequest({
        birthDate: '1990-01-01',
        birthTime: '12:30'
      })

      const response = await chartPostHandler(request)

      expect(response.status).toBe(400)
    })

    it('should handle chart generation errors', async () => {
      ;(auth as any).mockResolvedValue({ user: mockUser })
      ;(generateBirthChart as any).mockImplementation(() => {
        throw new Error('Invalid coordinates')
      })

      const request = createRequest({
        name: 'My Chart',
        birthDate: '1990-01-01',
        birthTime: '12:30',
        birthPlace: 'Test',
        latitude: 999, // Invalid
        longitude: -74.006,
        timezone: 'UTC'
      })

      const response = await chartPostHandler(request)

      expect(response.status).toBe(500)
    })

    it('should use UTC as default timezone', async () => {
      ;(auth as any).mockResolvedValue({ user: mockUser })
      ;(generateBirthChart as any).mockReturnValue(mockChartData)
      mockCreate.mockResolvedValue({ id: 'chart-123' })

      const request = createRequest({
        name: 'My Chart',
        birthDate: '1990-01-01',
        birthTime: '12:30',
        birthPlace: 'Unknown',
        latitude: 0,
        longitude: 0
      })

      await chartPostHandler(request)

      expect(generateBirthChart).toHaveBeenCalledWith(
        expect.any(Date),
        '12:30',
        'Unknown',
        0,
        0,
        'UTC'
      )
    })
  })

  describe('GET /api/astrology/chart', () => {
    it('should require authentication', async () => {
      ;(auth as any).mockResolvedValue(null)

      const request = createRequest(undefined, 'GET')

      const response = await chartGetHandler(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should return user charts', async () => {
      ;(auth as any).mockResolvedValue({ user: mockUser })

      const mockCharts = [
        { id: 'chart-1', name: 'Chart 1', createdAt: new Date('2024-01-01') },
        { id: 'chart-2', name: 'Chart 2', createdAt: new Date('2024-01-02') }
      ]

      mockFindMany.mockResolvedValue(mockCharts)

      const request = createRequest(undefined, 'GET')

      const response = await chartGetHandler(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.charts).toHaveLength(2)
      expect(data.charts[0].id).toBe('chart-1')
    })

    it('should return empty array when no charts exist', async () => {
      ;(auth as any).mockResolvedValue({ user: mockUser })
      mockFindMany.mockResolvedValue([])

      const request = createRequest(undefined, 'GET')

      const response = await chartGetHandler(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.charts).toEqual([])
    })

    it('should order charts by createdAt desc', async () => {
      ;(auth as any).mockResolvedValue({ user: mockUser })
      mockFindMany.mockResolvedValue([])

      const request = createRequest(undefined, 'GET')

      await chartGetHandler(request)

      expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({
        orderBy: { createdAt: 'desc' }
      }))
    })

    it('should filter by userId', async () => {
      ;(auth as any).mockResolvedValue({ user: mockUser })
      mockFindMany.mockResolvedValue([])

      const request = createRequest(undefined, 'GET')

      await chartGetHandler(request)

      expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { userId: mockUser.id }
      }))
    })
  })
})
