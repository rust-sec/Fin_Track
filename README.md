# Family Finance Tracker

A family finance tracking MVP for spending, income, budgets, assets, liabilities, and net-worth visibility.

## Included

- Log expenses and one-off income
- View and filter monthly transactions
- Configure stable recurring monthly income once
- Set category budgets by month
- Dashboard for income, spending, balance, and budget progress
- Track assets, liabilities, and dated valuations
- Net-worth totals, asset allocation, and historical trend
- Local browser persistence
- API foundation for PostgreSQL-backed multi-user hosting

## Run locally

Frontend only:

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite.

Backend only:

```bash
cd server
cp .env.example .env
npm install
npm run prisma:generate
npm run dev
```

Full Oracle-style stack with Docker Compose:

```bash
cp .env.example .env
docker compose up --build
```

The web app is served by Nginx. `/api/*` is reverse-proxied to the Fastify backend, and PostgreSQL data is stored in a Docker volume.

## Data model

The application separates:

- `transactions`: expenses and irregular income
- `incomeSources`: predictable monthly income with active date ranges
- `budgets`: category limits for a specific month
- `positions`: assets and liabilities containing immutable dated valuation snapshots

The backend schema adds:

- `users`
- `families`
- `family_memberships`
- `categories`
- `position_valuations`

Persistence is currently isolated in `src/storage.ts` for the browser MVP. The next implementation step is replacing that module with API calls to the new Fastify backend.

## Oracle Cloud Free Tier target

The deployment target is a single Oracle Cloud Free Tier VM:

```text
Nginx container
  ├─ serves React static files
  └─ proxies /api to Fastify

Fastify API container
  └─ Prisma ORM

PostgreSQL container
  └─ persistent Docker volume
```

This keeps the runtime small and avoids premature distributed services. AI analysis can later be added as backend modules that call external AI APIs.
