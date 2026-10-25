ALTER TABLE "Issue"
ADD COLUMN "label" TEXT NOT NULL DEFAULT 'Build',
ADD COLUMN "dueDate" DATE;

CREATE TABLE "IssueActivity" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IssueActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "IssueActivity_issueId_createdAt_idx"
ON "IssueActivity"("issueId", "createdAt");

ALTER TABLE "IssueActivity"
ADD CONSTRAINT "IssueActivity_issueId_fkey"
FOREIGN KEY ("issueId") REFERENCES "Issue"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IssueActivity"
ADD CONSTRAINT "IssueActivity_actorId_fkey"
FOREIGN KEY ("actorId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
