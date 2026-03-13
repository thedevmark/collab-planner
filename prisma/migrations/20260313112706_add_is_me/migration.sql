-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Friend" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "twitchId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isMe" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Friend" ("avatarUrl", "createdAt", "displayName", "id", "isActive", "notes", "twitchId", "updatedAt", "username") SELECT "avatarUrl", "createdAt", "displayName", "id", "isActive", "notes", "twitchId", "updatedAt", "username" FROM "Friend";
DROP TABLE "Friend";
ALTER TABLE "new_Friend" RENAME TO "Friend";
CREATE UNIQUE INDEX "Friend_twitchId_key" ON "Friend"("twitchId");
CREATE UNIQUE INDEX "Friend_username_key" ON "Friend"("username");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
