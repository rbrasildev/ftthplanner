-- Composite index to accelerate per-tenant lookups by document (CPF/CNPJ).
-- Used heavily by SGP integration syncs and conflict resolution.
CREATE INDEX IF NOT EXISTS "customers_company_id_document_idx"
    ON "customers" ("company_id", "document");
