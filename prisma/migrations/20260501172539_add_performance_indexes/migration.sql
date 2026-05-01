-- Database Performance Optimization Migration
-- Adds indexes for frequently queried columns to improve query performance
-- Migration: 20260501172539_add_performance_indexes

-- Note: SQLite doesn't support CONCURRENTLY, but PostgreSQL does
-- These indexes are designed to work with both SQLite (dev) and PostgreSQL (production)

-- Reading table indexes for listing readings by creation date
CREATE INDEX IF NOT EXISTS idx_reading_created_at ON "Reading"(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reading_user_created_at ON "Reading"(user_id, created_at);

-- User table index for filtering by subscription status
CREATE INDEX IF NOT EXISTS idx_user_subscription_status ON "User"(subscription_status);

-- Payment table composite index for status-based queries with date filtering
CREATE INDEX IF NOT EXISTS idx_payment_status_created_at ON "Payment"(status, created_at);

-- ChatSession table index for recent/active session queries
CREATE INDEX IF NOT EXISTS idx_chat_last_active ON "ChatSession"(last_active_at DESC);

-- Notification table composite index for unread notifications per user
CREATE INDEX IF NOT EXISTS idx_notification_user_read ON "Notification"(user_id, is_read);

-- BirthChart table composite index for user's charts sorted by date
CREATE INDEX IF NOT EXISTS idx_birthchart_user_created_at ON "BirthChart"(user_id, created_at);

-- Additional indexes for common query patterns

-- User email index for lookups (already unique, but ensuring index exists)
-- Note: Prisma's @unique already creates an index, this is a no-op for most DBs

-- PaymentTransaction indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_transaction_status ON "PaymentTransaction"(status);
CREATE INDEX IF NOT EXISTS idx_transaction_user_created ON "PaymentTransaction"(user_id, created_at);

-- UserDevice index for active sessions
CREATE INDEX IF NOT EXISTS idx_device_user_active ON "UserDevice"(user_id, is_active);

-- UserMemory index for category lookups
CREATE INDEX IF NOT EXISTS idx_memory_user_category ON "UserMemory"(user_id, category);

-- Subscription index for status lookups
CREATE INDEX IF NOT EXISTS idx_subscription_status ON "Subscription"(status);
