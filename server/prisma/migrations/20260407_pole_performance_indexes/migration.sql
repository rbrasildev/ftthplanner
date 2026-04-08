-- Performance indexes for poles table (high volume multi-tenant)

-- Query por projeto (todas as queries de sync, load, report)
CREATE INDEX IF NOT EXISTS "poles_project_id_idx" ON "poles"("project_id");

-- Query composta empresa + projeto (multi-tenant isolation)
CREATE INDEX IF NOT EXISTS "poles_company_id_project_id_idx" ON "poles"("company_id", "project_id");

-- Filtros por situação
CREATE INDEX IF NOT EXISTS "poles_situation_idx" ON "poles"("situation");

-- Queries compostas: filtros dentro de um projeto
CREATE INDEX IF NOT EXISTS "poles_project_id_approval_status_idx" ON "poles"("project_id", "approval_status");
CREATE INDEX IF NOT EXISTS "poles_project_id_situation_idx" ON "poles"("project_id", "situation");

-- Soft delete filter (quase toda query filtra deletedAt IS NULL)
CREATE INDEX IF NOT EXISTS "poles_deleted_at_idx" ON "poles"("deleted_at");
