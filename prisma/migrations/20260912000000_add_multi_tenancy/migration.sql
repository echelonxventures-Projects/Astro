-- Multi-tenancy: Tenant + TenantDomain, tenantId on all customer-facing tables.
-- All existing rows are backfilled into the default tenant "tenant_starpath_default".

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "branding" JSONB,
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantDomain" (
    "id" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantDomain_pkey" PRIMARY KEY ("id")
);

-- Default tenant + local dev domains
INSERT INTO "Tenant" ("id", "slug", "name", "status", "isDefault", "createdAt", "updatedAt")
VALUES ('tenant_starpath_default', 'starpath', 'StarPath Astrology', 'active', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "TenantDomain" ("id", "host", "tenantId", "isPrimary", "createdAt") VALUES
    (md5('domain-starpath-localhost'), 'localhost', 'tenant_starpath_default', true, CURRENT_TIMESTAMP),
    (md5('domain-starpath-127'), '127.0.0.1', 'tenant_starpath_default', false, CURRENT_TIMESTAMP),
    (md5('domain-starpath-sub'), 'starpath.localhost', 'tenant_starpath_default', false, CURRENT_TIMESTAMP);

CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");
CREATE INDEX "Tenant_status_idx" ON "Tenant"("status");
CREATE UNIQUE INDEX "TenantDomain_host_key" ON "TenantDomain"("host");
CREATE INDEX "TenantDomain_tenantId_idx" ON "TenantDomain"("tenantId");
ALTER TABLE "TenantDomain" ADD CONSTRAINT "TenantDomain_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ===========================================
-- Add tenantId (NOT NULL, backfilled) + FK + indexes
-- ===========================================

-- User
ALTER TABLE "User" ADD COLUMN "tenantId" TEXT;
UPDATE "User" SET "tenantId" = 'tenant_starpath_default';
ALTER TABLE "User" ALTER COLUMN "tenantId" SET NOT NULL;
DROP INDEX "User_email_key";
CREATE UNIQUE INDEX "User_tenantId_email_key" ON "User"("tenantId", "email");
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- BirthChart
ALTER TABLE "BirthChart" ADD COLUMN "tenantId" TEXT;
UPDATE "BirthChart" SET "tenantId" = 'tenant_starpath_default';
ALTER TABLE "BirthChart" ALTER COLUMN "tenantId" SET NOT NULL;
CREATE INDEX "BirthChart_tenantId_idx" ON "BirthChart"("tenantId");
ALTER TABLE "BirthChart" ADD CONSTRAINT "BirthChart_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Reading
ALTER TABLE "Reading" ADD COLUMN "tenantId" TEXT;
UPDATE "Reading" SET "tenantId" = 'tenant_starpath_default';
ALTER TABLE "Reading" ALTER COLUMN "tenantId" SET NOT NULL;
CREATE INDEX "Reading_tenantId_idx" ON "Reading"("tenantId");
ALTER TABLE "Reading" ADD CONSTRAINT "Reading_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ChatSession
ALTER TABLE "ChatSession" ADD COLUMN "tenantId" TEXT;
UPDATE "ChatSession" SET "tenantId" = 'tenant_starpath_default';
ALTER TABLE "ChatSession" ALTER COLUMN "tenantId" SET NOT NULL;
CREATE INDEX "ChatSession_tenantId_idx" ON "ChatSession"("tenantId");
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Subscription
ALTER TABLE "Subscription" ADD COLUMN "tenantId" TEXT;
UPDATE "Subscription" SET "tenantId" = 'tenant_starpath_default';
ALTER TABLE "Subscription" ALTER COLUMN "tenantId" SET NOT NULL;
CREATE INDEX "Subscription_tenantId_idx" ON "Subscription"("tenantId");
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Payment
ALTER TABLE "Payment" ADD COLUMN "tenantId" TEXT;
UPDATE "Payment" SET "tenantId" = 'tenant_starpath_default';
ALTER TABLE "Payment" ALTER COLUMN "tenantId" SET NOT NULL;
CREATE INDEX "Payment_tenantId_idx" ON "Payment"("tenantId");
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PaymentTransaction
ALTER TABLE "PaymentTransaction" ADD COLUMN "tenantId" TEXT;
UPDATE "PaymentTransaction" SET "tenantId" = 'tenant_starpath_default';
ALTER TABLE "PaymentTransaction" ALTER COLUMN "tenantId" SET NOT NULL;
CREATE INDEX "PaymentTransaction_tenantId_idx" ON "PaymentTransaction"("tenantId");
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Notification
ALTER TABLE "Notification" ADD COLUMN "tenantId" TEXT;
UPDATE "Notification" SET "tenantId" = 'tenant_starpath_default';
ALTER TABLE "Notification" ALTER COLUMN "tenantId" SET NOT NULL;
CREATE INDEX "Notification_tenantId_idx" ON "Notification"("tenantId");
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- UserDevice
ALTER TABLE "UserDevice" ADD COLUMN "tenantId" TEXT;
UPDATE "UserDevice" SET "tenantId" = 'tenant_starpath_default';
ALTER TABLE "UserDevice" ALTER COLUMN "tenantId" SET NOT NULL;
CREATE INDEX "UserDevice_tenantId_idx" ON "UserDevice"("tenantId");
ALTER TABLE "UserDevice" ADD CONSTRAINT "UserDevice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- UserMemory (unique now includes tenant)
ALTER TABLE "UserMemory" ADD COLUMN "tenantId" TEXT;
UPDATE "UserMemory" SET "tenantId" = 'tenant_starpath_default';
ALTER TABLE "UserMemory" ALTER COLUMN "tenantId" SET NOT NULL;
DROP INDEX "UserMemory_userId_key_key";
CREATE UNIQUE INDEX "UserMemory_tenantId_userId_key_key" ON "UserMemory"("tenantId", "userId", "key");
CREATE INDEX "UserMemory_tenantId_idx" ON "UserMemory"("tenantId");
ALTER TABLE "UserMemory" ADD CONSTRAINT "UserMemory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AstroProfile
ALTER TABLE "AstroProfile" ADD COLUMN "tenantId" TEXT;
UPDATE "AstroProfile" SET "tenantId" = 'tenant_starpath_default';
ALTER TABLE "AstroProfile" ALTER COLUMN "tenantId" SET NOT NULL;
CREATE INDEX "AstroProfile_tenantId_idx" ON "AstroProfile"("tenantId");
ALTER TABLE "AstroProfile" ADD CONSTRAINT "AstroProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AppSettings (key unique now per tenant)
ALTER TABLE "AppSettings" ADD COLUMN "tenantId" TEXT;
UPDATE "AppSettings" SET "tenantId" = 'tenant_starpath_default';
ALTER TABLE "AppSettings" ALTER COLUMN "tenantId" SET NOT NULL;
DROP INDEX "AppSettings_key_key";
CREATE UNIQUE INDEX "AppSettings_tenantId_key_key" ON "AppSettings"("tenantId", "key");
CREATE INDEX "AppSettings_tenantId_idx" ON "AppSettings"("tenantId");
ALTER TABLE "AppSettings" ADD CONSTRAINT "AppSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AIProviderConfig
ALTER TABLE "AIProviderConfig" ADD COLUMN "tenantId" TEXT;
UPDATE "AIProviderConfig" SET "tenantId" = 'tenant_starpath_default';
ALTER TABLE "AIProviderConfig" ALTER COLUMN "tenantId" SET NOT NULL;
CREATE INDEX "AIProviderConfig_tenantId_idx" ON "AIProviderConfig"("tenantId");
ALTER TABLE "AIProviderConfig" ADD CONSTRAINT "AIProviderConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SubscriptionPlan (key unique now per tenant)
ALTER TABLE "SubscriptionPlan" ADD COLUMN "tenantId" TEXT;
UPDATE "SubscriptionPlan" SET "tenantId" = 'tenant_starpath_default';
ALTER TABLE "SubscriptionPlan" ALTER COLUMN "tenantId" SET NOT NULL;
DROP INDEX "SubscriptionPlan_key_key";
CREATE UNIQUE INDEX "SubscriptionPlan_tenantId_key_key" ON "SubscriptionPlan"("tenantId", "key");
CREATE INDEX "SubscriptionPlan_tenantId_idx" ON "SubscriptionPlan"("tenantId");
ALTER TABLE "SubscriptionPlan" ADD CONSTRAINT "SubscriptionPlan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PlanFeature (key unique now per tenant)
ALTER TABLE "PlanFeature" ADD COLUMN "tenantId" TEXT;
UPDATE "PlanFeature" SET "tenantId" = 'tenant_starpath_default';
ALTER TABLE "PlanFeature" ALTER COLUMN "tenantId" SET NOT NULL;
DROP INDEX "PlanFeature_key_key";
CREATE UNIQUE INDEX "PlanFeature_tenantId_key_key" ON "PlanFeature"("tenantId", "key");
CREATE INDEX "PlanFeature_tenantId_idx" ON "PlanFeature"("tenantId");
ALTER TABLE "PlanFeature" ADD CONSTRAINT "PlanFeature_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PaymentGateway (key unique now per tenant)
ALTER TABLE "PaymentGateway" ADD COLUMN "tenantId" TEXT;
UPDATE "PaymentGateway" SET "tenantId" = 'tenant_starpath_default';
ALTER TABLE "PaymentGateway" ALTER COLUMN "tenantId" SET NOT NULL;
DROP INDEX "PaymentGateway_key_key";
CREATE UNIQUE INDEX "PaymentGateway_tenantId_key_key" ON "PaymentGateway"("tenantId", "key");
CREATE INDEX "PaymentGateway_tenantId_idx" ON "PaymentGateway"("tenantId");
ALTER TABLE "PaymentGateway" ADD CONSTRAINT "PaymentGateway_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PaymentAuditLog (nullable tenant attribution)
ALTER TABLE "PaymentAuditLog" ADD COLUMN "tenantId" TEXT;
UPDATE "PaymentAuditLog" SET "tenantId" = 'tenant_starpath_default';
CREATE INDEX "PaymentAuditLog_tenantId_idx" ON "PaymentAuditLog"("tenantId");
