-- CreateTable
CREATE TABLE "OperatingDayBreak" (
    "id" TEXT NOT NULL,
    "operatingDayId" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "label" TEXT,

    CONSTRAINT "OperatingDayBreak_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OperatingDayBreak_operatingDayId_idx" ON "OperatingDayBreak"("operatingDayId");

-- AddForeignKey
ALTER TABLE "OperatingDayBreak" ADD CONSTRAINT "OperatingDayBreak_operatingDayId_fkey" FOREIGN KEY ("operatingDayId") REFERENCES "OperatingDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
