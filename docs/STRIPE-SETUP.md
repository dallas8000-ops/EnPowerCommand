# Stripe + Railway setup (Deployment-Stripe-center)

Use **[Deployment-Stripe-center](https://stripe-installer-production.up.railway.app/login)** — the automated Stripe + deploy hub. Do not configure Stripe or Railway env vars by hand unless you are debugging.

Project slug in the automation app: **`enpowercommand`**

## Quick start

1. Open **Deployment-Stripe-center** → log in
   - **Production:** https://stripe-installer-production.up.railway.app/login
   - **Custom domain:** https://stripe-installer.gilliomfrontlinedigital.com/login
2. **No account yet?** Use **Create one** at `/register` (same host as login)
3. Open project **EnPowerCommand** (`enpowercommand`)
3. **Settings** → confirm local path: `C:\Software Projects\EnPowerCommand`
4. **Vault** → store `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `RAILWAY_API_TOKEN`
5. Confirm **`stripe.config.json`** and **`deploy.config.json`** in this repo (edited in the UI or on disk)
6. **Run full setup** (Stripe provision → writes `.stripe-installer/stripe-manifest.json`)
7. **Deploy** → Railway env push + `railway up` (writes `.stripe-installer/deploy-manifest.json`)

## CLI (same backend)

```powershell
cd "C:\Software Projects\Deployment-Stripe-center\backend"
python manage.py stripe_installer run enpowercommand
python manage.py stripe_installer deploy enpowercommand --push
```

## What the automation writes here

| File | Purpose |
|------|---------|
| `stripe.config.json` | Tiers, app URL, webhook URL (source of truth for provision) |
| `deploy.config.json` | Railway platform, production URL, Postgres provider |
| `.stripe-installer/stripe-manifest.json` | Stripe product/price IDs + webhook id |
| `.stripe-installer/deploy-manifest.json` | Last deploy timestamp + readiness score |
| `deploy/*.md` | Deploy, DNS, Postgres guides |

## How this app consumes manifests

- **`server/src/stripeConfig.ts`** reads `stripe.config.json` and `.stripe-installer/*.json`
- **`STRIPE_PRICE_ID`** is optional when `stripe-manifest.json` is present (defaults to **Pro**)
- Webhook route: `POST /api/billing/webhook`
- Health: `GET /api/health`

## Fallback (manual env preview only)

```powershell
npm run sync:railway-env
```

Prints Railway variables from existing manifests — use only if the automation UI is unavailable.

## Local development

Docker Postgres only — not the Railway production `DATABASE_URL`:

```powershell
npm run db:up
npm run db:init
```

`server/.env`: `DATABASE_URL=postgresql://enpower:enpower@localhost:5433/enpower`, `DB_SSL=false`, `SKIP_AUTH=true`

## Can't log in to Deployment-Stripe-center?

The production app is up (`/health/` returns OK). Login failures are usually one of these:

| Symptom | Fix |
|---------|-----|
| "No active account" / invalid credentials | **Register first** at `/register`, then sign in with that email + password |
| Password field shows dots before you type | Click **Clear** on the login form (browser autofill often uses the wrong password) |
| Prompt for 6-digit code | **MFA is on** — use your authenticator app, or a recovery code |
| "Can't reach the API" (local only) | From `Deployment-Stripe-center` repo run `npm run dev`, then open http://localhost:5173/login |

**Local dev** (if you run the automation app on your machine):

```powershell
cd "C:\Software Projects\Deployment-Stripe-center"
npm run setup
npm run dev
```

Then register at http://localhost:5173/register — local accounts are separate from production.
