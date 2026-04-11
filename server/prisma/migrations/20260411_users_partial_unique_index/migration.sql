-- Replace the total unique indexes on `users.username` and `users.email`
-- with PARTIAL unique indexes that only enforce uniqueness for NON-deleted
-- rows (deleted_at IS NULL).
--
-- Why: soft-deleted users were holding their username/email at the DB level,
-- blocking new signups from reusing them. The app check in adminController
-- filters by deleted_at, so it thought the name was free, and then the
-- insert blew up on the total unique constraint.
--
-- Prisma is kept unaware of this change — the schema still declares
-- `@unique` for type safety and for findUnique/upsert to compile. We
-- just replace the physical index behind the scenes. `prisma migrate
-- deploy` does NOT detect drift, so production deploys stay clean.
--
-- Safety notes:
--   * The indexes are small (users table), so the standard (non-CONCURRENTLY)
--     CREATE/DROP finishes in milliseconds. Brief exclusive lock is fine.
--   * The indexes use the SAME NAMES as the originals, so nothing that
--     references them by name breaks.
--   * Idempotent: IF EXISTS on DROP, IF NOT EXISTS on CREATE — safe to
--     re-run without side effects.

DROP INDEX IF EXISTS "users_username_key";
DROP INDEX IF EXISTS "users_email_key";

CREATE UNIQUE INDEX IF NOT EXISTS "users_username_key"
    ON "users" ("username")
    WHERE "deleted_at" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key"
    ON "users" ("email")
    WHERE "deleted_at" IS NULL;
