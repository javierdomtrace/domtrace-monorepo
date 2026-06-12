-- AlterTable
ALTER TABLE "items" ADD COLUMN     "babyId" TEXT,
ADD COLUMN     "dosisDesc" TEXT,
ADD COLUMN     "frecuenciaToma" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "deporte" TEXT,
ADD COLUMN     "deporteDiasSemana" INTEGER,
ADD COLUMN     "deporteNivel" TEXT,
ADD COLUMN     "resetToken" TEXT,
ADD COLUMN     "resetTokenExpiry" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "babies" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "gender" TEXT,
    "photoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "babies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "baby_feedings" (
    "id" TEXT NOT NULL,
    "babyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amountMl" DOUBLE PRECISION,
    "amountG" DOUBLE PRECISION,
    "durationMin" INTEGER,
    "notes" TEXT,
    "feedingAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "baby_feedings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "baby_measurements" (
    "id" TEXT NOT NULL,
    "babyId" TEXT NOT NULL,
    "weight" DOUBLE PRECISION,
    "height" DOUBLE PRECISION,
    "headCirc" DOUBLE PRECISION,
    "measuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "baby_measurements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "babies_householdId_idx" ON "babies"("householdId");

-- CreateIndex
CREATE INDEX "baby_feedings_babyId_feedingAt_idx" ON "baby_feedings"("babyId", "feedingAt" DESC);

-- CreateIndex
CREATE INDEX "baby_measurements_babyId_measuredAt_idx" ON "baby_measurements"("babyId", "measuredAt" DESC);

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_babyId_fkey" FOREIGN KEY ("babyId") REFERENCES "babies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "babies" ADD CONSTRAINT "babies_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "baby_feedings" ADD CONSTRAINT "baby_feedings_babyId_fkey" FOREIGN KEY ("babyId") REFERENCES "babies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "baby_measurements" ADD CONSTRAINT "baby_measurements_babyId_fkey" FOREIGN KEY ("babyId") REFERENCES "babies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
