/*
  Warnings:

  - Added the required column `signature` to the `BlocklistRelease` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "BlocklistRelease" ADD COLUMN     "minClientVersion" TEXT NOT NULL DEFAULT '1.0.0',
ADD COLUMN     "signature" TEXT NOT NULL;
