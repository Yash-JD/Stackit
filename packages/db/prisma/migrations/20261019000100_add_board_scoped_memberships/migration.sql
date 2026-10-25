CREATE TABLE "BoardMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoardMembership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InvitationBoard" (
    "id" TEXT NOT NULL,
    "invitationId" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvitationBoard_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BoardMembership_userId_boardId_key"
ON "BoardMembership"("userId", "boardId");

CREATE UNIQUE INDEX "InvitationBoard_invitationId_boardId_key"
ON "InvitationBoard"("invitationId", "boardId");

WITH "rankedAdmins" AS (
    SELECT
        "id",
        ROW_NUMBER() OVER (
            PARTITION BY "orgId"
            ORDER BY "createdAt", "id"
        ) AS "adminRank"
    FROM "Membership"
    WHERE "role" = 'admin' AND "isDeleted" = false
)
UPDATE "Membership" AS "membership"
SET "role" = 'superadmin'
FROM "rankedAdmins"
WHERE "membership"."id" = "rankedAdmins"."id"
  AND "rankedAdmins"."adminRank" = 1;

CREATE UNIQUE INDEX "Membership_one_active_superadmin_per_org"
ON "Membership"("orgId")
WHERE "role" = 'superadmin' AND "isDeleted" = false;

ALTER TABLE "BoardMembership"
ADD CONSTRAINT "BoardMembership_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BoardMembership"
ADD CONSTRAINT "BoardMembership_boardId_fkey"
FOREIGN KEY ("boardId") REFERENCES "Boards"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InvitationBoard"
ADD CONSTRAINT "InvitationBoard_invitationId_fkey"
FOREIGN KEY ("invitationId") REFERENCES "Invitation"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InvitationBoard"
ADD CONSTRAINT "InvitationBoard_boardId_fkey"
FOREIGN KEY ("boardId") REFERENCES "Boards"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
