# Supabase

Linked project: `xzzoznhmezmaarcvavpr` (JobPilot AI, eu-west-1).

## Migrations

Source of truth:

- `migrations/20260807120935_enums_helpers_and_core_schema.sql`
- `migrations/20260807120936_row_level_security.sql`

```bash
npm run db:push
# or
supabase db push --db-url "<session pooler connection string>"
```

## Types

```bash
npm run db:types
```

Writes `src/types/database.ts`.

## Seed

`seed.dev.sql` is commented example data only — requires an auth user (Phase 3).

See [docs/DATABASE.md](../docs/DATABASE.md).
