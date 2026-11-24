# ULTRA — Monorepo

ULTRA is a verified property marketplace for Abuja, Nigeria. ULTRA WEB (Next.js) and ULTRA APP (Expo / React Native) share a TypeScript tRPC API and a Prisma/PostgreSQL data model.

**Repository status:** substantial application source is present, but this archive has not yet completed a dependency install, automated test run, production build or database migration verification. Treat runtime and deployment readiness as unverified until Sprint 0 checks pass.

## Product scope

See [`docs/PRODUCT_SCOPE.md`](docs/PRODUCT_SCOPE.md) for the current approved scope. In particular:

- Home services are grouped into Smart Home Installations, Luxury, Electrical & Plumbing, Cleaning & Move-In, and Fumigation & Pest Control. The existing service enum is legacy and must be migrated deliberately before these departments are exposed.
- Home services remain launch-gated by default.
- Mortgage is Coming Soon and excluded from MVP production features. Do not ship simulated lenders, invented partnerships or pre-approval claims.
- `ultra-monorepo` is the production source of truth; QuickBuild is a reference only.

## Workspace

- `apps/web` — Next.js web application.
- `apps/mobile` — Expo / React Native application.
- `packages/api` — shared tRPC routers, authentication and integrations.
- `packages/db` — Prisma schema, database utilities and seed data.

## Requirements

- Node.js 20 or newer (Node 22 is supported by the declared engine range).
- pnpm 9.7.0 (pinned in the root `package.json`).
- Docker Desktop for the local PostgreSQL and Redis services and migration verification.

## Local setup

```bash
corepack enable
corepack prepare pnpm@9.7.0 --activate
pnpm install
cp .env.example .env
# Set DATABASE_URL and the other required local values in .env.
# First-time only: generate and verify the initial Prisma migration baseline.
# Review packages/db/prisma/migrations/ and commit it after this passes.
pnpm verify:migration

# Start the regular development services and apply committed migrations.
docker compose up -d postgres redis
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

Run the web and mobile clients in separate terminals:

```bash
pnpm dev:web
pnpm dev:mobile
```

## Quality checks

```bash
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:integration
pnpm --filter @ultra/web build
```

Integration tests require the dedicated test database and Redis settings described in `.github/workflows/ci.yml`. Never point integration tests at a production or personal development database.

## Database migrations

The Prisma schema is the data-model source of truth. The initial migration baseline must be generated against a disposable, clean PostgreSQL database, reviewed and committed. Do not hand-write or fabricate the initial migration. Follow [`docs/MIGRATION_GUIDE.md`](docs/MIGRATION_GUIDE.md) and run `pnpm verify:migration` only after Docker and dependencies are available.

## QuickBuild relationship

QuickBuild is a product/UX reference, not a second application to merge. Implement missing experiences natively in this monorepo, reusing its auth, API, database, permissions and trust workflows.
