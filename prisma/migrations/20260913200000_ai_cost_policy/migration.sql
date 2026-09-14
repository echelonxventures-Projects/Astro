-- AI provider cost class (free | paid) for the tenant routing policy.
ALTER TABLE "AIProviderCatalog" ADD COLUMN "cost" TEXT NOT NULL DEFAULT 'free';
UPDATE "AIProviderCatalog" SET "cost" = 'paid' WHERE "key" IN ('anthropic', 'gemini');
