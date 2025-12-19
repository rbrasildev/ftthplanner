-- CreateEnum
CREATE TYPE "equipment_status" AS ENUM ('PLANNED', 'NOT_DEPLOYED', 'DEPLOYED', 'CERTIFIED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "center_lat" DOUBLE PRECISION NOT NULL,
    "center_lng" DOUBLE PRECISION NOT NULL,
    "zoom" INTEGER NOT NULL DEFAULT 15,
    "settings" JSONB DEFAULT '{"snapDistance": 30}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ctos" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "equipment_status" NOT NULL DEFAULT 'PLANNED',
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "splitters" JSONB DEFAULT '[]',
    "fusions" JSONB DEFAULT '[]',
    "connections" JSONB DEFAULT '[]',
    "input_cable_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "layout" JSONB DEFAULT '{}',
    "client_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ctos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pops" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "equipment_status" NOT NULL DEFAULT 'PLANNED',
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "olts" JSONB DEFAULT '[]',
    "dios" JSONB DEFAULT '[]',
    "fusions" JSONB DEFAULT '[]',
    "connections" JSONB DEFAULT '[]',
    "input_cable_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "layout" JSONB DEFAULT '{}',

    CONSTRAINT "pops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cables" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT DEFAULT 'DEPLOYED',
    "fiber_count" INTEGER NOT NULL,
    "loose_tube_count" INTEGER DEFAULT 1,
    "color" TEXT DEFAULT '#0ea5e9',
    "coordinates" JSONB NOT NULL,
    "from_node_id" TEXT,
    "to_node_id" TEXT,

    CONSTRAINT "cables_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ctos" ADD CONSTRAINT "ctos_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pops" ADD CONSTRAINT "pops_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cables" ADD CONSTRAINT "cables_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
