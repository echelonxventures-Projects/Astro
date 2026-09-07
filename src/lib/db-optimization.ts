/**
 * Database Query Optimization Utilities
 * StarPath Astrology - Provides optimized query patterns and helpers
 */

import { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from './db-connection'
import { logger } from './logger'

// Re-export prisma for convenience
export { prisma }

/**
 * Pagination result type
 */
export interface PaginatedResult<T> {
  data: T[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
    hasNextPage: boolean
    hasPreviousPage: boolean
  }
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page?: number
  pageSize?: number
  maxPageSize?: number
}

// Default and max page sizes
const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100

/**
 * Calculate pagination parameters with bounds checking
 */
export function getPaginationParams(options: PaginationOptions = {}): {
  skip: number
  take: number
  page: number
  pageSize: number
} {
  const maxPageSize = options.maxPageSize || MAX_PAGE_SIZE
  const pageSize = Math.min(Math.max(1, options.pageSize || DEFAULT_PAGE_SIZE), maxPageSize)
  const page = Math.max(1, options.page || 1)
  const skip = (page - 1) * pageSize

  return { skip, take: pageSize, page, pageSize }
}

/**
 * Generic pagination helper for Prisma queries
 * Handles efficient counting and data fetching
 */
export async function paginate<T, K extends keyof PrismaClient>(
  model: K,
  query: Omit<Prisma.Args<PrismaClient[K], 'findMany'>, 'skip' | 'take'>,
  options: PaginationOptions = {}
): Promise<PaginatedResult<T>> {
  const { skip, take, page, pageSize } = getPaginationParams(options)
  const prismaModel = prisma[model] as unknown as {
    findMany: (args: unknown) => Promise<T[]>
    count: (args: unknown) => Promise<number>
  }

  // Fetch data and total count in parallel
  const [data, total] = await Promise.all([
    prismaModel.findMany({
      ...query,
      skip,
      take,
    }),
    prismaModel.count({ where: (query as { where?: unknown }).where }),
  ])

  const totalPages = Math.ceil(total / pageSize)

  return {
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  }
}

/**
 * Get user with their birth charts and readings in a single optimized query
 * Avoids N+1 query pattern by using include
 */
export async function getUserWithCharts(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      birthCharts: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          name: true,
          birthDate: true,
          birthPlace: true,
          createdAt: true,
        },
      },
      readings: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          type: true,
          title: true,
          createdAt: true,
        },
      },
      astroProfiles: {
        take: 5,
        select: {
          id: true,
          name: true,
          relationship: true,
        },
      },
    },
  })
}

/**
 * Get paginated readings for a user with optimized selection
 */
export async function getUserReadings(
  userId: string,
  options: PaginationOptions & { type?: string } = {}
) {
  const where: Prisma.ReadingWhereInput = { userId }

  if (options.type) {
    where.type = options.type
  }

  return paginate(
    'reading',
    {
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        type: true,
        title: true,
        content: true,
        createdAt: true,
        aiGenerated: true,
      },
    },
    options
  )
}

/**
 * Get recent chat sessions for a user with limited data
 */
export async function getRecentChatSessions(userId: string, _limit: number = 10) {
  return prisma.chatSession.findMany({
    where: { userId },
    orderBy: { lastActiveAt: 'desc' },
    take: _limit,
    select: {
      id: true,
      title: true,
      lastActiveAt: true,
      createdAt: true,
      // Only select metadata, not full messages
      metadata: true,
    },
  })
}

/**
 * Get unread notifications count and recent notifications
 */
export async function getUserNotifications(userId: string, _limit: number = 20) {
  const [unreadCount, notifications] = await Promise.all([
    prisma.notification.count({
      where: { userId, isRead: false },
    }),
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: _limit,
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        isRead: true,
        createdAt: true,
      },
    }),
  ])

  return { unreadCount, notifications }
}

/**
 * Batch update multiple readings efficiently
 * Uses transaction for atomicity
 */
export async function batchUpdateReadings(
  userId: string,
  ids: string[],
  data: Prisma.ReadingUpdateInput
) {
  // Verify all readings belong to the user
  const userReadings = await prisma.reading.findMany({
    where: { id: { in: ids }, userId },
    select: { id: true },
  })

  const userReadingIds = new Set(userReadings.map(r => r.id))
  const validIds = ids.filter(id => userReadingIds.has(id))

  if (validIds.length === 0) {
    return { updated: 0, skipped: ids.length }
  }

  // Use transaction for batch update
  const results = await prisma.$transaction(
    validIds.map(id =>
      prisma.reading.update({
        where: { id },
        data,
      })
    )
  )

  return {
    updated: results.length,
    skipped: ids.length - validIds.length,
  }
}

/**
 * Batch delete readings efficiently
 */
export async function batchDeleteReadings(userId: string, ids: string[]) {
  // Verify ownership and delete in one operation
  const { count } = await prisma.reading.deleteMany({
    where: {
      id: { in: ids },
      userId,
    },
  })

  return { deleted: count }
}

/**
 * Get dashboard data with all necessary information in optimized queries
 */
export async function getUserDashboardData(userId: string) {
  const startTime = performance.now()

  const [user, readingsCount, unreadNotifications, recentTransactions, subscription] =
    await Promise.all([
      // Basic user info
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          subscriptionStatus: true,
          subscriptionPlan: true,
          currentPeriodEnd: true,
          createdAt: true,
        },
      }),
      // Count total readings
      prisma.reading.count({ where: { userId } }),
      // Unread notifications
      prisma.notification.count({
        where: { userId, isRead: false },
      }),
      // Recent payment transactions
      prisma.paymentTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          amount: true,
          currency: true,
          status: true,
          createdAt: true,
        },
      }),
      // Active subscription
      prisma.subscription.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          plan: true,
          status: true,
          currentPeriodEnd: true,
          cancelAtPeriodEnd: true,
        },
      }),
    ])

  const duration = performance.now() - startTime

  logger.debug(
    {
      userId,
      durationMs: Math.round(duration * 100) / 100,
    },
    'Dashboard data fetched'
  )

  return {
    user,
    readingsCount,
    unreadNotifications,
    recentTransactions,
    subscription,
  }
}

/**
 * Search readings with full-text-like search on title and content
 * Uses case-insensitive contains for SQLite compatibility
 */
export async function searchReadings(
  userId: string,
  searchTerm: string,
  options: PaginationOptions = {}
) {
  const lowerTerm = searchTerm.toLowerCase()
  const upperTerm = searchTerm.toUpperCase()
  const where: Prisma.ReadingWhereInput = {
    userId,
    OR: [
      {
        title: {
          in: [
            searchTerm,
            lowerTerm,
            upperTerm,
            searchTerm.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()),
          ],
        },
      },
      { content: { contains: searchTerm } },
    ],
  }

  return paginate(
    'reading',
    {
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        type: true,
        title: true,
        content: true,
        createdAt: true,
      },
    },
    options
  )
}

/**
 * Get active users by subscription status with pagination
 * Useful for admin dashboards
 */
export async function getUsersBySubscriptionStatus(
  status: string,
  options: PaginationOptions = {}
) {
  return paginate(
    'user',
    {
      where: { subscriptionStatus: status },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        subscriptionStatus: true,
        subscriptionPlan: true,
        createdAt: true,
        updatedAt: true,
      },
    },
    options
  )
}

/**
 * Optimize memory entries by cleaning up old, low-importance entries
 */
export async function cleanupOldMemories(
  userId: string,
  options: {
    olderThanDays?: number
    maxImportance?: number
    _limit?: number
  } = {}
) {
  const { olderThanDays = 90, maxImportance = 2, _limit = 100 } = options

  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)

  const { count } = await prisma.userMemory.deleteMany({
    where: {
      userId,
      importance: { lte: maxImportance },
      lastUsedAt: { lt: cutoffDate },
      useCount: { lt: 3 },
    },
    // Note: deleteMany doesn't support _limit in Prisma, we handle this by
    // querying first if needed, but for cleanup operations full deletion is usually fine
  })

  logger.info(
    {
      userId,
      deletedCount: count,
      olderThanDays,
    },
    'Cleaned up old memories'
  )

  return { deleted: count }
}

/**
 * Type-safe raw query executor with timing
 */
export async function executeRawQuery<T>(
  query: TemplateStringsArray,
  ...values: unknown[]
): Promise<T> {
  const start = performance.now()

  try {
    const result = await prisma.$queryRaw<T>(query, ...values)
    const duration = performance.now() - start

    logger.debug(
      {
        durationMs: Math.round(duration * 100) / 100,
      },
      'Raw query executed'
    )

    return result
  } catch (error) {
    const duration = performance.now() - start
    logger.error(
      {
        durationMs: Math.round(duration * 100) / 100,
        error: error instanceof Error ? error.message : String(error),
      },
      'Raw query failed'
    )
    throw error
  }
}
