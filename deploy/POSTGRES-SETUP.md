# Railway PostgreSQL Setup

1. In your Railway project → **New** → **Database** → **PostgreSQL**
2. Open the Postgres service → **Variables** → copy `DATABASE_URL` (or use **Connect** → reference it from the API service)
3. On the **API service**, add a variable reference: `DATABASE_URL` → `${{Postgres.DATABASE_URL}}`
4. Railway sets `RAILWAY_ENVIRONMENT` automatically — the app enables SSL for Postgres in production
5. Apply schema once (API service shell):

   ```bash
   npm run db:init
   ```

6. Confirm health: `GET /api/health` should return `"db": true`

## Local development

Do not use the Railway `DATABASE_URL` on your laptop — it is slow and may drop connections. Use local Docker instead:

```bash
docker compose up -d
npm run db:init --prefix server
```

With `DATABASE_URL=postgresql://enpower:enpower@localhost:5433/enpower` and `DB_SSL=false` in `server/.env`.
