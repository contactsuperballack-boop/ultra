#!/usr/bin/env bash
# Sprint 0 — migration baseline verification.
#
# Runs the exact sequence docs/MIGRATION_GUIDE.md describes in prose, as one
# command: bring up a disposable Postgres, generate/apply the migration
# baseline against it (empty-DB test), seed it (seeded-DB test), confirm
# `migrate status` reports no drift, then tear the container down.
#
# Deliberately uses `compose down -v --remove-orphans` at the end even on success —
# this script's entire point is to prove the migration works from a clean
# slate, so leaving state behind between runs would let a later run pass
# for the wrong reason (against an already-migrated DB, not a fresh one).
#
# Requires Docker and pnpm with dependencies already installed
# (`pnpm install` at the repo root) — this script does not install
# anything, it only verifies.

set -euo pipefail
cd "$(dirname "$0")/.."

# Use an isolated Compose project, volume and host port. This prevents the
# disposable verification run from touching the developer's normal Postgres
# container or deleting its persistent volume during cleanup.
COMPOSE_PROJECT_NAME="ultra-migration-verify"
POSTGRES_PORT="55432"
DB_URL="postgresql://ultra:ultra_dev_password@localhost:${POSTGRES_PORT}/ultra_dev"

compose() {
  POSTGRES_PORT="$POSTGRES_PORT" docker compose -p "$COMPOSE_PROJECT_NAME" "$@"
}

cleanup() {
  compose down -v --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "→ Starting disposable Postgres…"
compose up -d postgres

echo "→ Waiting for Postgres to accept connections…"
for i in $(seq 1 30); do
  if compose exec -T postgres pg_isready -U ultra > /dev/null 2>&1; then
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "✗ Postgres never became ready after 30s — aborting." >&2
    exit 1
  fi
  sleep 1
done
echo "  Postgres is ready."

echo "→ [Empty-DB test] Generating/applying the migration baseline…"
DATABASE_URL="$DB_URL" pnpm --filter @ultra/db exec prisma migrate dev --name init --skip-generate

echo "→ Confirming no drift between schema and migration history…"
DATABASE_URL="$DB_URL" pnpm --filter @ultra/db exec prisma migrate status

echo "→ [Seeded-DB test] Running the seed script…"
DATABASE_URL="$DB_URL" pnpm db:seed

echo "→ Sanity-checking seeded data is queryable…"
DATABASE_URL="$DB_URL" pnpm --filter @ultra/db exec prisma db execute --stdin <<'SQL'
SELECT
  (SELECT count(*) FROM "Listing") AS listings,
  (SELECT count(*) FROM "ProviderProfile") AS providers,
  (SELECT count(*) FROM "Offering") AS offerings;
SQL

echo "→ Disposable migration database will be removed by the cleanup trap…"

echo ""
echo "✓ Sprint 0 migration verification passed: empty-DB apply, seeded-DB apply, no drift."
echo "  Commit packages/db/prisma/migrations/ if this is the first real run — that directory is the actual deliverable."
