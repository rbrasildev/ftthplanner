-- CreateTable: user_engagement_metrics
CREATE TABLE IF NOT EXISTS "user_engagement_metrics" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "company_id" TEXT,
    "last_login_at" TIMESTAMP(3),
    "last_project_created_at" TIMESTAMP(3),
    "login7d" INTEGER NOT NULL DEFAULT 0,
    "login30d" INTEGER NOT NULL DEFAULT 0,
    "actions7d" INTEGER NOT NULL DEFAULT 0,
    "engagementScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "churn_risk_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "user_engagement_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable: user_financial_metrics
CREATE TABLE IF NOT EXISTS "user_financial_metrics" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "company_id" TEXT,
    "monthly_revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lifetime_revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estimated_ltv" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "churn_probability" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "user_financial_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable: retention_alerts
CREATE TABLE IF NOT EXISTS "retention_alerts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "company_id" TEXT,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "retention_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable: retention_automation_rules
CREATE TABLE IF NOT EXISTS "retention_automation_rules" (
    "id" TEXT NOT NULL,
    "trigger_type" TEXT NOT NULL,
    "delay_in_days" INTEGER NOT NULL DEFAULT 0,
    "message_template" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'email',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "retention_automation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable: retention_message_logs
CREATE TABLE IF NOT EXISTS "retention_message_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "rule_id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "retention_message_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: integration_mappings
CREATE TABLE IF NOT EXISTS "integration_mappings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "sgp_type" TEXT NOT NULL,
    "external_customer_id" TEXT NOT NULL,
    "internal_customer_id" TEXT,
    "cto_id" TEXT,
    "splitter_port" INTEGER,
    "fiber_id" TEXT,
    "last_sync_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable: integration_conflicts
CREATE TABLE IF NOT EXISTS "integration_conflicts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "customer_id" TEXT,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_conflicts_pkey" PRIMARY KEY ("id")
);

-- CreateTable: integration_logs
CREATE TABLE IF NOT EXISTS "integration_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: integration_settings
CREATE TABLE IF NOT EXISTS "integration_settings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "sgp_type" TEXT NOT NULL,
    "api_url" TEXT,
    "api_app" TEXT,
    "api_token" TEXT,
    "webhook_secret" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_settings_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS "user_engagement_metrics_user_id_key" ON "user_engagement_metrics"("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "user_financial_metrics_user_id_key" ON "user_financial_metrics"("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "integration_settings_userId_sgpType" ON "integration_settings"("user_id", "sgp_type");

-- Indexes: user_engagement_metrics
CREATE INDEX IF NOT EXISTS "user_engagement_metrics_company_id_idx" ON "user_engagement_metrics"("company_id");
CREATE INDEX IF NOT EXISTS "user_engagement_metrics_user_id_created_at_idx" ON "user_engagement_metrics"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "user_engagement_metrics_user_id_idx" ON "user_engagement_metrics"("user_id");
CREATE INDEX IF NOT EXISTS "user_engagement_metrics_last_login_at_idx" ON "user_engagement_metrics"("last_login_at");
CREATE INDEX IF NOT EXISTS "user_engagement_metrics_churn_risk_score_idx" ON "user_engagement_metrics"("churn_risk_score");

-- Indexes: user_financial_metrics
CREATE INDEX IF NOT EXISTS "user_financial_metrics_user_id_idx" ON "user_financial_metrics"("user_id");
CREATE INDEX IF NOT EXISTS "user_financial_metrics_company_id_idx" ON "user_financial_metrics"("company_id");

-- Indexes: retention_alerts
CREATE INDEX IF NOT EXISTS "retention_alerts_user_id_idx" ON "retention_alerts"("user_id");
CREATE INDEX IF NOT EXISTS "retention_alerts_company_id_idx" ON "retention_alerts"("company_id");

-- Indexes: retention_message_logs
CREATE INDEX IF NOT EXISTS "retention_message_logs_user_id_idx" ON "retention_message_logs"("user_id");
CREATE INDEX IF NOT EXISTS "retention_message_logs_rule_id_idx" ON "retention_message_logs"("rule_id");

-- Indexes: integration_mappings
CREATE INDEX IF NOT EXISTS "integration_mappings_user_id_external_customer_id_idx" ON "integration_mappings"("user_id", "external_customer_id");
CREATE INDEX IF NOT EXISTS "integration_mappings_internal_customer_id_idx" ON "integration_mappings"("internal_customer_id");

-- Indexes: integration_conflicts
CREATE INDEX IF NOT EXISTS "integration_conflicts_user_id_status_idx" ON "integration_conflicts"("user_id", "status");

-- Indexes: integration_logs
CREATE INDEX IF NOT EXISTS "integration_logs_user_id_created_at_idx" ON "integration_logs"("user_id", "created_at");

-- Foreign keys (idempotent using DO blocks)
DO $$ BEGIN
  ALTER TABLE "user_engagement_metrics" ADD CONSTRAINT "user_engagement_metrics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "user_engagement_metrics" ADD CONSTRAINT "user_engagement_metrics_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "user_financial_metrics" ADD CONSTRAINT "user_financial_metrics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "user_financial_metrics" ADD CONSTRAINT "user_financial_metrics_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "retention_alerts" ADD CONSTRAINT "retention_alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "retention_alerts" ADD CONSTRAINT "retention_alerts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "retention_message_logs" ADD CONSTRAINT "retention_message_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "retention_message_logs" ADD CONSTRAINT "retention_message_logs_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "retention_automation_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "integration_mappings" ADD CONSTRAINT "integration_mappings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "integration_conflicts" ADD CONSTRAINT "integration_conflicts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "integration_logs" ADD CONSTRAINT "integration_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "integration_settings" ADD CONSTRAINT "integration_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
