-- Add optical splitters support to POPs.
-- Stored as JSONB array (same pattern as `switches`); the application layer
-- enforces the shape (interface Splitter in types.ts).

ALTER TABLE "pops"
    ADD COLUMN IF NOT EXISTS "splitters" JSONB DEFAULT '[]'::jsonb;
