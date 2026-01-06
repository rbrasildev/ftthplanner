-- CreateTable
CREATE TABLE "catalog_boxes" (
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

    CONSTRAINT "catalog_boxes_pkey" PRIMARY KEY ("id")
);
