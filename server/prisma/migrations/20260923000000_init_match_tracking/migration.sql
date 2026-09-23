-- Initial PostgreSQL tournament and match-recording schema.
-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ABORTED');

-- CreateEnum
CREATE TYPE "MatchEventType" AS ENUM (
  'PLAYER_JOINED',
  'PLAYER_ELIMINATED',
  'GENERAL_CAPTURED',
  'PLAYER_SURRENDERED',
  'MATCH_STARTED',
  'MATCH_FINISHED',
  'MATCH_ABORTED'
);

-- CreateTable
CREATE TABLE "Event" (
  "id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "status" "EventStatus" NOT NULL DEFAULT 'PLANNED',
  "startedAt" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
  "id" UUID NOT NULL,
  "eventId" UUID,
  "roomId" TEXT NOT NULL,
  "status" "MatchStatus" NOT NULL DEFAULT 'ACTIVE',
  "startedAt" TIMESTAMP(3) NOT NULL,
  "endedAt" TIMESTAMP(3),
  "winnerPlayerId" TEXT,
  "winnerTeam" INTEGER,
  "finalTurn" INTEGER,
  "durationSeconds" INTEGER,
  "replayId" TEXT,
  "replayStorage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchPlayer" (
  "id" UUID NOT NULL,
  "matchId" UUID NOT NULL,
  "playerId" TEXT NOT NULL,
  "playerName" TEXT NOT NULL,
  "codeforcesHandle" TEXT,
  "team" INTEGER NOT NULL,
  "color" INTEGER NOT NULL,
  "isSpectator" BOOLEAN NOT NULL DEFAULT false,
  "isWinner" BOOLEAN NOT NULL DEFAULT false,
  "placement" INTEGER,
  "joinedAt" TIMESTAMP(3) NOT NULL,
  "eliminatedAt" TIMESTAMP(3),
  "eliminationReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MatchPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchEvent" (
  "id" UUID NOT NULL,
  "matchId" UUID NOT NULL,
  "sequenceNumber" INTEGER NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "type" "MatchEventType" NOT NULL,
  "playerId" TEXT,
  "timestamp" TIMESTAMP(3) NOT NULL,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MatchEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Event_status_idx" ON "Event"("status");
CREATE INDEX "Event_startedAt_idx" ON "Event"("startedAt");
CREATE INDEX "Match_eventId_idx" ON "Match"("eventId");
CREATE INDEX "Match_roomId_idx" ON "Match"("roomId");
CREATE INDEX "Match_status_idx" ON "Match"("status");
CREATE INDEX "Match_startedAt_idx" ON "Match"("startedAt");
CREATE UNIQUE INDEX "MatchPlayer_matchId_playerId_key" ON "MatchPlayer"("matchId", "playerId");
CREATE INDEX "MatchPlayer_matchId_idx" ON "MatchPlayer"("matchId");
CREATE INDEX "MatchPlayer_playerId_idx" ON "MatchPlayer"("playerId");
CREATE INDEX "MatchPlayer_codeforcesHandle_idx" ON "MatchPlayer"("codeforcesHandle");
CREATE UNIQUE INDEX "MatchEvent_matchId_sequenceNumber_key" ON "MatchEvent"("matchId", "sequenceNumber");
CREATE UNIQUE INDEX "MatchEvent_matchId_idempotencyKey_key" ON "MatchEvent"("matchId", "idempotencyKey");
CREATE INDEX "MatchEvent_matchId_idx" ON "MatchEvent"("matchId");
CREATE INDEX "MatchEvent_type_idx" ON "MatchEvent"("type");
CREATE INDEX "MatchEvent_timestamp_idx" ON "MatchEvent"("timestamp");

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MatchPlayer" ADD CONSTRAINT "MatchPlayer_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatchEvent" ADD CONSTRAINT "MatchEvent_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
