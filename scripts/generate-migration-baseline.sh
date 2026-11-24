#!/usr/bin/env bash
# Generate the complete initial Prisma migration from the authoritative schema.
# Run only against a fresh repository checkout before any production DB exists.
set -euo pipefail
cd "$(dirname "$0")/.."
MIGRATION_DIR="packages/db/prisma/migrations/20261123000000_init"
if [ -d "$MIGRATION_DIR" ]; then
  echo "Refusing to overwrite $MIGRATION_DIR" >&2
  exit 1
fi
mkdir -p "$MIGRATION_DIR"
pnpm --filter @ultra/db exec prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > "$MIGRATION_DIR/migration.sql"
printf 'provider = "postgresql"\n' > packages/db/prisma/migration_lock.toml
echo "Generated $MIGRATION_DIR/migration.sql"
echo "Review it, then run pnpm verify:migration before committing."
