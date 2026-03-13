-- CreateTable
CREATE TABLE "StreamHistory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "friendId" INTEGER NOT NULL,
    "videoId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME NOT NULL,
    "durationSec" INTEGER NOT NULL DEFAULT 0,
    "gameName" TEXT NOT NULL DEFAULT '',
    "gameId" TEXT NOT NULL DEFAULT '',
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StreamHistory_friendId_fkey" FOREIGN KEY ("friendId") REFERENCES "Friend" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "StreamHistory_videoId_key" ON "StreamHistory"("videoId");
