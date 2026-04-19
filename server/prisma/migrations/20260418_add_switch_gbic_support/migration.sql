-- Add switch/SFP/GBIC support to FTTH Planner
--
-- 1. pops.switches JSON column — stores array of SwitchData objects inline
--    (same pattern as olts/dios). The app layer enforces shape.
-- 2. catalog_gbics — per-company GBIC catalog
-- 3. template_gbics — global, seed-loaded GBIC defaults

ALTER TABLE "pops"
    ADD COLUMN IF NOT EXISTS "switches" JSONB DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS "catalog_gbics" (
    "id"               TEXT PRIMARY KEY,
    "name"             TEXT NOT NULL,
    "brand"            TEXT,
    "model"            TEXT,
    "tipo"             TEXT NOT NULL,
    "modo_fibra"       TEXT NOT NULL,
    "transmissao"      TEXT NOT NULL,
    "rate_gbps"        DOUBLE PRECISION,
    "wave_tx_nm"       INTEGER,
    "wave_rx_nm"       INTEGER,
    "reach_km"         DOUBLE PRECISION,
    "potencia_tx"      DOUBLE PRECISION NOT NULL,
    "sensibilidade_rx" DOUBLE PRECISION NOT NULL,
    "description"      TEXT,
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "company_id"       TEXT
);

CREATE INDEX IF NOT EXISTS "catalog_gbics_company_id_idx"
    ON "catalog_gbics" ("company_id");

ALTER TABLE "catalog_gbics"
    ADD CONSTRAINT "catalog_gbics_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "template_gbics" (
    "id"               TEXT PRIMARY KEY,
    "name"             TEXT NOT NULL,
    "brand"            TEXT,
    "model"            TEXT,
    "tipo"             TEXT NOT NULL,
    "modo_fibra"       TEXT NOT NULL,
    "transmissao"      TEXT NOT NULL,
    "rate_gbps"        DOUBLE PRECISION,
    "wave_tx_nm"       INTEGER,
    "wave_rx_nm"       INTEGER,
    "reach_km"         DOUBLE PRECISION,
    "potencia_tx"      DOUBLE PRECISION NOT NULL,
    "sensibilidade_rx" DOUBLE PRECISION NOT NULL,
    "description"      TEXT,
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
