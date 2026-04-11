-- Allow customers to be attached to a connector (fusion point with category='connector')
-- inside a CTO instead of (or in addition to) a splitter port.
--
-- Customer can be connected via one of two mutually-exclusive mechanisms:
--   1. Splitter port   — splitter_id + splitter_port_index (existing, unchanged)
--   2. Connector       — connector_id references a FusionPoint stored in cto.fusions[]
--                        with category='connector'. One customer per connector.
--
-- The FusionPoint data lives in the CTO's JSON blob, so no FK can be added; the
-- app layer enforces the relationship.

ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "connector_id" TEXT;

-- Prevent two active customers from claiming the same connector in the same CTO.
CREATE UNIQUE INDEX IF NOT EXISTS "customers_cto_connector_unique"
    ON "customers" ("cto_id", "connector_id")
    WHERE "deleted_at" IS NULL AND "connector_id" IS NOT NULL;
