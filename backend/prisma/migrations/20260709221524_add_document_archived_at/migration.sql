-- AlterTable
ALTER TABLE "Document" ADD COLUMN "archived_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Document_user_id_archived_at_idx" ON "Document"("user_id", "archived_at");
