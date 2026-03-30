-- AlterTable: Add billing period reference columns to invoices
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "reference_start" TIMESTAMP(3);
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "reference_end" TIMESTAMP(3);
