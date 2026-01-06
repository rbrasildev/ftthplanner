-- CreateTable
CREATE TABLE "catalog_cables" (
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

    CONSTRAINT "catalog_cables_pkey" PRIMARY KEY ("id")
);
