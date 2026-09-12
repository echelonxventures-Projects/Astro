export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import bcrypt from 'bcryptjs'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logError } from '@/lib/logger'
import { getTenantContext, TenantNotFoundError } from '@/lib/tenant'

/**
 * POST /api/auth/signup
 * Create a new user account within the requesting tenant
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, email, password } = body

    const ctx = await getTenantContext()

    // Validate input
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    // Check if user already exists in this tenant
    const existingUser = await prisma.user.findUnique({
      where: { tenantId_email: { tenantId: ctx.tenantId, email } },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 400 }
      )
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12)

    // Create user
    const user = await prisma.user.create({
      data: {
        tenantId: ctx.tenantId,
        email,
        name,
        passwordHash,
        emailVerified: new Date(),
      },
    })

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
    })
  } catch (error) {
    if (error instanceof TenantNotFoundError) {
      return NextResponse.json({ error: 'Unknown tenant' }, { status: 404 })
    }
    logError('Signup error', error)
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
  }
}
