-- Detecção automática de rompimento de fibra. Disparado pelo cron de connection-only
-- sync (a cada 10min): quando >=3 clientes do mesmo CTO ficam offline E representam
-- >=30% do total da CTO, abre um incident ACTIVE. Quando todos voltam online, vira
-- RESOLVED. Histórico fica pra auditoria.
CREATE TABLE "outage_incidents" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "cto_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "affected_count" INTEGER NOT NULL,
    "total_count" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "outage_incidents_pkey" PRIMARY KEY ("id")
);

-- Hot path: lista de incidents ACTIVE por company (sidebar + map ring lookup)
CREATE INDEX "outage_incidents_company_id_status_idx" ON "outage_incidents"("company_id", "status");

-- Hot path: dado um CTO, tem incident ACTIVE? (detector usa pra dedupe)
CREATE INDEX "outage_incidents_cto_id_status_idx" ON "outage_incidents"("cto_id", "status");

-- Histórico ordenado por tempo
CREATE INDEX "outage_incidents_started_at_idx" ON "outage_incidents"("started_at");

-- FK pra company (com SET NULL no delete pra preservar histórico mesmo se a
-- company for soft-removida — segue padrão das outras tabelas auditáveis)
ALTER TABLE "outage_incidents"
    ADD CONSTRAINT "outage_incidents_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id")
    ON DELETE NO ACTION ON UPDATE CASCADE;
