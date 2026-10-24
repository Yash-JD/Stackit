ALTER TABLE "User"
ADD COLUMN "name" TEXT;

UPDATE "User"
SET "name" = split_part("email", '@', 1)
WHERE "name" IS NULL;
