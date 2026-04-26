-- Add optional cable subtype (DROP | DISTRIBUTION | FEEDER).
--
-- Nullable on purpose: legacy cables stay NULL and the UI infers their type
-- from `fiber_count` via getEffectiveCableType(). Once a user saves a cable
-- with an explicit type, it overrides the inference.

ALTER TABLE "cables"
    ADD COLUMN IF NOT EXISTS "type" TEXT;
