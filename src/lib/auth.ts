import NextAuth, { type AuthOptions, type Session } from 'next-auth'
import { getServerSession } from 'next-auth/next'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import Facebook from 'next-auth/providers/facebook'
import GitHub from 'next-auth/providers/github'
import Discord from 'next-auth/providers/discord'
import Twitter from 'next-auth/providers/twitter'
import Apple from 'next-auth/providers/apple'
import { logger } from './logger'

// Runtime validation for production (not during build)
const validateProductionEnv = () => {
  if (process.env.NODE_ENV === 'production' && typeof window === 'undefined') {
    if (!process.env.NEXTAUTH_SECRET) {
      logger.error('NEXTAUTH_SECRET must be set in production')
    }
    if (!process.env.NEXTAUTH_URL) {
      logger.error('NEXTAUTH_URL must be set in production')
    }
  }
}

// Only validate when actually running (not during build)
if (process.env.NEXT_PHASE !== 'phase-production-build') {
  validateProductionEnv()
}

// Helper to check if provider credentials exist
const hasCredentials = (clientId: string | undefined, clientSecret: string | undefined) => {
  return clientId && clientId.length > 0 && clientSecret && clientSecret.length > 0
}

// Build providers array based on available credentials
const buildProviders = () => {
  const providers = []

  // Google OAuth (always included if credentials exist)
  if (hasCredentials(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET)) {
    providers.push(Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }))
  }

  // Facebook OAuth
  if (hasCredentials(process.env.FACEBOOK_CLIENT_ID, process.env.FACEBOOK_CLIENT_SECRET)) {
    providers.push(Facebook({
      clientId: process.env.FACEBOOK_CLIENT_ID!,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
    }))
  }

  // GitHub OAuth
  if (hasCredentials(process.env.GITHUB_CLIENT_ID, process.env.GITHUB_CLIENT_SECRET)) {
    providers.push(GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }))
  }

  // Discord OAuth
  if (hasCredentials(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_CLIENT_SECRET)) {
    providers.push(Discord({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
    }))
  }

  // Twitter/X OAuth
  if (hasCredentials(process.env.TWITTER_CLIENT_ID, process.env.TWITTER_CLIENT_SECRET)) {
    providers.push(Twitter({
      clientId: process.env.TWITTER_CLIENT_ID!,
      clientSecret: process.env.TWITTER_CLIENT_SECRET!,
      version: '2.0', // OAuth 2.0
    }))
  }

  // Apple OAuth (requires special setup)
  if (hasCredentials(process.env.APPLE_CLIENT_ID, process.env.APPLE_CLIENT_SECRET)) {
    providers.push(Apple({
      clientId: process.env.APPLE_CLIENT_ID!,
      clientSecret: process.env.APPLE_CLIENT_SECRET!,
    }))
  }

  // Credentials provider (email/password) - always included
  providers.push(Credentials({
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
        where: { email: credentials.email },
      })

      if (!user || !user.passwordHash) {
        return null
      }

      const isPasswordValid = await bcrypt.compare(
        credentials.password,
        user.passwordHash
      )

      if (!isPasswordValid) {
        return null
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        role: user.role,
      }
    },
  }))

  return providers
}

export const authOptions: AuthOptions = {
  providers: buildProviders(),
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
  callbacks: {
    async jwt({ token, user, account, trigger, session }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        // Store provider info for device tracking
        if (account) {
          token.provider = account.provider
        }
      }
      if (trigger === 'update' && session) {
        return { ...token, ...session }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
      }
      return session
    },
    async signIn({ user, account, profile }) {
      // Handle OAuth sign-in - create user if not exists
      if (account?.provider && account.provider !== 'credentials') {
        const { prisma } = await import('@/lib/db')

        const existingUser = await prisma.user.findUnique({
          where: { email: user.email! },
        })

        if (!existingUser) {
          await prisma.user.create({
            data: {
              email: user.email!,
              name: user.name!,
              image: user.image!,
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
            userId: existingUser?.id || user.email!,
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
      }
      return true
    },
  },
  debug: process.env.NODE_ENV === 'development',
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
export const auth = () => getServerSession(authOptions) as Promise<Session | null>