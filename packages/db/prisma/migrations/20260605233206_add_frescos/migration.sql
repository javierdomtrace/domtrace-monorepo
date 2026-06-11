-- AlterTable
ALTER TABLE "items" ADD COLUMN     "conservacion" TEXT,
ADD COLUMN     "fechaCompra" TIMESTAMP(3),
ADD COLUMN     "tipoFresco" TEXT,
ADD COLUMN     "vidaUtilDias" INTEGER;
