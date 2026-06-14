-- Página de Ajuda da área do cliente: FAQs + Artigos editáveis pelo admin.

ALTER TABLE "saas_configs" ADD COLUMN "support_whatsapp" TEXT;

CREATE TABLE "help_faqs" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "help_faqs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "help_faqs_category_order_idx" ON "help_faqs"("category", "order");

CREATE TABLE "help_articles" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "help_articles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "help_articles_slug_key" ON "help_articles"("slug");
CREATE INDEX "help_articles_category_order_idx" ON "help_articles"("category", "order");
