-- AlterTable
ALTER TABLE "saas_configs"
    ADD COLUMN "billing_reminder_enabled" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "billing_reminder_days_before" INTEGER NOT NULL DEFAULT 5,
    ADD COLUMN "billing_overdue_interval_days" INTEGER NOT NULL DEFAULT 3;

-- CreateTable
CREATE TABLE "email_logs" (
    "id" TEXT NOT NULL,
    "template_slug" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "recipient_email" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "error_message" TEXT,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_logs_template_slug_target_id_sent_at_idx" ON "email_logs"("template_slug", "target_id", "sent_at");

-- CreateIndex
CREATE INDEX "email_logs_sent_at_idx" ON "email_logs"("sent_at");
