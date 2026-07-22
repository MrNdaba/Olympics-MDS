-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Venue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "siteCode" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "bookingWindowOpen" BOOLEAN NOT NULL DEFAULT true,
    "defaultSlotDurationMinutes" INTEGER NOT NULL DEFAULT 30
);
INSERT INTO "new_Venue" ("city", "defaultSlotDurationMinutes", "id", "name", "siteCode", "status") SELECT "city", "defaultSlotDurationMinutes", "id", "name", "siteCode", "status" FROM "Venue";
DROP TABLE "Venue";
ALTER TABLE "new_Venue" RENAME TO "Venue";
CREATE UNIQUE INDEX "Venue_siteCode_key" ON "Venue"("siteCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
