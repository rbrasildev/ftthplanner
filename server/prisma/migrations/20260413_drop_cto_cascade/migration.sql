-- AlterTable: Change drops.cto_id foreign key from RESTRICT to CASCADE
ALTER TABLE "drops" DROP CONSTRAINT "drops_cto_id_fkey";
ALTER TABLE "drops" ADD CONSTRAINT "drops_cto_id_fkey" FOREIGN KEY ("cto_id") REFERENCES "ctos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
