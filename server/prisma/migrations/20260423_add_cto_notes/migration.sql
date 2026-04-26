-- Persist sticky notes added inside the CTO editor.
--
-- Mirrors the existing JSON columns on `ctos` (splitters, fusions, dios). Notes
-- were previously frontend-only state that vanished on save/reload. Defaults
-- to `[]` so legacy rows read as "no notes" without a backfill.

ALTER TABLE "ctos"
    ADD COLUMN IF NOT EXISTS "notes" JSONB DEFAULT '[]'::jsonb;
