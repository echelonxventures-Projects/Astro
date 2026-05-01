import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock rate-limiter-flexible
const mockConsume = vi.fn()
const mockGet = vi.fn()
const mockDelete = vi.fn()

vi.mock('rate-limiter-flexible', () => ({
  RateLimiterMemory: vi.fn().mockImplementation(() => ({
    consume: mockConsume,
    get: mockGet,
    delete: mockDelete
  })),
  RateLimiterRedis: vi.fn().mockImplementation(() => ({
    consume: mockConsume,
    get: mockGet,
    delete: mockDelete
  }))
}))

// Import the module after mocking
const rateLimiter = await import('../rate-limiter')
const { RATE_LIMIT_TIERS } = await import('../security')

describe('Rate Limiter', () => {
  const testIdentifier = 'user-123'
  const {
    checkRateLimit,
    checkRateLimitForPath,
    getRateLimitHeaders,
    penalizeClient,
    resetRateLimit,
    getRateLimitStatus
  } = rateLimiter

  beforeEach(() => {
    vi.clearAllMocks()
    mockConsume.mockReset()
    mockGet.mockReset()
    mockDelete.mockReset()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('checkRateLimit', () => {
    it('should allow request when under limit', async () => {
      mockConsume.mockResolvedValue({
        remainingPoints: 99,
        msBeforeNext: 60000
      })

      const result = await checkRateLimit(testIdentifier, 'default')

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(99)
      expect(result.limit).toBe(RATE_LIMIT_TIERS.default.points)
      expect(mockConsume).toHaveBeenCalledWith(testIdentifier)
    })

    it('should block request when limit exceeded', async () => {
      mockConsume.mockRejectedValue({
        msBeforeNext: 30000
      })

      const result = await checkRateLimit(testIdentifier, 'default')

      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
      expect(result.retryAfter).toBe(30)
    })

    it('should handle unknown errors gracefully', async () => {
      mockConsume.mockRejectedValue(new Error('Unknown error'))

      const result = await checkRateLimit(testIdentifier, 'default')

      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
      expect(result.retryAfter).toBe(60)
    })

    it('should use default tier when not specified', async () => {
      mockConsume.mockResolvedValue({
        remainingPoints: 99,
        msBeforeNext: 60000
      })

      await checkRateLimit(testIdentifier)

      expect(mockConsume).toHaveBeenCalledWith(testIdentifier)
    })

    it('should use correct tier limits', async () => {
      const tiers = ['auth', 'api', 'webhook', 'admin', 'chat', 'chart'] as const

      for (const tier of tiers) {
        mockConsume.mockResolvedValue({
          remainingPoints: RATE_LIMIT_TIERS[tier].points - 1,
          msBeforeNext: 60000
        })

        const result = await checkRateLimit(testIdentifier, tier)
        expect(result.limit).toBe(RATE_LIMIT_TIERS[tier].points)
      }
    })
  })

  describe('checkRateLimitForPath', () => {
    it('should return auth tier for auth paths', async () => {
      mockConsume.mockResolvedValue({
        remainingPoints: 4,
        msBeforeNext: 60000
      })

      const authPaths = [
        '/api/auth/signin',
        '/api/auth/signup',
        '/login',
        '/register',
        '/forgot-password',
        '/reset-password'
      ]

      for (const path of authPaths) {
        const result = await checkRateLimitForPath(testIdentifier, path)
        expect(result.limit).toBe(RATE_LIMIT_TIERS.auth.points)
      }
    })

    it('should return webhook tier for webhook paths', async () => {
      mockConsume.mockResolvedValue({
        remainingPoints: 999,
        msBeforeNext: 60000
      })

      const result = await checkRateLimitForPath(testIdentifier, '/api/webhook/stripe')
      expect(result.limit).toBe(RATE_LIMIT_TIERS.webhook.points)
    })

    it('should return admin tier for admin paths', async () => {
      mockConsume.mockResolvedValue({
        remainingPoints: 29,
        msBeforeNext: 60000
      })

      const result = await checkRateLimitForPath(testIdentifier, '/api/admin/users')
      expect(result.limit).toBe(RATE_LIMIT_TIERS.admin.points)
    })

    it('should return chat tier for chat paths', async () => {
      mockConsume.mockResolvedValue({
        remainingPoints: 29,
        msBeforeNext: 60000
      })

      const result = await checkRateLimitForPath(testIdentifier, '/api/chat/send')
      expect(result.limit).toBe(RATE_LIMIT_TIERS.chat.points)
    })

    it('should return chart tier for chart paths', async () => {
      mockConsume.mockResolvedValue({
        remainingPoints: 9,
        msBeforeNext: 60000
      })

      const result = await checkRateLimitForPath(testIdentifier, '/api/chart/create')
      expect(result.limit).toBe(RATE_LIMIT_TIERS.chart.points)
    })

    it('should return api tier for general API paths', async () => {
      mockConsume.mockResolvedValue({
        remainingPoints: 59,
        msBeforeNext: 60000
      })

      const result = await checkRateLimitForPath(testIdentifier, '/api/users/profile')
      expect(result.limit).toBe(RATE_LIMIT_TIERS.api.points)
    })

    it('should return default tier for non-API paths', async () => {
      mockConsume.mockResolvedValue({
        remainingPoints: 99,
        msBeforeNext: 60000
      })

      const result = await checkRateLimitForPath(testIdentifier, '/about')
      expect(result.limit).toBe(RATE_LIMIT_TIERS.default.points)
    })
  })

  describe('getRateLimitHeaders', () => {
    it('should generate correct headers for allowed request', () => {
      const result = {
        allowed: true,
        limit: 100,
        remaining: 99,
        resetTime: new Date(Date.now() + 60000)
      }

      const headers = getRateLimitHeaders(result)

      expect(headers['X-RateLimit-Limit']).toBe('100')
      expect(headers['X-RateLimit-Remaining']).toBe('99')
      expect(headers['X-RateLimit-Reset']).toBeDefined()
      expect(headers['Retry-After']).toBeUndefined()
    })

    it('should include Retry-After for blocked requests', () => {
      const result = {
        allowed: false,
        limit: 100,
        remaining: 0,
        resetTime: new Date(Date.now() + 60000),
        retryAfter: 60
      }

      const headers = getRateLimitHeaders(result)

      expect(headers['Retry-After']).toBe('60')
    })

    it('should calculate reset timestamp correctly', () => {
      // Use a specific timestamp
      const resetTimeMs = 1704067200000
      const resetTime = new Date(resetTimeMs)
      const result = {
        allowed: true,
        limit: 100,
        remaining: 50,
        resetTime
      }

      const headers = getRateLimitHeaders(result)
      expect(headers['X-RateLimit-Reset']).toBe(String(Math.ceil(resetTimeMs / 1000)))
    })
  })

  describe('penalizeClient', () => {
    it('should consume specified points', async () => {
      mockConsume.mockResolvedValue({
        remainingPoints: 90,
        msBeforeNext: 60000
      })

      await penalizeClient(testIdentifier, 'default', 5)

      expect(mockConsume).toHaveBeenCalledTimes(5)
      expect(mockConsume).toHaveBeenCalledWith(testIdentifier)
    })

    it('should handle already blocked client gracefully', async () => {
      mockConsume.mockRejectedValue({
        msBeforeNext: 60000
      })

      await expect(penalizeClient(testIdentifier, 'default', 3)).resolves.not.toThrow()
    })

    it('should use default points when not specified', async () => {
      mockConsume.mockResolvedValue({
        remainingPoints: 95,
        msBeforeNext: 60000
      })

      await penalizeClient(testIdentifier, 'default')

      expect(mockConsume).toHaveBeenCalledTimes(5)
    })
  })

  describe('resetRateLimit', () => {
    it('should reset specific tier', async () => {
      mockDelete.mockResolvedValue(undefined)

      await resetRateLimit(testIdentifier, 'auth')

      expect(mockDelete).toHaveBeenCalledWith(testIdentifier)
    })

    it('should reset all tiers when tier not specified', async () => {
      mockDelete.mockResolvedValue(undefined)

      await resetRateLimit(testIdentifier)

      // Should call delete for all 7 rate limiters
      expect(mockDelete).toHaveBeenCalledTimes(7)
    })
  })

  describe('getRateLimitStatus', () => {
    it('should return full status when no record exists', async () => {
      mockGet.mockResolvedValue(null)

      const result = await getRateLimitStatus(testIdentifier, 'default')

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(RATE_LIMIT_TIERS.default.points)
      expect(result.limit).toBe(RATE_LIMIT_TIERS.default.points)
    })

    it('should return current status when record exists', async () => {
      mockGet.mockResolvedValue({
        remainingPoints: 50,
        msBeforeNext: 30000
      })

      const result = await getRateLimitStatus(testIdentifier, 'default')

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(50)
      expect(result.limit).toBe(RATE_LIMIT_TIERS.default.points)
    })

    it('should show blocked when no remaining points', async () => {
      mockGet.mockResolvedValue({
        remainingPoints: 0,
        msBeforeNext: 30000
      })

      const result = await getRateLimitStatus(testIdentifier, 'default')

      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
    })

    it('should handle errors gracefully', async () => {
      mockGet.mockRejectedValue(new Error('Redis error'))

      const result = await getRateLimitStatus(testIdentifier, 'default')

      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
    })
  })
})
