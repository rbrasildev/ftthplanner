-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "address" TEXT,
ADD COLUMN     "business_email" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "cnpj" TEXT,
ADD COLUMN     "logo_url" TEXT,
ADD COLUMN     "state" TEXT,
ADD COLUMN     "website" TEXT,
ADD COLUMN     "zip_code" TEXT;

-- CreateTable
CREATE TABLE "saas_configs" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "app_name" TEXT NOT NULL DEFAULT 'FTTH Planner',
    "app_logo_url" TEXT,
    "favicon_url" TEXT,
    "support_email" TEXT,
    "support_phone" TEXT,
    "website_url" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "app_description" TEXT,
    "app_keywords" TEXT,
    "copyright_text" TEXT,
    "cta_bg_image_url" TEXT,
    "footer_desc" TEXT,
    "hero_preview_url" TEXT,
    "og_image_url" TEXT,
    "social_facebook" TEXT,
    "social_instagram" TEXT,
    "social_linkedin" TEXT,
    "social_twitter" TEXT,
    "social_youtube" TEXT,

    CONSTRAINT "saas_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "document" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "cto_id" TEXT,
    "splitter_id" TEXT,
    "splitter_port_index" INTEGER,
    "fiber_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "company_id" TEXT,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customers_company_id_idx" ON "customers"("company_id");

-- CreateIndex
CREATE INDEX "customers_cto_id_idx" ON "customers"("cto_id");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_cto_id_fkey" FOREIGN KEY ("cto_id") REFERENCES "ctos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
