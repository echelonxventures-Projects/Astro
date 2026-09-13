-- Platform hierarchy + master configuration
ALTER TABLE "Tenant" ADD COLUMN "parentId" TEXT;
CREATE INDEX "Tenant_parentId_idx" ON "Tenant"("parentId");
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- LunaAstro becomes a sub-platform of the default (root) platform
UPDATE "Tenant" SET "parentId" = 'tenant_starpath_default' WHERE "slug" = 'luna' AND "parentId" IS NULL;

-- Root platform master config: grants everything to itself/children
UPDATE "Tenant"
SET "settings" = COALESCE("settings"::jsonb, '{}'::jsonb) || '{
  "master": {
    "allowedLanguages": ["en","es","fr","de","it","pt","ru","ja","zh","hi","ar","ko","tr","nl","pl"],
    "allowedRegions": ["us","eu","in","uk","global"],
    "allowedGateways": ["stripe","razorpay","paypal"],
    "allowedAiProviders": ["openrouter","nvidia","ollama","anthropic","gemini","opencode"],
    "canCreateChildren": true,
    "maxChildren": null,
    "childDefaults": { "language": "en", "region": "us", "aiProvider": "openrouter" }
  }
}'::jsonb
WHERE "slug" = 'starpath';

-- Luna gets narrower grants from its parent (tests the model): 2 langs, 2 markets, razorpay only, may create children
UPDATE "Tenant"
SET "settings" = COALESCE("settings"::jsonb, '{}'::jsonb) || '{
  "master": {
    "allowedLanguages": ["en","hi"],
    "allowedRegions": ["us","in"],
    "allowedGateways": ["razorpay"],
    "allowedAiProviders": ["openrouter","ollama","gemini"],
    "canCreateChildren": true,
    "maxChildren": 5,
    "childDefaults": { "language": "en", "region": "in", "aiProvider": "openrouter" }
  }
}'::jsonb
WHERE "slug" = 'luna';
