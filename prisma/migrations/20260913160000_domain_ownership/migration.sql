-- Domain ownership classes + verification state.
-- All pre-existing rows are local/in-house hosts -> auto-verified.
ALTER TABLE "TenantDomain" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'in_house';
ALTER TABLE "TenantDomain" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'verified';
ALTER TABLE "TenantDomain" ADD COLUMN "verificationToken" TEXT;
ALTER TABLE "TenantDomain" ADD COLUMN "verifiedAt" TIMESTAMP(3);
ALTER TABLE "TenantDomain" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "TenantDomain" SET "verifiedAt" = CURRENT_TIMESTAMP WHERE "verifiedAt" IS NULL;

CREATE INDEX "TenantDomain_status_idx" ON "TenantDomain"("status");
