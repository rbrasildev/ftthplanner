-- Add Stripe customer ID to companies
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "stripe_customer_id" TEXT;

-- Add unique constraint on invoices billing period (prevents duplicate invoices for same period)
-- Only applies when both reference_start and reference_end are NOT NULL
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_company_id_reference_start_reference_end_key"
ON "invoices" ("company_id", "reference_start", "reference_end")
WHERE "reference_start" IS NOT NULL AND "reference_end" IS NOT NULL;
