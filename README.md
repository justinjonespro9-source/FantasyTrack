# FantasyTrack MVP

Free-to-play parimutuel Win/Place/Show market built with Next.js App Router, TypeScript, Tailwind, NextAuth credentials auth, and Prisma/PostgreSQL.

## Features

- Signup/login with profile fields (`displayName`, `realName`, `email`, `phone`)
- Append-only wallet ledger (`GRANT`, `BET`, `PAYOUT`)
- Contest betting with `WIN`, `PLACE`, `SHOW`, and `WPS` (creates 3 separate bets)
- Full betting validation and per-contest caps
- Live odds endpoint (`GET /api/contest/[id]/odds`) with 10-second polling
- Admin tools for:
  - series creation/activation,
  - contest creation, lane management, publish/lock,
  - settlement with final ranks + optional fantasy points,
  - coin grants,
  - Commish Notes
- Leaderboard ranked by `net`, with series eligibility badge rules

## Setup

1. Copy `.env.example` to `.env` and set values.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Generate Prisma client and run migration:
   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   ```
4. Seed sample data:
   ```bash
   npm run prisma:seed
   ```
5. Start app:
   ```bash
   npm run dev
   ```

## Demo credentials

- Admin: `admin@fantasytrack.local` / `admin123`
- User: `alice@fantasytrack.local` / `alice123`
