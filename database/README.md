# TaskBridge PostgreSQL

The database is split into eight schemas: `auth`, `tenant`, `care`, `trader`, `ops`, `integration`, `audit`, and `billing`.

Run migrations with:

```bash
npm run db:migrate
```

Development seed data is opt-in:

```bash
ALLOW_DEMO_SEED=true npm run db:seed
```

The application always applies explicit agency filters. PostgreSQL row-level policies provide an additional tenant boundary when the application role and agency settings are applied to a transaction.
