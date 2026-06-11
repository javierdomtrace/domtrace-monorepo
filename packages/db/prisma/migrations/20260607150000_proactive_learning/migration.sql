-- Migración: sistema de aprendizaje proactivo
-- Fecha: 2026-06-07

-- Tabla de logs de conversaciones con Vicky
CREATE TABLE "stoqly_logs" (
    "id"          TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "userId"      TEXT NOT NULL,
    "userMessage" TEXT NOT NULL,
    "vickyReply"  TEXT,
    "toolsUsed"   TEXT[] NOT NULL DEFAULT '{}',
    "wasHandled"  BOOLEAN NOT NULL DEFAULT true,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stoqly_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "stoqly_logs_householdId_createdAt_idx" ON "stoqly_logs"("householdId", "createdAt" DESC);
CREATE INDEX "stoqly_logs_wasHandled_createdAt_idx" ON "stoqly_logs"("wasHandled", "createdAt" DESC);

-- Campos nutricionales en User
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pesoKg"              DOUBLE PRECISION;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "alturaCm"            DOUBLE PRECISION;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "edadAnos"            INTEGER;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "nivelActividad"      TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "objetivoNutricional" TEXT;

-- Datos nutricionales en Item (por 100g/ml)
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "kcalPor100"  DOUBLE PRECISION;
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "protPor100"  DOUBLE PRECISION;
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "carbPor100"  DOUBLE PRECISION;
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "grasaPor100" DOUBLE PRECISION;
