ALTER TABLE "Issue"
ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;

WITH ranked_issues AS (
    SELECT
        "id",
        ROW_NUMBER() OVER (
            PARTITION BY "sectionId"
            ORDER BY "createdAt", "id"
        ) - 1 AS "position"
    FROM "Issue"
    WHERE "isDeleted" = false
)
UPDATE "Issue"
SET "position" = ranked_issues."position"
FROM ranked_issues
WHERE "Issue"."id" = ranked_issues."id";

CREATE INDEX "Issue_sectionId_position_idx"
ON "Issue"("sectionId", "position");
