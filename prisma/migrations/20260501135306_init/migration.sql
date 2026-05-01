-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "telegramId" TEXT NOT NULL,
    "walletAddress" TEXT,
    "watchlist" TEXT NOT NULL DEFAULT '[]',
    "preferences" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "EpisodicMemory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventPayload" TEXT NOT NULL,
    "reasoningTrace" TEXT NOT NULL,
    "confidence" REAL NOT NULL,
    "actionType" TEXT,
    "actionPayload" TEXT,
    "userResponse" TEXT,
    "executedAt" DATETIME,
    "executionResult" TEXT,
    "pnl1h" REAL,
    "pnl24h" REAL,
    "pnl7d" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EpisodicMemory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SemanticMemory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "confidence" REAL NOT NULL,
    "source" TEXT NOT NULL,
    "embedding" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SemanticMemory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProcessedEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventSignature" TEXT NOT NULL,
    "processedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramId_key" ON "User"("telegramId");

-- CreateIndex
CREATE INDEX "EpisodicMemory_userId_createdAt_idx" ON "EpisodicMemory"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "EpisodicMemory_eventType_idx" ON "EpisodicMemory"("eventType");

-- CreateIndex
CREATE INDEX "SemanticMemory_userId_key_idx" ON "SemanticMemory"("userId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessedEvent_eventSignature_key" ON "ProcessedEvent"("eventSignature");

-- CreateIndex
CREATE INDEX "ProcessedEvent_eventSignature_idx" ON "ProcessedEvent"("eventSignature");
