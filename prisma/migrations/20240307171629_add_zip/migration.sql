/*
  Warnings:

  - Added the required column `zip` to the `Farm` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Farm" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "zip" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Farm_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Farm" ("createdAt", "description", "id", "name", "slug", "updatedAt", "userId") SELECT "createdAt", "description", "id", "name", "slug", "updatedAt", "userId" FROM "Farm";
DROP TABLE "Farm";
ALTER TABLE "new_Farm" RENAME TO "Farm";
CREATE UNIQUE INDEX "Farm_slug_key" ON "Farm"("slug");
CREATE UNIQUE INDEX "Farm_userId_key" ON "Farm"("userId");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
