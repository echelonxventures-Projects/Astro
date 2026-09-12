import { headers } from 'next/headers'
import { type AuthOptions, type Session } from 'next-auth'
import { getServerSession } from 'next-auth/next'
import Apple from 'next-auth/providers/apple'
import Credentials from 'next-auth/providers/credentials'
import Discord from 'next-auth/providers/discord'
import Facebook from 'next-auth/providers/facebook'
import GitHub from 'next-auth/providers/github'
import Google from 'next-auth/providers/google'
import Twitter from 'next-auth/providers/twitter'
import { DEFAULT_TENANT_ID, resolveTenantByHost, type TenantContext } from './tenant'

// Runtime validation for production (not during build)
const validateProductionEnv = () => {
  if (process.env.NODE_ENV === 'production' && typeof window === 'undefined') {
    const missing: string[] = []
    if (!process.env.NEXTAUTH_SECRET) missing.push('NEXTAUTH_SECRET')
    if (!process.env.NEXTAUTH_URL) missing.push('NEXTAUTH_URL')
    if (process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_KEY.length < 32) {
      throw new Error('ENCRYPTION_KEY must be at least 32 characters in production')
    }
    if (missing.length > 0) {
      throw new Error(
        `Missing required production environment variables: ${missing.join(', ')}. ` +
          'Generate secrets with: openssl rand -base64 32'
      )
    }
  }
}

// Only validate when actually running (not during build)
if (process.env.NEXT_PHASE !== 'phase-production-build') {
  validateProductionEnv()
}

// Helper to check if provider credentials exist
const hasCredentials = (
  clientId: string | undefined,
  clientSecret: string | undefined
): boolean => {
  return Boolean(clientId && clientId.length > 0 && clientSecret && clientSecret.length > 0)
}

interface ProviderCreds {
  clientId: string
  clientSecret: string
}

/**
 * Resolve OAuth credentials for a provider: tenant-specific keys win; global env
 * keys are used as fallback only for the default tenant.
 */
function providerCreds(
  provider: string,
  env: { clientId?: string; clientSecret?: string },
  ctx: TenantContext | null
): ProviderCreds | null {
  const tenantCreds = ctx?.settings.oauth?.[provider]
  if (tenantCreds && hasCredentials(tenantCreds.clientId, tenantCreds.clientSecret)) {
    return { clientId: tenantCreds.clientId!, clientSecret: tenantCreds.clientSecret! }
  }
  if (!ctx || ctx.tenantId === DEFAULT_TENANT_ID) {
    if (hasCredentials(env.clientId, env.clientSecret)) {
      return { clientId: env.clientId!, clientSecret: env.clientSecret! }
    }
  }
  return null
}

// Build providers array for a specific tenant (null = default/global)
const buildProviders = (ctx: TenantContext | null) => {
  const providers: AuthOptions['providers'] = []

  const google = providerCreds(
    'google',
    {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
    ctx
  )
  if (google) providers.push(Google(google))

  const facebook = providerCreds(
    'facebook',
    {
      clientId: process.env.FACEBOOK_CLIENT_ID,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
    },
    ctx
  )
  if (facebook) providers.push(Facebook(facebook))

  const github = providerCreds(
    'github',
    {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    },
    ctx
  )
  if (github) providers.push(GitHub(github))

  const discord = providerCreds(
    'discord',
    {
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
    },
    ctx
  )
  if (discord) providers.push(Discord(discord))

  const twitter = providerCreds(
    'twitter',
    {
      clientId: process.env.TWITTER_CLIENT_ID,
      clientSecret: process.env.TWITTER_CLIENT_SECRET,
    },
    ctx
  )
  if (twitter) providers.push(Twitter({ ...twitter, version: '2.0' }))

  const apple = providerCreds(
    'apple',
    {
      clientId: process.env.APPLE_CLIENT_ID,
      clientSecret: process.env.APPLE_CLIENT_SECRET,
    },
    ctx
  )
  if (apple) providers.push(Apple(apple))

  const tenantId = ctx?.tenantId ?? DEFAULT_TENANT_ID

  // Credentials provider (email/password) - always included, tenant-scoped
  providers.push(
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        // Lazy import prisma and bcrypt
        const { prisma } = await import('@/lib/db')
        const bcrypt = (await import('bcryptjs')).default

        const user = await prisma.user.findUnique({
          where: { tenantId_email: { tenantId, email: credentials.email } },
        })

        if (!user || !user.passwordHash) {
          return null
        }

        const isPasswordValid = await bcrypt.compare(credentials.password, user.passwordHash)

        if (!isPasswordValid) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          tenantId: user.tenantId,
        }
      },
    })
  )

  return providers
}

const buildCallbacks = (ctx: TenantContext | null) => {
  const tenantId = ctx?.tenantId ?? DEFAULT_TENANT_ID
  return {
    async jwt({
      token,
      user,
      account,
      trigger,
      session,
    }: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      token: any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      user?: any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      account?: any
      trigger?: string
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      session?: any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }): Promise<any> {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.tenantId = (user.tenantId as string) ?? tenantId
        if (account) {
          token.provider = account.provider
        }
      }
      if (!token.tenantId) {
        token.tenantId = tenantId
      }
      if (trigger === 'update' && session) {
        return { ...token, ...session }
      }
      return token
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async session({ session, token }: { session: any; token: any }): Promise<any> {
      if (session.user) {
        // Cross-tenant guard: a session issued for another tenant is not valid here
        if (ctx && token.tenantId && token.tenantId !== ctx.tenantId) {
          return null as any
        }
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.tenantId = token.tenantId as string
      }
      return session
    },
    async signIn({
      user,
      account,
    }: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      user: any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      account?: any
    }): Promise<boolean> {
      // Handle OAuth sign-in - create user within the current tenant
      if (account?.provider && account.provider !== 'credentials') {
        const { prisma } = await import('@/lib/db')

        if (!user.email) return false

        let dbUser = await prisma.user.findUnique({
          where: { tenantId_email: { tenantId, email: user.email } },
        })

        if (!dbUser) {
          dbUser = await prisma.user.create({
            data: {
              tenantId,
              email: user.email,
              name: user.name ?? null,
              image: user.image ?? null,
              emailVerified: new Date(),
            },
          })
        }

        // Create or update account link
        await prisma.account.upsert({
          where: {
            provider_providerAccountId: {
              provider: account.provider,
              providerAccountId: account.providerAccountId,
            },
          },
          create: {
            userId: dbUser.id,
            type: account.type,
            provider: account.provider,
            providerAccountId: account.providerAccountId,
            refresh_token: account.refresh_token,
            access_token: account.access_token,
            expires_at: account.expires_at,
            token_type: account.token_type,
            scope: account.scope,
            id_token: account.id_token,
            session_state: account.session_state,
          },
          update: {
            refresh_token: account.refresh_token,
            access_token: account.access_token,
            expires_at: account.expires_at,
          },
        })

        user.id = dbUser.id
        user.role = dbUser.role
        user.tenantId = dbUser.tenantId
      }
      return true
    },
  }
}

export function buildAuthOptions(ctx: TenantContext | null = null): AuthOptions {
  return {
    providers: buildProviders(ctx),
    pages: {
      signIn: '/login',
      error: '/login',
    },
    session: {
      strategy: 'jwt',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      updateAge: 24 * 60 * 60, // Update session every 24 hours
    },
    cookies: {
      sessionToken: {
        name: 'next-auth.session-token',
        options: {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          secure: process.env.NODE_ENV === 'production',
        },
      },
      csrfToken: {
        name: 'next-auth.csrf-token',
        options: {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          secure: process.env.NODE_ENV === 'production',
        },
      },
      callbackUrl: {
        name: 'next-auth.callback-url',
        options: {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          secure: process.env.NODE_ENV === 'production',
        },
      },
    },
    callbacks: buildCallbacks(ctx),
    debug: process.env.NODE_ENV === 'development',
  }
}

// Base options (default tenant) - sufficient for getServerSession, which only
// needs the secret + session config + jwt/session callbacks.
export const authOptions: AuthOptions = buildAuthOptions(null)

/** Resolve the tenant bound to the current request (server context). */
export async function getRequestTenant(): Promise<TenantContext | null> {
  try {
    const h = await headers()
    const host = h.get('host') ?? h.get('x-forwarded-host')
    return await resolveTenantByHost(host)
  } catch {
    return null
  }
}

export async function auth(): Promise<Session | null> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return session
  // Cross-tenant guard: a session issued for another tenant is unauthenticated here
  const ctx = await getRequestTenant()
  if (ctx && session.user.tenantId && session.user.tenantId !== ctx.tenantId) {
    return null
  }
  return session
}
