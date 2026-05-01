import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Set up mocks BEFORE importing modules that use them
const mockFindUnique = vi.fn()
const mockCreate = vi.fn()
const mockUpsert = vi.fn()
const mockBcryptCompare = vi.fn()
const mockBcryptHash = vi.fn()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
vi.mock('@/lib/db', () => ({
  prisma: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findUnique: (...args: any[]) => mockFindUnique(...args),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    create: (...args: any[]) => mockCreate(...args)
  },
  account: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    upsert: (...args: any[]) => mockUpsert(...args)
  }
}))

vi.mock('bcryptjs', () => ({
  default: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    compare: (...args: any[]) => mockBcryptCompare(...args),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    hash: (...args: any[]) => mockBcryptHash(...args)
  }
}))

// Now import the module under test
import { authOptions } from '../auth'

describe('Auth Configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Auth Options', () => {
    it('should have correct session configuration', () => {
      expect(authOptions.session).toBeDefined()
      expect(authOptions.session?.strategy).toBe('jwt')
      expect(authOptions.session?.maxAge).toBe(7 * 24 * 60 * 60) // 7 days
      expect(authOptions.session?.updateAge).toBe(24 * 60 * 60) // 24 hours
    })

    it('should have secure cookie configuration', () => {
      const cookies = authOptions.cookies
      expect(cookies).toBeDefined()
      expect(cookies?.sessionToken?.options?.httpOnly).toBe(true)
      expect(cookies?.sessionToken?.options?.sameSite).toBe('lax')
      expect(cookies?.sessionToken?.options?.path).toBe('/')
    })

    it('should have correct sign-in and error pages', () => {
      expect(authOptions.pages?.signIn).toBe('/login')
      expect(authOptions.pages?.error).toBe('/login')
    })

    it('should have providers configured', () => {
      expect(authOptions.providers).toBeDefined()
      expect(authOptions.providers.length).toBeGreaterThan(0)
    })
  })

  describe('JWT Callback', () => {
    it('should add user data to token', async () => {
      const token = { sub: 'user-123' }
      const user = { id: 'user-123', role: 'user', name: 'Test User' }
      const account = { provider: 'credentials' }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await authOptions.callbacks?.jwt?.({
        token,
        user,
        account,
        trigger: 'signIn'
      } as any)

      expect(result).toBeDefined()
      expect(result.id).toBe('user-123')
      expect(result.role).toBe('user')
      expect(result.provider).toBe('credentials')
    })

    it('should handle session update trigger', async () => {
      const token = { sub: 'user-123', id: 'user-123', role: 'user' }
      const sessionUpdate = { name: 'Updated Name' }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await authOptions.callbacks?.jwt?.({
        token,
        session: sessionUpdate,
        trigger: 'update'
      } as any)

      expect(result.name).toBe('Updated Name')
    })
  })

  describe('Session Callback', () => {
    it('should add token data to session', async () => {
      const session = { user: { email: 'test@example.com' } }
      const token = { id: 'user-123', role: 'user' }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await authOptions.callbacks?.session?.({
        session,
        token
      } as any)

      expect(result.user.id).toBe('user-123')
      expect(result.user.role).toBe('user')
    })
  })

  describe('SignIn Callback', () => {
    it('should allow sign in', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await authOptions.callbacks?.signIn?.({
        user: { email: 'test@example.com' },
        account: { provider: 'credentials' }
      } as any)

      expect(result).toBe(true)
    })

    it('should handle OAuth sign-in by creating user', async () => {
      mockFindUnique.mockResolvedValue(null)
      mockCreate.mockResolvedValue({ id: 'new-user-123' })
      mockUpsert.mockResolvedValue({})

      const user = {
        email: 'oauth@example.com',
        name: 'OAuth User',
        image: 'https://example.com/avatar.png'
      }
      const account = {
        provider: 'google',
        providerAccountId: 'google-123',
        type: 'oauth',
        refresh_token: null,
        access_token: null,
        expires_at: null,
        token_type: null,
        scope: null,
        id_token: null,
        session_state: null
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await authOptions.callbacks?.signIn?.({
        user,
        account,
        profile: {}
      } as any)

      expect(result).toBe(true)
    })
  })

  describe('Credentials Provider', () => {
    it('should reject empty credentials', async () => {
      const credentialsProvider = authOptions.providers.find(
        p => p.id === 'credentials'
      )

      const authorize = credentialsProvider?.options?.authorize
      if (!authorize) {
        expect.fail('Authorize function not found')
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await authorize({ email: '', password: '' } as any, {} as any)
      expect(result).toBeNull()
    })

    it('should reject invalid credentials', async () => {
      mockFindUnique.mockResolvedValue(null)

      const credentialsProvider = authOptions.providers.find(
        p => p.id === 'credentials'
      )

      const authorize = credentialsProvider?.options?.authorize
      if (!authorize) {
        expect.fail('Authorize function not found')
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await authorize(
        { email: 'test@example.com', password: 'wrongpassword' } as any,
        {} as any
      )
      expect(result).toBeNull()
    })

    it('should authenticate valid credentials', async () => {
      // Setup bcrypt compare mock
      mockBcryptCompare.mockResolvedValue(true)

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        image: null,
        role: 'user',
        passwordHash: 'hashedpassword'
      }
      mockFindUnique.mockResolvedValue(mockUser)

      const credentialsProvider = authOptions.providers.find(
        p => p.id === 'credentials'
      )

      const authorize = credentialsProvider?.options?.authorize
      if (!authorize) {
        expect.fail('Authorize function not found')
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await authorize(
        { email: 'test@example.com', password: 'correctpassword' } as any,
        {} as any
      )

      expect(result).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        image: null,
        role: 'user'
      })

      expect(mockBcryptCompare).toHaveBeenCalledWith('correctpassword', 'hashedpassword')
    })

    it('should reject when password does not match', async () => {
      // Setup bcrypt compare mock to return false
      mockBcryptCompare.mockResolvedValue(false)

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        image: null,
        role: 'user',
        passwordHash: 'hashedpassword'
      }
      mockFindUnique.mockResolvedValue(mockUser)

      const credentialsProvider = authOptions.providers.find(
        p => p.id === 'credentials'
      )

      const authorize = credentialsProvider?.options?.authorize
      if (!authorize) {
        expect.fail('Authorize function not found')
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await authorize(
        { email: 'test@example.com', password: 'wrongpassword' } as any,
        {} as any
      )

      expect(result).toBeNull()
      expect(mockBcryptCompare).toHaveBeenCalledWith('wrongpassword', 'hashedpassword')
    })
  })
})
