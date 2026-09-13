-- CreateTable
CREATE TABLE "AIProviderCatalog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'openai-compatible',
    "baseUrl" TEXT,
    "apiKey" TEXT,
    "models" TEXT,
    "capabilities" TEXT,
    "options" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIProviderCatalog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AIProviderCatalog_tenantId_key_key" ON "AIProviderCatalog"("tenantId", "key");
CREATE INDEX "AIProviderCatalog_tenantId_idx" ON "AIProviderCatalog"("tenantId");
CREATE INDEX "AIProviderCatalog_enabled_idx" ON "AIProviderCatalog"("enabled");
ALTER TABLE "AIProviderCatalog" ADD CONSTRAINT "AIProviderCatalog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SubscriptionPlan tier
ALTER TABLE "SubscriptionPlan" ADD COLUMN "tier" TEXT NOT NULL DEFAULT 'free';
UPDATE "SubscriptionPlan" SET "tier" = 'paid' WHERE "key" <> 'free';
