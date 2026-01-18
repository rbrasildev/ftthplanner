-- Script de Fix para Sincronização de Banco de Dados
-- Este script adiciona as colunas que estão presentes no schema.prisma mas ausentes no banco de dados.

-- 1. Tabelas CTOs e POPs (Relacionamento com Postes)
ALTER TABLE "ctos" ADD COLUMN IF NOT EXISTS "pole_id" TEXT;
ALTER TABLE "ctos" ADD COLUMN IF NOT EXISTS "client_count" INTEGER DEFAULT 0;
ALTER TABLE "pops" ADD COLUMN IF NOT EXISTS "pole_id" TEXT;

-- 2. Tabela Postes (Detalhes Técnicos e Cabos Vinculados)
ALTER TABLE "poles" ADD COLUMN IF NOT EXISTS "type" TEXT;
ALTER TABLE "poles" ADD COLUMN IF NOT EXISTS "height" DOUBLE PRECISION;
ALTER TABLE "poles" ADD COLUMN IF NOT EXISTS "linked_cable_ids" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- 3. Chaves Estrangeiras (Para garantir integridade referencial no Prisma)
-- Nota: Usamos DO block para evitar erro caso a constraint já exista
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ctos_pole_id_fkey') THEN
        ALTER TABLE "ctos" ADD CONSTRAINT "ctos_pole_id_fkey" FOREIGN KEY ("pole_id") REFERENCES "poles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pops_pole_id_fkey') THEN
        ALTER TABLE "pops" ADD CONSTRAINT "pops_pole_id_fkey" FOREIGN KEY ("pole_id") REFERENCES "poles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
