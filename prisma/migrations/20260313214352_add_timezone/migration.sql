-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "twitchUsername" TEXT NOT NULL DEFAULT '',
    "broadcasterId" TEXT NOT NULL DEFAULT '',
    "twitchClientId" TEXT NOT NULL DEFAULT '',
    "twitchClientSecret" TEXT NOT NULL DEFAULT '',
    "geminiApiKey" TEXT NOT NULL DEFAULT '',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "refreshInterval" INTEGER NOT NULL DEFAULT 360,
    "notificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Settings" ("broadcasterId", "createdAt", "geminiApiKey", "id", "notificationsEnabled", "refreshInterval", "twitchClientId", "twitchClientSecret", "twitchUsername", "updatedAt") SELECT "broadcasterId", "createdAt", "geminiApiKey", "id", "notificationsEnabled", "refreshInterval", "twitchClientId", "twitchClientSecret", "twitchUsername", "updatedAt" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
