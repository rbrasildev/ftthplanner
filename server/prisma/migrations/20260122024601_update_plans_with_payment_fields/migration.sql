/*
  Warnings:

  - You are about to drop the column `billing_mode` on the `companies` table. All the data in the column will be lost.
  - You are about to drop the column `stripe_customer_id` on the `companies` table. All the data in the column will be lost.
  - You are about to drop the column `stripe_price_id` on the `plans` table. All the data in the column will be lost.
  - You are about to drop the column `stripe_price_id_yearly` on the `plans` table. All the data in the column will be lost.
  - You are about to drop the column `stripe_product_id` on the `plans` table. All the data in the column will be lost.
  - You are about to drop the `sgp_clients` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `sgp_connections` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `subscriptions` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "sgp_clients" DROP CONSTRAINT "sgp_clients_company_id_fkey";

-- DropForeignKey
ALTER TABLE "sgp_connections" DROP CONSTRAINT "sgp_connections_company_id_fkey";

-- DropForeignKey
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_company_id_fkey";

-- AlterTable
ALTER TABLE "companies" DROP COLUMN "billing_mode",
DROP COLUMN "stripe_customer_id";

-- AlterTable
ALTER TABLE "ctos" ADD COLUMN     "pole_id" TEXT;

-- AlterTable
ALTER TABLE "plans" DROP COLUMN "stripe_price_id",
DROP COLUMN "stripe_price_id_yearly",
DROP COLUMN "stripe_product_id",
ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "mercadopago_id" TEXT,
ADD COLUMN     "stripe_id" TEXT;

-- AlterTable
ALTER TABLE "poles" ADD COLUMN     "height" DOUBLE PRECISION,
ADD COLUMN     "linked_cable_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "type" TEXT;

-- AlterTable
ALTER TABLE "pops" ADD COLUMN     "pole_id" TEXT;

-- DropTable
DROP TABLE "sgp_clients";

-- DropTable
DROP TABLE "sgp_connections";

-- DropTable
DROP TABLE "subscriptions";
