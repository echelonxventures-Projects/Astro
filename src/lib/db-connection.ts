/**
 * Database Connection Configuration with Connection Pooling and Query Timing
 * StarPath Astrology - Optimized for PostgreSQL in production
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { logger } from './logger';

// Query performance threshold in milliseconds
const SLOW_QUERY_THRESHOLD = 100;

// Connection pool configuration for PostgreSQL
// These values can be overridden via environment variables
const POOL_CONFIG = {
  // Maximum number of connections in the pool
  max: parseInt(process.env.DATABASE_POOL_MAX || '10', 10),
  // Minimum number of connections to maintain
  min: parseInt(process.env.DATABASE_POOL_MIN || '2', 10),
  // Connection timeout in milliseconds
  acquire: parseInt(process.env.DATABASE_POOL_ACQUIRE || '60000', 10),
  // Idle connection timeout in milliseconds
  idle: parseInt(process.env.DATABASE_POOL_IDLE || '10000', 10),
};

// Prisma client options
const prismaOptions: Prisma.PrismaClientOptions = {
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'info', 'warn', 'error']
    : ['error'],
};

// Add connection string with pool parameters for PostgreSQL
if (process.env.DATABASE_URL?.includes('postgresql')) {
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set('connection_limit', POOL_CONFIG.max.toString());
  url.searchParams.set('pool_timeout', '30');

  prismaOptions.datasources = {
    db: {
      url: url.toString(),
    },
  };
}

// Create Prisma client with extended configuration
const createPrismaClient = () => {
  const client = new PrismaClient(prismaOptions);

  // Query timing middleware
  client.$use(async (params: Prisma.MiddlewareParams, next: (params: Prisma.MiddlewareParams) => Promise<unknown>) => {
    const start = performance.now();
    const operationId = `${params.model}.${params.action}`;

    try {
      const result = await next(params);
      const duration = performance.now() - start;

      // Log slow queries
      if (duration > SLOW_QUERY_THRESHOLD) {
        logger.warn('Slow query detected', {
          model: params.model,
          action: params.action,
          durationMs: Math.round(duration * 100) / 100,
          threshold: SLOW_QUERY_THRESHOLD,
          args: sanitizeQueryArgs(params.args),
        });
      }

      // Debug log in development
      if (process.env.NODE_ENV === 'development' && process.env.LOG_PRISMA_QUERIES === 'true') {
        logger.debug('Query executed', {
          operation: operationId,
          durationMs: Math.round(duration * 100) / 100,
        });
      }

      return result;
    } catch (error) {
      const duration = performance.now() - start;
      logger.error('Query failed', {
        operation: operationId,
        durationMs: Math.round(duration * 100) / 100,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  });

  return client;
};

// Sanitize query arguments for logging (remove sensitive data)
function sanitizeQueryArgs(args: unknown): unknown {
  if (!args || typeof args !== 'object') {
    return args;
  }

  const sensitiveKeys = ['password', 'token', 'secret', 'apiKey', 'api_key', 'key'];
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(args as Record<string, unknown>)) {
    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeQueryArgs(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

// Global Prisma client instance with hot reloading support
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Connection health check
export async function checkDatabaseHealth(): Promise<{
  healthy: boolean;
  latencyMs: number;
  error?: string;
}> {
  const start = performance.now();

  try {
    // Simple query to test connection
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = performance.now() - start;

    return {
      healthy: true,
      latencyMs: Math.round(latencyMs * 100) / 100,
    };
  } catch (error) {
    return {
      healthy: false,
      latencyMs: performance.now() - start,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Graceful shutdown helper
export async function disconnectDatabase(): Promise<void> {
  logger.info('Disconnecting from database...');
  await prisma.$disconnect();
  logger.info('Database disconnected');
}

// Get connection pool status (PostgreSQL only)
export async function getPoolStatus(): Promise<{
  totalConnections?: number;
  activeConnections?: number;
  idleConnections?: number;
} | null> {
  if (!process.env.DATABASE_URL?.includes('postgresql')) {
    return null;
  }

  try {
    const result = await prisma.$queryRaw<Array<{
      count: bigint;
    }>>`
      SELECT count(*) as count FROM pg_stat_activity WHERE datname = current_database()
    `;

    return {
      totalConnections: Number(result[0]?.count || 0),
    };
  } catch {
    return null;
  }
}

// Transaction wrapper with timeout and retry logic
export async function withTransaction<T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
  options: {
    timeout?: number;
    maxRetries?: number;
    isolationLevel?: Prisma.TransactionIsolationLevel;
  } = {}
): Promise<T> {
  const { timeout = 30000, maxRetries = 3, isolationLevel } = options;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          // Set statement timeout for this transaction
          if (process.env.DATABASE_URL?.includes('postgresql')) {
            await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = ${timeout}`);
          }
          return await callback(tx);
        },
        {
          maxWait: timeout,
          timeout,
          isolationLevel,
        }
      );
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on validation errors
      if (lastError.message.includes('P2002') || lastError.message.includes('Unique constraint')) {
        throw lastError;
      }

      // Log retry attempt
      if (attempt < maxRetries) {
        logger.warn('Transaction failed, retrying...', {
          attempt,
          maxRetries,
          error: lastError.message,
        });
        await new Promise(resolve => setTimeout(resolve, 100 * attempt));
      }
    }
  }

  throw lastError;
}

export default prisma;
