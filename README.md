# Family Finance Tracker

A browser-based MVP for tracking family spending, recurring income, and monthly budgets.

## Included

- Log expenses and one-off income
- View and filter monthly transactions
- Configure stable recurring monthly income once
- Set category budgets by month
- Dashboard for income, spending, balance, and budget progress
- Track assets, liabilities, and dated valuations
- Net-worth totals, asset allocation, and historical trend
- Local browser persistence

## Run locally

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite.

## Data model

The application separates:

- `transactions`: expenses and irregular income
- `incomeSources`: predictable monthly income with active date ranges
- `budgets`: category limits for a specific month
- `positions`: assets and liabilities containing immutable dated valuation snapshots

Persistence is isolated in `src/storage.ts`. Replace that module with API calls when authentication, family accounts, and cloud sync are introduced.
