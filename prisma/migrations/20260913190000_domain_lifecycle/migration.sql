-- Domain lifecycle: staged statuses, check history, liveness
ALTER TABLE "TenantDomain" ADD COLUMN "lastCheckedAt" TIMESTAMP(3);
ALTER TABLE "TenantDomain" ADD COLUMN "lastCheckMessage" TEXT;
ALTER TABLE "TenantDomain" ADD COLUMN "live" BOOLEAN NOT NULL DEFAULT false;

-- migrate old 'pending' rows to the staged vocabulary
UPDATE "TenantDomain" SET "status" = 'pending_dns' WHERE "status" = 'pending';

CREATE TABLE "DomainCheck" (
    "id" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "dnsFound" BOOLEAN NOT NULL DEFAULT false,
    "txtFound" BOOLEAN NOT NULL DEFAULT false,
    "httpsOk" BOOLEAN NOT NULL DEFAULT false,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DomainCheck_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DomainCheck_domainId_checkedAt_idx" ON "DomainCheck"("domainId", "checkedAt");
ALTER TABLE "DomainCheck" ADD CONSTRAINT "DomainCheck_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "TenantDomain"("id") ON DELETE CASCADE ON UPDATE CASCADE;
