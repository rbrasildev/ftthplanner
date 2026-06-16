-- Marca CTOs que já receberam o auto-conect inicial (pass-through), pra
-- evitar que limpar conexões + reabrir dispare auto-conect de novo.
ALTER TABLE "ctos" ADD COLUMN "auto_splice_done" BOOLEAN NOT NULL DEFAULT false;
