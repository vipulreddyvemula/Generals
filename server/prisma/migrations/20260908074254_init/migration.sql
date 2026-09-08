-- CreateTable
CREATE TABLE "CustomMapData" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "creator" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mapTilesData" TEXT NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "starCount" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "StarUsers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "mapId" TEXT NOT NULL,
    CONSTRAINT "StarUsers_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "CustomMapData" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "StarUsers_userId_mapId_key" ON "StarUsers"("userId", "mapId");
