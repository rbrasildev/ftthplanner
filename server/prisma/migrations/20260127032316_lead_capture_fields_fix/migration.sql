-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "mercadopago_subscription_id" TEXT,
ADD COLUMN     "phone" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "last_login_at" TIMESTAMP(3),
ADD COLUMN     "source" TEXT;
