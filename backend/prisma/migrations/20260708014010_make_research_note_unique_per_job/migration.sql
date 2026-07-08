/*
  Warnings:

  - A unique constraint covering the columns `[job_id]` on the table `ResearchNote` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "ResearchNote_job_id_idx";

-- CreateIndex
CREATE UNIQUE INDEX "ResearchNote_job_id_key" ON "ResearchNote"("job_id");
