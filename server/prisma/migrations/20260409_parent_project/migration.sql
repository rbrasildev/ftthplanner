-- AlterTable: Add parent project relationship
ALTER TABLE "projects" ADD COLUMN "parent_project_id" TEXT;
ALTER TABLE "projects" ADD COLUMN "inherited_elements" JSONB DEFAULT '{"backbone": true, "poles": true, "cables": true, "ctos": true, "ceos": true, "pops": true, "customers": false}';

-- CreateIndex
CREATE INDEX "projects_parent_project_id_idx" ON "projects"("parent_project_id");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_parent_project_id_fkey" FOREIGN KEY ("parent_project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Prevent self-referencing and circular references via CHECK constraint
ALTER TABLE "projects" ADD CONSTRAINT "projects_no_self_parent" CHECK ("parent_project_id" IS NULL OR "parent_project_id" != "id");
