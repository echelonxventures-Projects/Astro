/*
  Warnings:

  - You are about to drop the `AIPlanConfig` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "ChatSession" ADD COLUMN "metadata" JSONB;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "AIPlanConfig";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "AIProviderConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "plan" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'ollama',
    "model" TEXT NOT NULL DEFAULT 'llama3.2',
    "apiKey" TEXT,
    "ollamaUrl" TEXT,
    "baseUrl" TEXT,
    "maxTokens" INTEGER NOT NULL DEFAULT 512,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Region" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "currencies" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "priceMultiplier" REAL NOT NULL DEFAULT 1.0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SubscriptionPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "price" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "interval" TEXT,
    "stripePriceId" TEXT,
    "stripeProductId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPopular" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "features" TEXT,
    "aiConfig" TEXT,
    "metadata" TEXT,
    "regionalPricing" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PlanFeature" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PlanFeatureAccess" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planId" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "value" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlanFeatureAccess_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "PlanFeature" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlanFeatureAccess_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AIProviderConfig_plan_idx" ON "AIProviderConfig"("plan");

-- CreateIndex
CREATE UNIQUE INDEX "Region_key_key" ON "Region"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Region_code_key" ON "Region"("code");

-- CreateIndex
CREATE INDEX "Region_key_idx" ON "Region"("key");

-- CreateIndex
CREATE INDEX "Region_code_idx" ON "Region"("code");

-- CreateIndex
CREATE INDEX "Region_isActive_idx" ON "Region"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPlan_key_key" ON "SubscriptionPlan"("key");

-- CreateIndex
CREATE INDEX "SubscriptionPlan_key_idx" ON "SubscriptionPlan"("key");

-- CreateIndex
CREATE INDEX "SubscriptionPlan_isActive_idx" ON "SubscriptionPlan"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PlanFeature_key_key" ON "PlanFeature"("key");

-- CreateIndex
CREATE INDEX "PlanFeature_key_idx" ON "PlanFeature"("key");

-- CreateIndex
CREATE INDEX "PlanFeature_isActive_idx" ON "PlanFeature"("isActive");

-- CreateIndex
CREATE INDEX "PlanFeature_category_idx" ON "PlanFeature"("category");

-- CreateIndex
CREATE INDEX "PlanFeatureAccess_planId_idx" ON "PlanFeatureAccess"("planId");

-- CreateIndex
CREATE INDEX "PlanFeatureAccess_featureId_idx" ON "PlanFeatureAccess"("featureId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanFeatureAccess_planId_featureId_key" ON "PlanFeatureAccess"("planId", "featureId");
