-- Persist polygonos (áreas delimitadas no mapa: cobertura, anotações, zonas).
--
-- Polygons são entidades visuais simples sem relações com outras entidades da
-- rede, então ficam num único campo JSON na própria linha do projeto. Schema
-- do array segue PolygonData[] em types.ts.
-- Default '[]' garante que linhas existentes leiam como "sem áreas" sem backfill.

ALTER TABLE "projects"
    ADD COLUMN IF NOT EXISTS "polygons" JSONB DEFAULT '[]'::jsonb;
