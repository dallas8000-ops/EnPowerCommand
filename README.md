# EnPower Command

Freelance **command center**: save **leads**, paste **job postings** to create leads (optional AI parsing), store a **resume profile** locally in the browser, and generate **outreach drafts** you edit before sending.

**Stack:** React (Vite) · Express (TypeScript) · PostgreSQL · optional OpenAI for parsing + outreach.

## Features

- **Leads** — company, role, URL, notes, stage, **last contact** date.
- **Profile** — resume / highlights: **stored on the server** when auth is enabled (with a one-time migration from browser storage on first save); still mirrored locally for offline-style fallback in the client.
- **Login** — single admin password + JWT when `AUTH_SECRET` and `ADMIN_PASSWORD` are set (see below). Use `SKIP_AUTH=true` in local `.env` to skip login during development.
- **Activity log** — per-lead timeline (notes, contacted, applied, interview, follow-up). Types like **applied** / **contacted** update **last contact** automatically; use this plus **CSV export** as a job-search paper trail.
- **Export** — **Leads** and **activity** CSV from the Leads page (`/api/export/leads.csv`, `/api/export/activities.csv`).
- **Import job posting** — paste listing text → creates a lead (`POST /api/leads/from-posting`). With `OPENAI_API_KEY`, fields are extracted; without it, the full paste is stored in notes for you to tidy.
- **Generate outreach** — drafts + subject lines; sends profile context when set; **copy-all** on the lead editor for drafts.

## Quick start

1. **Postgres:** `docker compose up -d` (default port **5433** on host).
2. **Server env:** copy `server/env.example` → `server/.env`, set `DATABASE_URL`. For local dev you can set **`SKIP_AUTH=true`** so the UI does not require login. For a password-protected app, set **`AUTH_SECRET`** (long random string, 16+ chars) and **`ADMIN_PASSWORD`** (8+ chars) and omit `SKIP_AUTH`. Then run `npm run db:init --prefix server` (re-run after pulling schema changes so `user_profile`, `lead_activities`, and `last_contact_at` exist).
3. **Install:** `npm run install:all` from repo root (or `npm install` in root, `client`, and `server`).
4. **Dev:** `npm run dev` — UI proxied to API; open **http://localhost:5173**.

Optional: `OPENAI_API_KEY` in `server/.env`. Client proxy override: `client/.env` with `VITE_API_PROXY_TARGET` if the API is not on port 3002.

## Scripts

| Command | Purpose |
|--------|---------|
| `npm run dev` | Vite + API together |
| `npm run dev:client` / `npm run dev:server` | Run one side only |
| `npm run db:up` | Start Docker Postgres |
| `npm run db:init` | Apply SQL schema (`server`) |

## Deploy on Render

Repo includes [`render.yaml`](render.yaml): **PostgreSQL**, **Node API** (`server/`), and **static site** (`client/`).

1. **New Blueprint** in Render → connect [EnPowerCommand](https://github.com/dallas8000-ops/EnPowerCommand) → apply the blueprint.
2. After the **API** service is live, copy its URL (e.g. `https://enpower-command-api.onrender.com`).
3. On the **static** service → **Environment** → set **`VITE_API_URL`** to that URL (no trailing slash) → **Manual Deploy** so the client rebuilds with the correct API origin.
4. On the **API** service → set **`CORS_ORIGIN`** to your static site URL (exact origin, e.g. `https://enpower-command-web.onrender.com`).
5. In the Render dashboard, set **`AUTH_SECRET`** and **`ADMIN_PASSWORD`** on the API (the blueprint declares them as secret sync fields — set values in the UI). Do **not** set `SKIP_AUTH` in production unless you intentionally want an open API.
6. **Shell** on the API service once (after Postgres is linked):

   ```bash
   npm run db:init
   ```

**Optional:** `OPENAI_API_KEY` on the API for smarter job-post parsing and outreach.

Local Docker Postgres is only for development; production uses Render’s database from `DATABASE_URL`.

## GitHub Actions

Push to `main` / `master` runs client + server `npm ci` and `npm run build` (see [`.github/workflows/ci.yml`](.github/workflows/ci.yml)).

## License

MIT
