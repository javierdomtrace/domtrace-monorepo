-- AlterTable
ALTER TABLE "users" ADD COLUMN     "alergiasPersonalizadas" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "categoriasActivas" TEXT[] DEFAULT ARRAY['ALIMENTACION']::TEXT[];
