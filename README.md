# EnPower Command

**A freelance command center:** save leads, paste job postings to create leads (optional AI parsing), store a resume profile, and generate outreach drafts you edit before sending.

| | |
|---|---|
| **Live demo** | https://enpowercommand-production.up.railway.app |
| **Code** | https://github.com/dallas8000-ops/EnPowerCommand |

**Stack:** React (Vite) · Express (TypeScript) · PostgreSQL · optional OpenAI for parsing + outreach.

> The live demo sits behind a single admin login. Demo credentials are available to reviewers on request — see Contact.

---

## Features

- **Leads** — company, role, URL, notes, stage, last contact date.
- **Profile** — resume / highlights: stored on the server when auth is enabled (with a one-time migration from browser storage on first save); still mirrored locally for offline-style fallback in the client.
- **Login** — single admin password + JWT when `AUTH_SECRET` and `ADMIN_PASSWORD` are set. Use `SKIP_AUTH=true` in local `.env` to skip login during development.
- **Activity log** — per-lead timeline (notes, contacted, applied, interview, follow-up). Types like *applied* / *contacted* update last contact automatically; use this plus CSV export as a job-search paper trail.
- **Export** — Leads and activity CSV from the Leads page (`/api/export/leads.csv`, `/api/export/activities.csv`).
- **Import job posting** — paste listing text → creates a lead (`POST /api/leads/from-posting`). With `OPENAI_API_KEY`, fields are extracted; without it, the full paste is stored in notes for you to tidy.
- **Generate outreach** — drafts + subject lines; sends profile context when set; copy-all on the lead editor.

---

## Quick start

1. **Postgres:** `docker compose up -d` (default host port 5433).
2. **Server env:** copy `server/env.example` → `server/.env`, set `DATABASE_URL`. For local dev you can set `SKIP_AUTH=true` so the UI doesn't require login. For a password-protected app, set `AUTH_SECRET` (16+ char random string) and `ADMIN_PASSWORD` (8+ chars) and omit `SKIP_AUTH`. Then run `npm run db:init --prefix server` (re-run after pulling schema changes so `user_profile`, `lead_activities`, and `last_contact_at` exist).
3. **Install:** `npm run install:all` from repo root (or `npm install` in root, client, and server).
4. **Dev:** `npm run dev` — UI proxied to API; open http://localhost:5173.
5. **Optional:** `OPENAI_API_KEY` in `server/.env`. Client proxy override: `client/.env` with `VITE_API_PROXY_TARGET` if the API is not on port 3002.

---

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Vite + API together |
| `npm run dev:client` / `npm run dev:server` | Run one side only |
| `npm run db:up` | Start Docker Postgres |
| `npm run db:init` | Apply SQL schema (server) |

---

## Deploy (Railway)

EnPower Command runs as two Railway services — a Node/Express API (`server/`) and a static client (`client/`) — with a managed PostgreSQL plugin.

1. Add the **PostgreSQL** plugin → Railway sets `DATABASE_URL` automatically.
2. On the **API** service, set environment variables:
   - `AUTH_SECRET` — long random secret (16+ chars)
   - `ADMIN_PASSWORD` — admin login password (8+ chars)
   - `CORS_ORIGIN` — your client URL (exact origin), e.g. `https://enpowercommand-production.up.railway.app`
   - Optional: `OPENAI_API_KEY` for smarter job-post parsing and outreach
   - Do **not** set `SKIP_AUTH` in production unless you intentionally want an open API.
3. On the **client** service, set `VITE_API_URL` to the API service URL (no trailing slash), then redeploy so the client rebuilds against the correct API origin.
4. Initialize the schema once the database is linked — run `npm run db:init` against the API service.

> Local Docker Postgres is for development only; production uses Railway's managed database from `DATABASE_URL`.

---

## GitHub Actions

Push to `main` / `master` runs client + server `npm ci` and `npm run build` (see `.github/workflows/ci.yml`).

---

## Contact

**Barney R. Gilliom** — dallas8000@gmail.com · [GitHub](https://github.com/dallas8000-ops) · [Portfolio](https://gilliomfrontlinedigital.com)

---

## License

MIT
