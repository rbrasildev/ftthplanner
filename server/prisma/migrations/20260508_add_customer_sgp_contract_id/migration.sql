-- Stores the SGP contract ID associated with the customer when imported via SGP.
-- Used both for UI display and to enable verificaacesso fallback in incremental
-- syncs without re-fetching the full SGP customer payload.
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "sgp_contract_id" TEXT;
