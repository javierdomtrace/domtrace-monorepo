-- DropForeignKey
ALTER TABLE "calendar_events" DROP CONSTRAINT "calendar_events_householdId_fkey";

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
