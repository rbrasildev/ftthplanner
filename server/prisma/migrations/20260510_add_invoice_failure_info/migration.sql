-- Surface Stripe's failed-charge details on the invoice so admins can see why
-- a renewal failed (e.g., "Your card was declined") without digging into Stripe.
-- Both columns are nullable: only invoices that experienced a failed charge
-- attempt populate them; successful or pre-emitted-but-unpaid rows leave them
-- NULL. Cleared/reset on retry success is the caller's responsibility.
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "failure_message" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "failed_at" TIMESTAMP(3);
