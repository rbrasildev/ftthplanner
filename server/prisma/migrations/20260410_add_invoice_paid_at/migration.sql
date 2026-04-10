-- Add `paid_at` column to invoices to track the actual payment timestamp.
--
-- Until now, the only way to know "when was this invoice paid" was the
-- generic `updated_at` column, which is fragile (any later edit moves it).
-- This migration is fully additive and safe to run in production:
--
--   1. Adds the column as NULLABLE — no NOT NULL constraint, no default.
--      Old code that doesn't set it keeps working unchanged.
--   2. Backfills `paid_at = updated_at` for rows that are already PAID.
--      For these legacy rows, `updated_at` is our best historical estimate.
--   3. Idempotent (`IF NOT EXISTS` / nothing-to-do on the UPDATE) — re-running
--      the migration is a no-op and will not corrupt or duplicate data.
--
-- No locks beyond the brief ALTER TABLE; no rewrites of existing rows for
-- the column add itself (PostgreSQL stores NULL columns as a bitmap).

ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "paid_at" TIMESTAMP(3);

-- One-time backfill: for already-paid invoices that don't yet have paid_at,
-- copy the updated_at value as a best-effort historical timestamp.
UPDATE "invoices"
   SET "paid_at" = "updated_at"
 WHERE "status" = 'PAID'
   AND "paid_at" IS NULL;
