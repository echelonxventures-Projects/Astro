<!--
  HISTORY NOTE (documentation consolidation): this file describes an earlier
  implementation phase (pre multi-tenancy / pre PostgreSQL migration).
  Canonical current docs: README.md, PROJECT_DOCUMENTATION.md, docs/MULTI_TENANCY.md.
-->

# Database Performance Guide

## StarPath Astrology - Database Optimization

This guide documents the database performance optimizations, query patterns, and best practices for the StarPath Astrology application.

## Table of Contents

- [Current Indexes](#current-indexes)
- [Query Patterns](#query-patterns)
- [Optimization Tips](#optimization-tips)
- [Connection Pooling](#connection-pooling)
- [Monitoring and Analysis](#monitoring-and-analysis)
- [Troubleshooting](#troubleshooting)

---

## Current Indexes

### User Table

| Index Name                   | Columns             | Purpose                      |
| ---------------------------- | ------------------- | ---------------------------- |
| User_pkey                    | id                  | Primary key lookup           |
| User_email_key               | email               | Unique email constraint      |
| idx_user_subscription_status | subscription_status | Filter users by subscription |

### BirthChart Table

| Index Name                     | Columns           | Purpose                    |
| ------------------------------ | ----------------- | -------------------------- |
| BirthChart_pkey                | id                | Primary key lookup         |
| BirthChart_userId_idx          | userId            | Filter charts by user      |
| idx_birthchart_user_created_at | userId, createdAt | User charts sorted by date |

### Reading Table

| Index Name                  | Columns           | Purpose                      |
| --------------------------- | ----------------- | ---------------------------- |
| Reading_pkey                | id                | Primary key lookup           |
| Reading_userId_type_idx     | userId, type      | Filter by user and type      |
| idx_reading_user_created_at | userId, createdAt | User readings sorted by date |
| idx_reading_created_at      | createdAt DESC    | Recent readings queries      |

### ChatSession Table

| Index Name             | Columns           | Purpose                 |
| ---------------------- | ----------------- | ----------------------- |
| ChatSession_pkey       | id                | Primary key lookup      |
| ChatSession_userId_idx | userId            | Filter sessions by user |
| idx_chat_last_active   | lastActiveAt DESC | Recent active sessions  |

### Payment Table

| Index Name                    | Columns           | Purpose                 |
| ----------------------------- | ----------------- | ----------------------- |
| Payment_pkey                  | id                | Primary key lookup      |
| Payment_stripePaymentId_key   | stripePaymentId   | Unique payment lookup   |
| Payment_userId_idx            | userId            | Filter payments by user |
| idx_payment_status_created_at | status, createdAt | Payment status reports  |

### Notification Table

| Index Name                  | Columns        | Purpose                       |
| --------------------------- | -------------- | ----------------------------- |
| Notification_pkey           | id             | Primary key lookup            |
| idx_notification_user_read  | userId, isRead | Unread notifications per user |
| idx_notification_created_at | createdAt DESC | Recent notifications          |

### Subscription Table

| Index Name                            | Columns              | Purpose                       |
| ------------------------------------- | -------------------- | ----------------------------- |
| Subscription_pkey                     | id                   | Primary key lookup            |
| Subscription_stripeSubscriptionId_key | stripeSubscriptionId | Unique subscription lookup    |
| Subscription_userId_idx               | userId               | Filter subscriptions by user  |
| idx_subscription_status               | status               | Filter by subscription status |

### PaymentTransaction Table

| Index Name                   | Columns           | Purpose                          |
| ---------------------------- | ----------------- | -------------------------------- |
| PaymentTransaction_pkey      | id                | Primary key lookup               |
| idx_transaction_user_created | userId, createdAt | User transactions sorted by date |
| idx_transaction_status       | status            | Filter by transaction status     |

---

## Query Patterns

### 1. User with Related Data (N+1 Prevention)

**Anti-pattern (N+1 queries):**

```typescript
// BAD: This causes N+1 queries
const user = await prisma.user.findUnique({ where: { id: userId } })
const charts = await prisma.birthChart.findMany({ where: { userId } })
const readings = await prisma.reading.findMany({ where: { userId } })
```

**Optimized pattern:**

```typescript
// GOOD: Single query with includes
const user = await getUserWithCharts(userId)
// Uses: include { birthCharts: true, readings: true }
```

### 2. Pagination

**Recommended approach:**

```typescript
import { paginate } from '@/lib/db-optimization'

// Efficient pagination with count
const result = await paginate(
  'reading',
  {
    where: { userId },
    orderBy: { createdAt: 'desc' },
  },
  { page: 1, pageSize: 20 }
)

// Result includes:
// - data: Reading[]
// - pagination: { page, pageSize, total, totalPages, hasNextPage, hasPreviousPage }
```

### 3. Select Specific Fields

**Always limit fields to what's needed:**

```typescript
// GOOD: Only select required fields
await prisma.reading.findMany({
  where: { userId },
  select: {
    id: true,
    type: true,
    title: true,
    createdAt: true,
    // content is large - don't select unless needed
  },
})
```

### 4. Dashboard Data Aggregation

**Use parallel queries for dashboard data:**

```typescript
const [user, readingsCount, unreadNotifications] = await Promise.all([
  prisma.user.findUnique({ where: { id: userId } }),
  prisma.reading.count({ where: { userId } }),
  prisma.notification.count({ where: { userId, isRead: false } }),
])
```

---

## Optimization Tips

### 1. Use Include Instead of Separate Queries

Always use `include` or `select` with relations instead of making separate queries. This reduces round trips to the database.

```typescript
// GOOD
await prisma.user.findUnique({
  where: { id: userId },
  include: {
    birthCharts: { take: 10 },
    readings: { take: 5 },
  },
})
```

### 2. Use Select to Limit Fields

Large text fields (like `Reading.content`) should only be selected when needed.

```typescript
// For listing - exclude large content
await prisma.reading.findMany({
  select: { id: true, title: true, createdAt: true },
})

// For detail view - include content
await prisma.reading.findUnique({
  where: { id: readingId },
  select: { id: true, title: true, content: true },
})
```

### 3. Add Pagination for Large Datasets

Never fetch unlimited records. Always use pagination.

```typescript
// Use the paginate helper
const { data, pagination } = await paginate('user', {}, { pageSize: 50 })

// Or manually
const results = await prisma.reading.findMany({
  skip: (page - 1) * pageSize,
  take: pageSize,
})
```

### 4. Use Transactions for Batch Operations

Batch updates and deletes should be wrapped in transactions for consistency.

```typescript
// Batch update with transaction
await prisma.$transaction(ids.map(id => prisma.reading.update({ where: { id }, data })))
```

### 5. Index Filter Columns

Ensure columns used in `WHERE` clauses are indexed:

- Foreign keys (userId, etc.)
- Status fields (subscriptionStatus, status)
- Date fields used for sorting (createdAt)

### 6. Use Case-Insensitive Search Carefully

Full-text search with `contains` and `mode: 'insensitive'` can be slow on large tables. Consider:

- Adding full-text search indexes (PostgreSQL)
- Using search engines like Elasticsearch for complex search
- Limiting search to smaller result sets first

---

## Connection Pooling

### Configuration

Connection pooling is configured in `src/lib/db-connection.ts`:

```typescript
const POOL_CONFIG = {
  max: 10, // Maximum connections
  min: 2, // Minimum connections
  acquire: 60000, // Connection timeout (ms)
  idle: 10000, // Idle timeout (ms)
}
```

### Environment Variables

Override pool settings via environment:

```bash
# Connection pool settings
DATABASE_POOL_MAX=20
DATABASE_POOL_MIN=5
DATABASE_POOL_ACQUIRE=60000
DATABASE_POOL_IDLE=10000
```

### Monitoring Pool Usage

Check current pool status:

```typescript
import { getPoolStatus } from '@/lib/db-connection'

const status = await getPoolStatus()
console.log(status) // { totalConnections: 5 }
```

### Best Practices

1. **Size the pool appropriately**: Start with 10 connections, scale based on load
2. **Monitor connection usage**: High connection counts may indicate connection leaks
3. **Use transactions wisely**: Long-running transactions hold connections
4. **Close connections on shutdown**: Always call `prisma.$disconnect()` on app shutdown

---

## Monitoring and Analysis

### Slow Query Detection

The application automatically logs queries slower than 100ms:

```
[warn] Slow query detected {
  model: "Reading",
  action: "findMany",
  durationMs: 245.32,
  threshold: 100
}
```

### Query Analysis Tool

Run the query analyzer to identify performance issues:

```bash
# Analyze queries from log file
npx ts-node scripts/analyze-queries.ts

# Also check current indexes
npx ts-node scripts/analyze-queries.ts --indexes

# Don't save results
npx ts-node scripts/analyze-queries.ts --no-save
```

### Health Check

Check database health and latency:

```typescript
import { checkDatabaseHealth } from '@/lib/db-connection'

const health = await checkDatabaseHealth()
// { healthy: true, latencyMs: 2.45 }
```

### Metrics to Monitor

- Query duration (p50, p95, p99)
- Connection pool utilization
- Slow query rate
- Error rate
- Transaction duration

---

## Troubleshooting

### Slow Queries

**Symptom:** Queries taking >100ms consistently

**Solutions:**

1. Check for missing indexes: `npx ts-node scripts/analyze-queries.ts --indexes`
2. Review query patterns in logs
3. Add selective fields (don't fetch everything)
4. Add pagination for large result sets
5. Consider caching frequently accessed data

### Connection Pool Exhaustion

**Symptom:** `P1001: Can't reach database server` or timeouts

**Solutions:**

1. Increase `DATABASE_POOL_MAX`
2. Check for connection leaks (unclosed transactions)
3. Reduce query execution time
4. Implement query timeouts
5. Consider read replicas for read-heavy workloads

### N+1 Query Problems

**Symptom:** Multiple similar queries executed in sequence

**Solutions:**

1. Use `include` to fetch related data
2. Use `select` to limit fields
3. Use the optimized helpers in `db-optimization.ts`
4. Review the query analyzer output for suspects

### High Memory Usage

**Symptom:** Application memory grows over time

**Solutions:**

1. Limit result set sizes with pagination
2. Don't load large JSON fields unnecessarily
3. Clean up old memories: `cleanupOldMemories()`
4. Monitor Prisma query cache size

---

## Migration Guide

### Adding New Indexes

1. Create migration file:

```bash
# Generate timestamp
TIMESTAMP=$(date +%Y%m%d%H%M%S)
mkdir -p prisma/migrations/${TIMESTAMP}_add_indexes
```

2. Add SQL to migration file:

```sql
-- prisma/migrations/YYYYMMDDHHMMSS_add_indexes/migration.sql
CREATE INDEX IF NOT EXISTS idx_table_column ON "Table"(column);
```

3. Apply migration:

```bash
npx prisma migrate deploy
```

### Performance Testing

Before deploying index changes:

1. Test on staging with realistic data volumes
2. Measure query performance before and after
3. Check index size impact on disk
4. Monitor during peak load

---

## Related Documentation

- [Prisma Documentation](https://www.prisma.io/docs)
- [PostgreSQL Index Documentation](https://www.postgresql.org/docs/current/indexes.html)
- [Connection Pooling Guide](https://www.prisma.io/docs/guides/performance-and-optimization/connection-pooling)
