-- AlterTable
ALTER TABLE "catalog_splitters" ADD COLUMN "allow_custom_connections" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "catalog_splitters" ADD COLUMN "connector_type" TEXT DEFAULT 'Unconnectorized';
