-- CreateEnum
CREATE TYPE "Tier" AS ENUM ('FREE', 'HOGAR', 'EXPERTO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "HouseholdType" AS ENUM ('HOME', 'ENTERPRISE', 'WAREHOUSE');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');

-- CreateEnum
CREATE TYPE "TempType" AS ENUM ('COLD', 'AMBIENT', 'FROZEN', 'WARM');

-- CreateEnum
CREATE TYPE "ItemStatus" AS ENUM ('OK', 'EXPIRING_SOON', 'EXPIRED', 'CONSUMED', 'DISCARDED');

-- CreateEnum
CREATE TYPE "TagType" AS ENUM ('NTAG213', 'NTAG215', 'NTAG216', 'NTAG424DNA', 'SLIX', 'SLIX2', 'DUAL_CARRIER');

-- CreateEnum
CREATE TYPE "TagStatus" AS ENUM ('UNREGISTERED', 'PENDING_WRITE', 'ACTIVE', 'REASSIGNING', 'LOCKED');

-- CreateEnum
CREATE TYPE "DestinatarioTipo" AS ENUM ('CONSUMER', 'ENTERPRISE', 'WAREHOUSE');

-- CreateEnum
CREATE TYPE "ExpedicionEstado" AS ENUM ('EXPEDIDA', 'EN_TRANSITO', 'ENTREGADA', 'INCIDENCIA');

-- CreateEnum
CREATE TYPE "Action" AS ENUM ('ITEM_ADDED', 'ITEM_CONSUMED', 'ITEM_DISCARDED', 'ITEM_MOVED', 'ITEM_EXPIRED', 'TAG_WRITTEN', 'TAG_SCANNED', 'TAG_REASSIGNED', 'ALBARAN_OPENED', 'ALBARAN_CONFIRMED', 'INCIDENCIA_REPORTED', 'EXPEDICION_CREATED', 'EXPEDICION_TRANSIT', 'EXPEDICION_DELIVERED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "name" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'es-ES',
    "subscriptionTier" "Tier" NOT NULL DEFAULT 'FREE',
    "subscriptionExpiresAt" TIMESTAMP(3),
    "stripeCustomerId" TEXT,
    "pushToken" TEXT,
    "allergens" TEXT[],
    "accessibilityMode" TEXT NOT NULL DEFAULT 'VOICE',
    "textSize" TEXT NOT NULL DEFAULT 'NORMAL',
    "highContrast" BOOLEAN NOT NULL DEFAULT false,
    "reduceMotion" BOOLEAN NOT NULL DEFAULT false,
    "voiceSpeed" TEXT NOT NULL DEFAULT 'NORMAL',
    "assistantName" TEXT NOT NULL DEFAULT 'Stoqly',
    "humorEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "households" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "type" "HouseholdType" NOT NULL DEFAULT 'HOME',
    "erpWebhook" TEXT,
    "supermarket" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "households_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "household_members" (
    "householdId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "household_members_pkey" PRIMARY KEY ("householdId","userId")
);

-- CreateTable
CREATE TABLE "pantry_zones" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "temperatureType" "TempType" NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pantry_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "zoneId" TEXT,
    "addedBy" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "barcode" TEXT,
    "epc" TEXT,
    "categoryId" TEXT,
    "expiryDate" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "paoMonths" INTEGER,
    "quantity" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT 'u',
    "status" "ItemStatus" NOT NULL DEFAULT 'OK',
    "price" DECIMAL(65,30),
    "allergens" TEXT[],
    "notes" TEXT,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "epc" TEXT,
    "itemId" TEXT,
    "householdId" TEXT,
    "expedicionId" TEXT,
    "tagType" "TagType" NOT NULL,
    "status" "TagStatus" NOT NULL DEFAULT 'UNREGISTERED',
    "registeredAt" TIMESTAMP(3),
    "lastScannedAt" TIMESTAMP(3),
    "scanCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expediciones" (
    "id" TEXT NOT NULL,
    "epc" TEXT NOT NULL,
    "remitenteId" TEXT NOT NULL,
    "destinatarioTipo" "DestinatarioTipo" NOT NULL,
    "destinatarioRef" TEXT,
    "estado" "ExpedicionEstado" NOT NULL DEFAULT 'EXPEDIDA',
    "productoNombre" TEXT NOT NULL,
    "productoRef" TEXT,
    "lote" TEXT,
    "numeroPedido" TEXT,
    "centroCosto" TEXT,
    "departamento" TEXT,
    "fechaExpedicion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaEntrega" TIMESTAMP(3),
    "latEntrega" DOUBLE PRECISION,
    "lngEntrega" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expediciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movements" (
    "id" TEXT NOT NULL,
    "itemId" TEXT,
    "expedicionId" TEXT,
    "tagId" TEXT,
    "fromZoneId" TEXT,
    "toZoneId" TEXT,
    "action" "Action" NOT NULL,
    "performedBy" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shopping_items" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT 'u',
    "supermarket" TEXT,
    "addedBy" TEXT NOT NULL,
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shopping_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "items_householdId_idx" ON "items"("householdId");

-- CreateIndex
CREATE INDEX "items_expiryDate_idx" ON "items"("expiryDate");

-- CreateIndex
CREATE INDEX "items_zoneId_idx" ON "items"("zoneId");

-- CreateIndex
CREATE INDEX "items_barcode_idx" ON "items"("barcode");

-- CreateIndex
CREATE INDEX "items_epc_idx" ON "items"("epc");

-- CreateIndex
CREATE UNIQUE INDEX "tags_epc_key" ON "tags"("epc");

-- CreateIndex
CREATE UNIQUE INDEX "expediciones_epc_key" ON "expediciones"("epc");

-- CreateIndex
CREATE INDEX "expediciones_remitenteId_idx" ON "expediciones"("remitenteId");

-- CreateIndex
CREATE INDEX "expediciones_estado_idx" ON "expediciones"("estado");

-- CreateIndex
CREATE INDEX "movements_itemId_createdAt_idx" ON "movements"("itemId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "movements_expedicionId_createdAt_idx" ON "movements"("expedicionId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "shopping_items_householdId_idx" ON "shopping_items"("householdId");

-- AddForeignKey
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pantry_zones" ADD CONSTRAINT "pantry_zones_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "pantry_zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_expedicionId_fkey" FOREIGN KEY ("expedicionId") REFERENCES "expediciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movements" ADD CONSTRAINT "movements_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movements" ADD CONSTRAINT "movements_expedicionId_fkey" FOREIGN KEY ("expedicionId") REFERENCES "expediciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movements" ADD CONSTRAINT "movements_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE SET NULL ON UPDATE CASCADE;
