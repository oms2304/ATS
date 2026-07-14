-- Keep the first document with a title and give any legacy duplicates a
-- deterministic suffix before enforcing case-insensitive uniqueness.
WITH ranked_documents AS (
  SELECT
    "id",
    "title",
    ROW_NUMBER() OVER (
      PARTITION BY "user_id", LOWER(BTRIM("title"))
      ORDER BY "createdAt", "id"
    ) AS duplicate_number
  FROM "Document"
)
UPDATE "Document" AS document
SET "title" = LEFT(
  document."title",
  GREATEST(0, 120 - LENGTH(' (Copy ' || ranked_documents."id" || ')'))
) || ' (Copy ' || ranked_documents."id" || ')'
FROM ranked_documents
WHERE document."id" = ranked_documents."id"
  AND ranked_documents.duplicate_number > 1;

CREATE UNIQUE INDEX "Document_user_id_normalized_title_key"
ON "Document" ("user_id", LOWER(BTRIM("title")));
