-- CreateTable
CREATE TABLE "CollabInviteRecipient" (
    "id" SERIAL NOT NULL,
    "inviteId" INTEGER NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL DEFAULT '',
    "avatarUrl" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "respondedAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "claimedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollabInviteRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CollabInviteRecipient_inviteId_username_key" ON "CollabInviteRecipient"("inviteId", "username");

-- AddForeignKey
ALTER TABLE "CollabInviteRecipient"
ADD CONSTRAINT "CollabInviteRecipient_inviteId_fkey"
FOREIGN KEY ("inviteId") REFERENCES "CollabInvite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill existing invite arrays into recipient rows
INSERT INTO "CollabInviteRecipient" (
    "inviteId",
    "username",
    "displayName",
    "avatarUrl",
    "status",
    "createdAt",
    "updatedAt"
)
SELECT
    invite."id",
    recipient."username",
    COALESCE(recipient."displayName", ''),
    COALESCE(recipient."avatarUrl", ''),
    'pending',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "CollabInvite" AS invite,
LATERAL unnest(
    invite."participantUsernames",
    invite."participantDisplayNames",
    invite."participantAvatarUrls"
) AS recipient("username", "displayName", "avatarUrl")
WHERE COALESCE(recipient."username", '') <> ''
ON CONFLICT ("inviteId", "username") DO NOTHING;
