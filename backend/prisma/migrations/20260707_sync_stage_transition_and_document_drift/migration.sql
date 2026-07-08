-- This migration documents drift that was already applied directly to the database.
-- No changes are executed here; it exists to sync migration history with actual DB state.

CREATE TABLE "StageTransition" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "from_stage" TEXT,
    "to_stage" TEXT NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StageTransition_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "StageTransition" ADD CONSTRAINT "StageTransition_job_id_fkey"
    FOREIGN KEY ("job_id") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DocumentVersion" ADD COLUMN "content" TEXT;
ALTER TABLE "DocumentVersion" ALTER COLUMN "fileUrl" DROP NOT NULL;

ALTER TABLE "Job" ADD COLUMN "archived_at" TIMESTAMP(3);
ALTER TABLE "Job" ADD COLUMN "outcome_note" TEXT;

CREATE INDEX "Job_user_id_archived_at_idx" ON "Job"("user_id", "archived_at");