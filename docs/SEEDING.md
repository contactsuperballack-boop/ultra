# ULTRA database seeding policy

The Prisma seed script inserts demo identities, sample property listings and Phase 2 provider fixtures. It is intended only for local development and explicitly isolated staging databases.

## Local development

```bash
pnpm db:seed
```

## Staging

Use the dedicated script and explicitly set `NODE_ENV=staging` for the seed process. Confirm `DATABASE_URL` points to the isolated staging database before running it.

```bash
NODE_ENV=staging pnpm db:seed:staging
```

On PowerShell:

```powershell
$env:NODE_ENV = "staging"
pnpm db:seed:staging
```

## Production

The demo seed script refuses to run when `NODE_ENV=production`, before constructing a Prisma client or opening a database connection. There is no production seed command. Production bootstrap, if ever needed, must be a separately reviewed and explicitly scoped procedure; do not disable this guard or point the demo seed at production.
