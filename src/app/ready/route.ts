import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'

interface ReadinessStatus {
  ready: boolean
  timestamp: string
  version: string
  checks: {
    database: boolean
    migrations: boolean
    seeding: boolean
  }
  details?: {
    lastMigration?: string
    pendingMigrations?: number
    dbTables?: number
  }
}

async function checkMigrations(): Promise<{
  success: boolean
  lastMigration?: string
  pending?: number
}> {
  try {
    // Check if _prisma_migrations table exists and has entries
    const migrations = (await prisma.$queryRaw`
      SELECT migration_name, finished_at
      FROM _prisma_migrations
      WHERE finished_at IS NOT NULL
      ORDER BY finished_at DESC
      LIMIT 1
    `) as Array<{ migration_name: string; finished_at: Date }>

    const pendingMigrations = (await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM _prisma_migrations
      WHERE finished_at IS NULL AND rolled_back_at IS NULL
    `) as Array<{ count: number }>

    const pending = Number(pendingMigrations[0]?.count || 0)

    return {
      success: migrations.length > 0 && pending === 0,
      lastMigration: migrations[0]?.migration_name,
      pending,
    }
  } catch (error) {
    // Table might not exist yet (first run)
    logger.warn({ error }, 'Readiness check: Could not query migrations')
    return { success: false }
  }
}

async function checkDatabaseTables(): Promise<number> {
  try {
    // Provider-neutral: count rows across a known migrated model
    // (table existence is implied - the query throws if it's missing)
    return await prisma.appSettings.count()
  } catch {
    return 0
  }
}

async function checkSeeding(): Promise<boolean> {
  try {
    // Check if critical tables have data
    const settingsCount = await prisma.appSettings.count()
    const paymentGatewaysCount = await prisma.paymentGateway.count()

    return settingsCount > 0 || paymentGatewaysCount > 0
  } catch {
    return false
  }
}

async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`
    return true
  } catch {
    return false
  }
}

export async function GET(): Promise<NextResponse> {
  const checks = await Promise.all([checkDatabaseConnection(), checkMigrations(), checkSeeding()])

  const [databaseConnected, migrationStatus, seedingComplete] = checks

  const ready = databaseConnected && migrationStatus.success && seedingComplete

  const status: ReadinessStatus = {
    ready,
    timestamp: new Date().toISOString(),
    version: process.env.NEXT_PUBLIC_APP_VERSION || process.env.npm_package_version || '0.1.0',
    checks: {
      database: databaseConnected,
      migrations: migrationStatus.success,
      seeding: seedingComplete,
    },
    details: {
      lastMigration: migrationStatus.lastMigration,
      pendingMigrations: migrationStatus.pending,
      dbTables: await checkDatabaseTables(),
    },
  }

  if (!ready) {
    logger.warn(
      {
        checks: status.checks,
        details: status.details,
      },
      'Readiness check failed'
    )
  }

  return NextResponse.json(status, {
    status: ready ? 200 : 503,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  })
}

// HEAD request for simple readiness checks
export async function HEAD(): Promise<NextResponse> {
  try {
    await prisma.$queryRaw`SELECT 1`
    const migrationStatus = await checkMigrations()
    const seedingComplete = await checkSeeding()

    const ready = migrationStatus.success && seedingComplete
    return new NextResponse(null, { status: ready ? 200 : 503 })
  } catch {
    return new NextResponse(null, { status: 503 })
  }
}
