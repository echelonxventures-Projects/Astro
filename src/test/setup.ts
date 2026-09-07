import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { vi, afterEach } from 'vitest'

// Mock environment variables
process.env.NEXTAUTH_SECRET = 'test-secret-key-for-testing-only-minimum-32-characters'
process.env.NEXTAUTH_URL = 'http://localhost:3000'
process.env.DATABASE_URL = 'file:./test.db'
process.env.ENCRYPTION_KEY = 'test-encryption-key-minimum-32-characters-long-secure'
process.env.STRIPE_SECRET_KEY = 'sk_test_dummy'
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_dummy'
process.env.ANTHROPIC_API_KEY = 'sk-ant-test-dummy'
// @ts-expect-error test-only override of readonly NODE_ENV
process.env.NODE_ENV = 'test'

// Global mocks
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => ({
    get: vi.fn(),
    getAll: vi.fn(),
    has: vi.fn(),
    forEach: vi.fn(),
  }),
  usePathname: () => '/test',
  redirect: vi.fn(),
}))

vi.mock('next/headers', () => ({
  headers: vi.fn(() => new Map()),
  cookies: vi.fn(() => new Map()),
}))

// Mock next-auth
vi.mock('next-auth', () => ({
  default: vi.fn(),
  getServerSession: vi.fn(),
}))

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({ data: null, status: 'unauthenticated' })),
  signIn: vi.fn(),
  signOut: vi.fn(),
  getSession: vi.fn(),
}))

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  logError: vi.fn(),
}))

// Clean up after each test
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
