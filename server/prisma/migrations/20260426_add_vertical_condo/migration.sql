-- Vertical condominium MVP
--
-- CTO: optional `building` JSON ({ floors, unitsPerFloor }) marks the CTO as a
-- vertical condo. NULL means a regular CTO/CEO.
--
-- Customer: `floor` and `unit` allow attaching a customer to a specific
-- apartment when the parent CTO is a vertical condo. Both nullable so existing
-- customers stay unaffected.

ALTER TABLE "ctos"
    ADD COLUMN IF NOT EXISTS "building" JSONB;

ALTER TABLE "customers"
    ADD COLUMN IF NOT EXISTS "floor" INTEGER,
    ADD COLUMN IF NOT EXISTS "unit" TEXT;
