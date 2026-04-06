-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "franchiseName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MlbTeam" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "abbr" TEXT NOT NULL,

    CONSTRAINT "MlbTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MlbPlayer" (
    "id" TEXT NOT NULL,
    "mlbTeamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "contact" INTEGER NOT NULL DEFAULT 5,
    "power" INTEGER NOT NULL DEFAULT 5,
    "speed" INTEGER NOT NULL DEFAULT 5,
    "pitching" INTEGER NOT NULL DEFAULT 5,
    "isPitcher" BOOLEAN NOT NULL DEFAULT false,
    "lineupOrder" INTEGER,

    CONSTRAINT "MlbPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mlbTeamId" TEXT NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "mlbPlayerId" TEXT NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "inning" INTEGER NOT NULL DEFAULT 1,
    "halfInning" TEXT NOT NULL DEFAULT 'bot',
    "outs" INTEGER NOT NULL DEFAULT 0,
    "homeScore" INTEGER NOT NULL DEFAULT 0,
    "awayScore" INTEGER NOT NULL DEFAULT 0,
    "runnersOnBase" JSONB NOT NULL DEFAULT '{"first":null,"second":null,"third":null}',
    "lineupPosition" INTEGER NOT NULL DEFAULT 0,
    "cpuLineupPosition" INTEGER NOT NULL DEFAULT 0,
    "gameLog" JSONB NOT NULL DEFAULT '[]',
    "gameStats" JSONB NOT NULL DEFAULT '{}',
    "cpuGameStats" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "cpuTeamName" TEXT NOT NULL,
    "cpuTeamAbbr" TEXT NOT NULL,
    "cpuLineup" JSONB NOT NULL,
    "cpuPitcher" JSONB NOT NULL,
    "userPitcherId" TEXT NOT NULL,
    "result" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerSeason" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "games" INTEGER NOT NULL DEFAULT 0,
    "atBats" INTEGER NOT NULL DEFAULT 0,
    "hits" INTEGER NOT NULL DEFAULT 0,
    "doubles" INTEGER NOT NULL DEFAULT 0,
    "triples" INTEGER NOT NULL DEFAULT 0,
    "homeRuns" INTEGER NOT NULL DEFAULT 0,
    "rbi" INTEGER NOT NULL DEFAULT 0,
    "walks" INTEGER NOT NULL DEFAULT 0,
    "strikeouts" INTEGER NOT NULL DEFAULT 0,
    "gamesStarted" INTEGER NOT NULL DEFAULT 0,
    "inningsPitched" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hitsAllowed" INTEGER NOT NULL DEFAULT 0,
    "walksAllowed" INTEGER NOT NULL DEFAULT 0,
    "strikeoutsThrown" INTEGER NOT NULL DEFAULT 0,
    "earnedRuns" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PlayerSeason_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "MlbTeam_name_key" ON "MlbTeam"("name");

-- CreateIndex
CREATE UNIQUE INDEX "MlbTeam_abbr_key" ON "MlbTeam"("abbr");

-- CreateIndex
CREATE UNIQUE INDEX "Team_userId_key" ON "Team"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerSeason_playerId_key" ON "PlayerSeason"("playerId");

-- AddForeignKey
ALTER TABLE "MlbPlayer" ADD CONSTRAINT "MlbPlayer_mlbTeamId_fkey" FOREIGN KEY ("mlbTeamId") REFERENCES "MlbTeam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_mlbTeamId_fkey" FOREIGN KEY ("mlbTeamId") REFERENCES "MlbTeam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_mlbPlayerId_fkey" FOREIGN KEY ("mlbPlayerId") REFERENCES "MlbPlayer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerSeason" ADD CONSTRAINT "PlayerSeason_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerSeason" ADD CONSTRAINT "PlayerSeason_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
