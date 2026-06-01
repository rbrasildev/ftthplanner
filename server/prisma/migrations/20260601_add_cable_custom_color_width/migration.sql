-- Override por instância: quando preenchidos, vencem sobre o catálogo no render
-- do mapa. Quando null, o cabo segue o catálogo (deployedSpec/plannedSpec).
ALTER TABLE "cables" ADD COLUMN "custom_color" TEXT;
ALTER TABLE "cables" ADD COLUMN "custom_width" DOUBLE PRECISION;
