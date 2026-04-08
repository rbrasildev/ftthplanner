-- CreateEnum
CREATE TYPE "pole_situation" AS ENUM ('EXISTING', 'NEW', 'SHARED', 'REPLACE');

-- CreateEnum
CREATE TYPE "pole_road_side" AS ENUM ('LEFT', 'RIGHT');

-- CreateEnum
CREATE TYPE "pole_approval_status" AS ENUM ('APPROVED', 'PENDING', 'IRREGULAR');

-- AlterTable: Add documentation fields to poles
ALTER TABLE "poles" ADD COLUMN "utility_code" TEXT;
ALTER TABLE "poles" ADD COLUMN "shape" TEXT;
ALTER TABLE "poles" ADD COLUMN "strength" DOUBLE PRECISION;
ALTER TABLE "poles" ADD COLUMN "situation" "pole_situation";
ALTER TABLE "poles" ADD COLUMN "road_side" "pole_road_side";
ALTER TABLE "poles" ADD COLUMN "address_reference" TEXT;
ALTER TABLE "poles" ADD COLUMN "observations" TEXT;
ALTER TABLE "poles" ADD COLUMN "approval_status" "pole_approval_status" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "poles" ADD COLUMN "has_photo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "poles" ADD COLUMN "last_inspection_date" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "poles_approval_status_idx" ON "poles"("approval_status");

-- CreateTable: pole_equipments
CREATE TABLE "pole_equipments" (
    "id" TEXT NOT NULL,
    "pole_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pole_equipments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "pole_equipments_pole_id_idx" ON "pole_equipments"("pole_id");
ALTER TABLE "pole_equipments" ADD CONSTRAINT "pole_equipments_pole_id_fkey" FOREIGN KEY ("pole_id") REFERENCES "poles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: pole_spans
CREATE TABLE "pole_spans" (
    "id" TEXT NOT NULL,
    "origin_pole_id" TEXT NOT NULL,
    "destination_pole_id" TEXT NOT NULL,
    "distance_meters" DOUBLE PRECISION,
    "cable_type" TEXT,
    "fiber_count" INTEGER,
    "sag" DOUBLE PRECISION,
    "min_height" DOUBLE PRECISION,
    "sharing" TEXT,
    "observations" TEXT,
    "project_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pole_spans_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "pole_spans_origin_pole_id_idx" ON "pole_spans"("origin_pole_id");
CREATE INDEX "pole_spans_destination_pole_id_idx" ON "pole_spans"("destination_pole_id");
CREATE INDEX "pole_spans_project_id_idx" ON "pole_spans"("project_id");
ALTER TABLE "pole_spans" ADD CONSTRAINT "pole_spans_origin_pole_id_fkey" FOREIGN KEY ("origin_pole_id") REFERENCES "poles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pole_spans" ADD CONSTRAINT "pole_spans_destination_pole_id_fkey" FOREIGN KEY ("destination_pole_id") REFERENCES "poles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: pole_photos
CREATE TABLE "pole_photos" (
    "id" TEXT NOT NULL,
    "pole_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pole_photos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "pole_photos_pole_id_idx" ON "pole_photos"("pole_id");
ALTER TABLE "pole_photos" ADD CONSTRAINT "pole_photos_pole_id_fkey" FOREIGN KEY ("pole_id") REFERENCES "poles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: pole_checklists
CREATE TABLE "pole_checklists" (
    "id" TEXT NOT NULL,
    "pole_id" TEXT NOT NULL,
    "has_identification" BOOLEAN NOT NULL DEFAULT false,
    "has_photo" BOOLEAN NOT NULL DEFAULT false,
    "distance_verified" BOOLEAN NOT NULL DEFAULT false,
    "has_height" BOOLEAN NOT NULL DEFAULT false,
    "cable_linked" BOOLEAN NOT NULL DEFAULT false,
    "cto_or_box_linked" BOOLEAN NOT NULL DEFAULT false,
    "no_electrical_conflict" BOOLEAN NOT NULL DEFAULT false,
    "ready_to_submit" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pole_checklists_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pole_checklists_pole_id_key" ON "pole_checklists"("pole_id");
CREATE INDEX "pole_checklists_pole_id_idx" ON "pole_checklists"("pole_id");
ALTER TABLE "pole_checklists" ADD CONSTRAINT "pole_checklists_pole_id_fkey" FOREIGN KEY ("pole_id") REFERENCES "poles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
