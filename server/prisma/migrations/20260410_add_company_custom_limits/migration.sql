-- Add `custom_limits` column to companies — per-company override of plan limits.
--
-- When set, individual keys (e.g. maxProjects, maxCTOs, maxUsers, maxPOPs)
-- override the corresponding key from `plans.limits` for THIS company only.
-- Keys not present fall through to the plan's default. NULL means no overrides
-- at all (current behavior).
--
-- Fully additive and safe to run in production:
--   1. Adds the column as NULLABLE jsonb — no NOT NULL, no default. Old code
--      that doesn't read it keeps working unchanged.
--   2. Idempotent (`IF NOT EXISTS`) — re-running the migration is a no-op.
--   3. No row rewrites; no locks beyond the brief metadata-only ALTER TABLE.

ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "custom_limits" JSONB;
