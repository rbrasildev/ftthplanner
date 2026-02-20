-- CreateTable
CREATE TABLE "drops" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "cto_id" TEXT NOT NULL,
    "coordinates" JSONB NOT NULL,
    "length" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drops_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "drops_customer_id_key" ON "drops"("customer_id");

-- CreateIndex
CREATE INDEX "drops_cto_id_idx" ON "drops"("cto_id");

-- AddForeignKey
ALTER TABLE "drops" ADD CONSTRAINT "drops_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drops" ADD CONSTRAINT "drops_cto_id_fkey" FOREIGN KEY ("cto_id") REFERENCES "ctos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
