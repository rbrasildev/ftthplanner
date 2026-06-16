-- Cancelamento "no fim do período": cliente cancelou mas pagou o ciclo atual.
-- Acesso continua ACTIVE até subscription_expires_at; cron suspende depois.
ALTER TABLE "companies" ADD COLUMN "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false;
