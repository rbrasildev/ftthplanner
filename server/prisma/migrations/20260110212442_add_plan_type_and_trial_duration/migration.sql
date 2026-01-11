-- AlterTable
ALTER TABLE "plans" ADD COLUMN     "features" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "isRecommended" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "trial_duration_days" INTEGER,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'STANDARD';
