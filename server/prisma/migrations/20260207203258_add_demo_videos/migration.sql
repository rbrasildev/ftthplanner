-- AlterTable
ALTER TABLE "cables" ADD COLUMN     "color_standard" TEXT DEFAULT 'ABNT',
ADD COLUMN     "reserve_location" JSONB,
ADD COLUMN     "show_reserve_label" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "technical_reserve" DOUBLE PRECISION DEFAULT 0;

-- AlterTable
ALTER TABLE "catalog_olts" ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'OLT';

-- AlterTable
ALTER TABLE "template_olts" ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'OLT';

-- CreateTable
CREATE TABLE "demo_videos" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'Monitor',
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "demo_videos_pkey" PRIMARY KEY ("id")
);
