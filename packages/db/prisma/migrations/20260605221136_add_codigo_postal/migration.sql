/*
  Warnings:

  - You are about to drop the column `ciudad` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `provincia` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "users" DROP COLUMN "ciudad",
DROP COLUMN "provincia",
ADD COLUMN     "codigoPostal" TEXT;
