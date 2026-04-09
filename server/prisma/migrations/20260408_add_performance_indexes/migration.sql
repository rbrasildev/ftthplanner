-- Performance indexes migration
-- Adds missing indexes identified from query pattern analysis

-- ============================================
-- USERS: soft-delete filter + password reset
-- ============================================
CREATE INDEX IF NOT EXISTS "users_deleted_at_idx" ON "users"("deleted_at");
CREATE INDEX IF NOT EXISTS "users_reset_token_idx" ON "users"("reset_token");

-- ============================================
-- COMPANIES: status filter (ACTIVE, SUSPENDED, etc)
-- ============================================
CREATE INDEX IF NOT EXISTS "companies_status_idx" ON "companies"("status");

-- ============================================
-- INVOICES: status filter (PENDING, PAID, OVERDUE)
-- ============================================
CREATE INDEX IF NOT EXISTS "invoices_status_idx" ON "invoices"("status");

-- ============================================
-- PROJECTS: soft-delete + compound company filter
-- ============================================
CREATE INDEX IF NOT EXISTS "projects_company_id_deleted_at_idx" ON "projects"("company_id", "deleted_at");
CREATE INDEX IF NOT EXISTS "projects_deleted_at_idx" ON "projects"("deleted_at");

-- ============================================
-- CTOS: projectId filter, groupBy(projectId,status), soft-delete
-- ============================================
CREATE INDEX IF NOT EXISTS "ctos_project_id_idx" ON "ctos"("project_id");
CREATE INDEX IF NOT EXISTS "ctos_project_id_status_idx" ON "ctos"("project_id", "status");
CREATE INDEX IF NOT EXISTS "ctos_deleted_at_idx" ON "ctos"("deleted_at");

-- ============================================
-- POPS: projectId filter, soft-delete
-- ============================================
CREATE INDEX IF NOT EXISTS "pops_project_id_idx" ON "pops"("project_id");
CREATE INDEX IF NOT EXISTS "pops_deleted_at_idx" ON "pops"("deleted_at");

-- ============================================
-- CABLES: projectId filter, soft-delete
-- ============================================
CREATE INDEX IF NOT EXISTS "cables_project_id_idx" ON "cables"("project_id");
CREATE INDEX IF NOT EXISTS "cables_deleted_at_idx" ON "cables"("deleted_at");

-- ============================================
-- CUSTOMERS: projectId, geo queries, soft-delete
-- ============================================
CREATE INDEX IF NOT EXISTS "customers_project_id_idx" ON "customers"("project_id");
CREATE INDEX IF NOT EXISTS "customers_lat_lng_idx" ON "customers"("lat", "lng");
CREATE INDEX IF NOT EXISTS "customers_deleted_at_idx" ON "customers"("deleted_at");

-- ============================================
-- RETENTION ALERTS: unresolved alerts by type
-- ============================================
CREATE INDEX IF NOT EXISTS "retention_alerts_type_resolved_at_idx" ON "retention_alerts"("type", "resolved_at");

-- ============================================
-- SUPPORT: conversation lookup, message lookup
-- ============================================
CREATE INDEX IF NOT EXISTS "support_conversations_user_id_idx" ON "support_conversations"("user_id");
CREATE INDEX IF NOT EXISTS "support_conversations_status_idx" ON "support_conversations"("status");
CREATE INDEX IF NOT EXISTS "support_messages_conversation_id_idx" ON "support_messages"("conversation_id");
CREATE INDEX IF NOT EXISTS "support_messages_sender_id_idx" ON "support_messages"("sender_id");
