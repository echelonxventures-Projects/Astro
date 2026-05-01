-- CreateTable
CREATE TABLE "AIPlanConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "plan" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'ollama',
    "model" TEXT NOT NULL DEFAULT 'llama3.2',
    "apiKey" TEXT,
    "ollamaUrl" TEXT,
    "maxTokens" INTEGER NOT NULL DEFAULT 512,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "AIPlanConfig_plan_key" ON "AIPlanConfig"("plan");
