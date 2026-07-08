-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active',
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "DocumentVersion" ADD COLUMN     "label" TEXT;
