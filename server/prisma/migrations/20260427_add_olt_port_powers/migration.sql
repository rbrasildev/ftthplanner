-- Per-port output power overrides for OLT catalog entries.
-- Stored as JSONB keyed by `${slot}-${port}` (1-indexed) → dBm.
-- Empty/null means "use the OLT's global outputPower".

ALTER TABLE "catalog_olts"
    ADD COLUMN IF NOT EXISTS "port_powers" JSONB;

ALTER TABLE "template_olts"
    ADD COLUMN IF NOT EXISTS "port_powers" JSONB;
