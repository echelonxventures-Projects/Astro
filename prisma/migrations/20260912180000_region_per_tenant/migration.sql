-- Region becomes tenant-scoped. Existing global rows are cloned to every tenant.
ALTER TABLE "Region" ADD COLUMN "tenantId" TEXT;

-- Default tenant adopts the existing rows
UPDATE "Region" SET "tenantId" = 'tenant_starpath_default' WHERE "tenantId" IS NULL;

-- Drop global uniques BEFORE cloning
DROP INDEX IF EXISTS "Region_key_key";
DROP INDEX IF EXISTS "Region_code_key";

-- Clone the full template to every other tenant
INSERT INTO "Region" ("id","name","key","code","currency","currencies","isActive","isDefault","sortOrder","priceMultiplier","createdAt","updatedAt","tenantId")
SELECT md5(random()::text || clock_timestamp()::text || r."id" || t.id),
       r."name", r."key", r."code", r."currency", r."currencies", r."isActive", r."isDefault",
       r."sortOrder", r."priceMultiplier", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, t.id
FROM "Region" r
CROSS JOIN "Tenant" t
WHERE t.id <> 'tenant_starpath_default';

ALTER TABLE "Region" ALTER COLUMN "tenantId" SET NOT NULL;

CREATE UNIQUE INDEX "Region_tenantId_key_key" ON "Region"("tenantId", "key");
CREATE UNIQUE INDEX "Region_tenantId_code_key" ON "Region"("tenantId", "code");
CREATE INDEX "Region_tenantId_idx" ON "Region"("tenantId");
ALTER TABLE "Region" ADD CONSTRAINT "Region_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
