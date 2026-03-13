-- CreateTable
CREATE TABLE "CollabSignal" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "friendId" INTEGER NOT NULL,
    "partnerName" TEXT NOT NULL,
    "partnerLogin" TEXT NOT NULL DEFAULT '',
    "detectedAt" DATETIME NOT NULL,
    "source" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "confidence" TEXT NOT NULL DEFAULT 'medium',
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CollabSignal_friendId_fkey" FOREIGN KEY ("friendId") REFERENCES "Friend" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CollabSignal_friendId_partnerLogin_detectedAt_key" ON "CollabSignal"("friendId", "partnerLogin", "detectedAt");
