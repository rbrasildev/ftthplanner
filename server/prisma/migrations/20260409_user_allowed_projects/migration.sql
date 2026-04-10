-- AlterTable: Add per-user allowed projects restriction.
-- NULL = no restriction (user sees all company projects, default behavior).
-- JSON array of project IDs = user can only see those projects.
ALTER TABLE "users" ADD COLUMN "allowed_project_ids" JSONB;
