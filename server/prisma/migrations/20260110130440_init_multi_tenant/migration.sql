-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "equipment_status" ADD VALUE 'ANALYSING';
ALTER TYPE "equipment_status" ADD VALUE 'LICENSED';

-- AlterTable
ALTER TABLE "cables" ADD COLUMN     "catalog_id" TEXT;

-- AlterTable
ALTER TABLE "catalog_boxes" ADD COLUMN     "company_id" TEXT;

-- AlterTable
ALTER TABLE "catalog_cables" ADD COLUMN     "company_id" TEXT;

-- AlterTable
ALTER TABLE "catalog_splitters" ADD COLUMN     "company_id" TEXT;

-- AlterTable
ALTER TABLE "ctos" ADD COLUMN     "catalog_id" TEXT,
ADD COLUMN     "color" TEXT,
ADD COLUMN     "reserve_loop_length" DOUBLE PRECISION,
ADD COLUMN     "type" TEXT DEFAULT 'CTO';

-- CreateTable
CREATE TABLE "template_splitters" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "inputs" INTEGER NOT NULL DEFAULT 1,
    "outputs" INTEGER NOT NULL,
    "attenuation" JSONB DEFAULT '{}',
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "template_splitters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_cables" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "defaultLevel" TEXT,
    "fiberCount" INTEGER NOT NULL,
    "looseTubeCount" INTEGER NOT NULL,
    "fibersPerTube" INTEGER NOT NULL,
    "attenuation" DOUBLE PRECISION,
    "fiberProfile" TEXT,
    "description" TEXT,
    "deployedSpec" JSONB DEFAULT '{"color": "#10b981", "width": 3}',
    "plannedSpec" JSONB DEFAULT '{"color": "#86efac", "width": 3}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "template_cables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_boxes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "type" TEXT NOT NULL,
    "reserveLoopLength" DOUBLE PRECISION,
    "color" TEXT DEFAULT '#64748b',
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "template_boxes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_poles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "strength" DOUBLE PRECISION NOT NULL,
    "shape" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "company_id" TEXT,

    CONSTRAINT "catalog_poles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_poles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "strength" DOUBLE PRECISION NOT NULL,
    "shape" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "template_poles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poles" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "equipment_status" NOT NULL DEFAULT 'PLANNED',
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "catalog_id" TEXT,
    "company_id" TEXT,

    CONSTRAINT "poles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_fusions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "attenuation" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "company_id" TEXT,

    CONSTRAINT "catalog_fusions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_fusions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "attenuation" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "template_fusions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_olts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "output_power" DOUBLE PRECISION NOT NULL DEFAULT 3.0,
    "slots" INTEGER NOT NULL DEFAULT 1,
    "ports_per_slot" INTEGER NOT NULL DEFAULT 16,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "company_id" TEXT,

    CONSTRAINT "catalog_olts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_olts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "output_power" DOUBLE PRECISION NOT NULL DEFAULT 3.0,
    "slots" INTEGER NOT NULL DEFAULT 1,
    "ports_per_slot" INTEGER NOT NULL DEFAULT 16,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "template_olts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "catalog_poles_company_id_idx" ON "catalog_poles"("company_id");

-- CreateIndex
CREATE INDEX "poles_company_id_idx" ON "poles"("company_id");

-- CreateIndex
CREATE INDEX "poles_lat_lng_idx" ON "poles"("lat", "lng");

-- CreateIndex
CREATE INDEX "catalog_fusions_company_id_idx" ON "catalog_fusions"("company_id");

-- CreateIndex
CREATE INDEX "catalog_olts_company_id_idx" ON "catalog_olts"("company_id");

-- CreateIndex
CREATE INDEX "catalog_boxes_company_id_idx" ON "catalog_boxes"("company_id");

-- CreateIndex
CREATE INDEX "catalog_cables_company_id_idx" ON "catalog_cables"("company_id");

-- CreateIndex
CREATE INDEX "catalog_splitters_company_id_idx" ON "catalog_splitters"("company_id");

-- AddForeignKey
ALTER TABLE "catalog_splitters" ADD CONSTRAINT "catalog_splitters_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_cables" ADD CONSTRAINT "catalog_cables_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_boxes" ADD CONSTRAINT "catalog_boxes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_poles" ADD CONSTRAINT "catalog_poles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poles" ADD CONSTRAINT "poles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poles" ADD CONSTRAINT "poles_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poles" ADD CONSTRAINT "poles_catalog_id_fkey" FOREIGN KEY ("catalog_id") REFERENCES "catalog_poles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_fusions" ADD CONSTRAINT "catalog_fusions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_olts" ADD CONSTRAINT "catalog_olts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
