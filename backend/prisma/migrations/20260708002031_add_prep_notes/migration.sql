-- CreateTable
CREATE TABLE "PrepNote" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrepNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrepNote_job_id_idx" ON "PrepNote"("job_id");

-- AddForeignKey
ALTER TABLE "PrepNote" ADD CONSTRAINT "PrepNote_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
