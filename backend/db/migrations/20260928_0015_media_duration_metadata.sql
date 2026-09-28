-- Audio/video duration metadata for deterministic catalog/player UX.
-- Duration is optional because some storage providers cannot derive it at upload time.
-- Runtime player metadata remains authoritative when this value is absent.

ALTER TABLE content_items
ADD COLUMN IF NOT EXISTS duration_ms INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'content_items_duration_ms_positive'
       AND conrelid = 'content_items'::regclass
  ) THEN
    ALTER TABLE content_items
    ADD CONSTRAINT content_items_duration_ms_positive
    CHECK (duration_ms IS NULL OR duration_ms > 0);
  END IF;
END $$;
