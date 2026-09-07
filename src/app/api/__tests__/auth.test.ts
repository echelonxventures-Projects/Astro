import bcrypt from 'bcryptjs'
import { NextRequest } from 'next/server'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { POST as signupHandler } from '../auth/signup/route'

// Mock dependencies
const mockFindUnique = vi.fn()
const mockCreate = vi.fn()
const mockLogError = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: (...args: any[]) => mockFindUnique(...args),
      create: (...args: any[]) => mockCreate(...args),
    },
  },
}))

vi.mock('@/lib/logger', () => ({
  logError: (...args: any[]) => mockLogError(...args),
}))

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(),
  },
}))

function createRequest(body: unknown): NextRequest {
  return {
    json: () => Promise.resolve(body),
  } as NextRequest
}

describe('Auth API - Signup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFindUnique.mockReset()
    mockCreate.mockReset()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('POST /api/auth/signup', () => {
    it('should create new user with valid data', async () => {
      mockFindUnique.mockResolvedValue(null)
      mockCreate.mockResolvedValue({
        id: 'user-123',
        email: 'newuser@example.com',
        name: 'New User',
      })

      const hashedPassword = 'hashedpassword123'
      ;(bcrypt.hash as any).mockResolvedValue(hashedPassword)

      const request = createRequest({
        name: 'New User',
        email: 'newuser@example.com',
        password: 'Password123!',
      })

      const response = await signupHandler(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.id).toBe('user-123')
      expect(data.email).toBe('newuser@example.com')
      expect(data.name).toBe('New User')
      expect(data.passwordHash).toBeUndefined()
    })

    it('should reject signup with missing email', async () => {
      const request = createRequest({
        name: 'User',
        password: 'Password123!',
      })

      const response = await signupHandler(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Email and password are required')
    })

    it('should reject signup with missing password', async () => {
      const request = createRequest({
        name: 'User',
        email: 'user@example.com',
      })

      const response = await signupHandler(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Email and password are required')
    })

    it('should reject duplicate email', async () => {
      mockFindUnique.mockResolvedValue({
        id: 'existing-user',
        email: 'existing@example.com',
      })

      const request = createRequest({
        name: 'User',
        email: 'existing@example.com',
        password: 'Password123!',
      })

      const response = await signupHandler(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('already exists')
    })

    it('should hash password before storing', async () => {
      mockFindUnique.mockResolvedValue(null)
      mockCreate.mockResolvedValue({ id: 'user-123', email: 'test@example.com' })

      const password = 'Password123!'
      const hashedPassword = 'hashedpassword123'
      ;(bcrypt.hash as any).mockResolvedValue(hashedPassword)

      const request = createRequest({
        name: 'Test User',
        email: 'test@example.com',
        password,
      })

      await signupHandler(request)

      expect(bcrypt.hash).toHaveBeenCalledWith(password, 12)
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          passwordHash: hashedPassword,
        })
      )
    })

    it('should handle database errors gracefully', async () => {
      mockFindUnique.mockRejectedValue(new Error('Database connection failed'))

      const request = createRequest({
        name: 'User',
        email: 'user@example.com',
        password: 'Password123!',
      })

      const response = await signupHandler(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toContain('Failed to create account')
      expect(mockLogError).toHaveBeenCalled()
    })
  })
})
