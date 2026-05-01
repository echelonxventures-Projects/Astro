-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "emailVerified" DATETIME,
    "name" TEXT,
    "image" TEXT,
    "passwordHash" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "birthDate" DATETIME,
    "birthTime" TEXT,
    "birthPlace" TEXT,
    "birthLatitude" REAL,
    "birthLongitude" REAL,
    "birthTimezone" TEXT,
    "subscriptionStatus" TEXT NOT NULL DEFAULT 'free',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "subscriptionPlan" TEXT,
    "currentPeriodEnd" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("birthDate", "birthLatitude", "birthLongitude", "birthPlace", "birthTime", "birthTimezone", "createdAt", "currentPeriodEnd", "email", "emailVerified", "id", "image", "name", "passwordHash", "stripeCustomerId", "stripeSubscriptionId", "subscriptionPlan", "subscriptionStatus", "updatedAt") SELECT "birthDate", "birthLatitude", "birthLongitude", "birthPlace", "birthTime", "birthTimezone", "createdAt", "currentPeriodEnd", "email", "emailVerified", "id", "image", "name", "passwordHash", "stripeCustomerId", "stripeSubscriptionId", "subscriptionPlan", "subscriptionStatus", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "AppSettings_key_key" ON "AppSettings"("key");
