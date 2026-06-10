-- Sistema de atribuição de consultor: link público ?ref=<code> → cadastro
-- atribuído ao consultor. Tracking de visitas separado pra calcular conversão.

CREATE TABLE "consultants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "code" TEXT NOT NULL,
    "commission_pct" DOUBLE PRECISION DEFAULT 10,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consultants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "consultants_code_key" ON "consultants"("code");
CREATE INDEX "consultants_code_idx" ON "consultants"("code");

CREATE TABLE "referral_visits" (
    "id" TEXT NOT NULL,
    "consultant_id" TEXT NOT NULL,
    "visited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_hash" TEXT,
    "user_agent" TEXT,
    "referer" TEXT,

    CONSTRAINT "referral_visits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "referral_visits_consultant_id_visited_at_idx" ON "referral_visits"("consultant_id", "visited_at");

ALTER TABLE "referral_visits" ADD CONSTRAINT "referral_visits_consultant_id_fkey"
    FOREIGN KEY ("consultant_id") REFERENCES "consultants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Campos em companies pra atribuição (first-touch)
ALTER TABLE "companies" ADD COLUMN "referred_by_id" TEXT;
ALTER TABLE "companies" ADD COLUMN "referred_at" TIMESTAMP(3);

CREATE INDEX "companies_referred_by_id_idx" ON "companies"("referred_by_id");

ALTER TABLE "companies" ADD CONSTRAINT "companies_referred_by_id_fkey"
    FOREIGN KEY ("referred_by_id") REFERENCES "consultants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
