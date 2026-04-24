-- Add inline DIO support to CTOs
--
-- Stores an array of `DIOInline { id, name, ports }` objects placed inside the
-- CTO editor. Mirrors the existing `splitters`/`fusions` JSON columns. Defaults
-- to `[]` so legacy CTOs read as empty without a backfill.

ALTER TABLE "ctos"
    ADD COLUMN IF NOT EXISTS "dios" JSONB DEFAULT '[]'::jsonb;
