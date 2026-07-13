-- AlterTable
ALTER TABLE "DocumentVersion" ADD COLUMN     "fileName" TEXT,
ADD COLUMN     "fileSize" INTEGER,
ADD COLUMN     "mimeType" TEXT;
