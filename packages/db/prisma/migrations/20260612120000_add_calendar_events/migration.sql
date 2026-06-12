-- CreateTable
CREATE TABLE "calendar_events" (
    "id"          TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "title"       TEXT NOT NULL,
    "description" TEXT,
    "startAt"     TIMESTAMP(3) NOT NULL,
    "endAt"       TIMESTAMP(3),
    "allDay"      BOOLEAN NOT NULL DEFAULT false,
    "reminder"    BOOLEAN NOT NULL DEFAULT true,
    "createdBy"   TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "calendar_events_householdId_idx" ON "calendar_events"("householdId");

-- CreateIndex
CREATE INDEX "calendar_events_startAt_idx" ON "calendar_events"("startAt");

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_householdId_fkey"
    FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;
