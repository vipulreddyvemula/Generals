-- Clarify the existing replay storage discriminator and persist the backend-only object key.
ALTER TABLE "Match" RENAME COLUMN "replayStorage" TO "replayStorageType";
ALTER TABLE "Match" ADD COLUMN "replayObjectKey" TEXT;
