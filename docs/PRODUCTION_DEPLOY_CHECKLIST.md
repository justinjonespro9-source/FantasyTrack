# FantasyTrack — Production Deploy Checklist

Use this checklist before deploying to production. No code changes required for these items; they are configuration and operational steps.

---

## 1. Environment variables

Set in your production environment (e.g. Vercel, Railway, or host `.env`):

| Variable | Required | Notes |
|----------|----------|--------|
| `DATABASE_URL` | Yes | Production Postgres connection string (Neon pooled URL is fine for runtime). |
| `DATABASE_URL_UNPOOLED` | Yes (Neon / Prisma `directUrl`) | Direct/non-pooling URL for `prisma migrate deploy`. Neon’s Vercel integration usually injects this. Locally, mirror `DATABASE_URL` when not using a pooler. |
| `NEXTAUTH_URL` | Yes | Full public URL of the app (e.g. `https://app.fantasytrack.com`). |
| `NEXTAUTH_SECRET` | Yes | Random secret for session signing; generate with `openssl rand -base64 32`. |
| `SPORTSDATAIO_API_KEY` | For CBB/NBA | Required for basketball imports and live stats. Optional if not using basketball. |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | For bootstrap | Only for one-time `npm run prisma:bootstrap-admin`; not needed at runtime. |

Do **not** commit `.env` or `.env.local` with real secrets. Use `.env.example` as a template only.

---

## 2. Database migrations

- Vercel build command for this project is `npm run build:clean`, which runs:
  - `prisma migrate deploy`
  - `prisma generate`
  - `next build` (after clearing `.next`)
- Prefer `npm run vercel-build` if changing the Vercel dashboard Build Command later.
- Never use `prisma migrate dev` or `prisma migrate reset` in production.
- Migrations use `DATABASE_URL_UNPOOLED` via Prisma `directUrl`; runtime queries use pooled `DATABASE_URL`.
- Ensure the database is backed up before major schema changes.

---

## 3. Auth

- **NEXTAUTH_URL** must match the production domain (no trailing slash). Incorrect value breaks callbacks and session cookies.
- **NEXTAUTH_SECRET** must be set and kept secret. Rotating it invalidates all existing sessions.
- Ensure at least one admin user exists (e.g. via `prisma:bootstrap-admin` with `ADMIN_EMAIL` and `ADMIN_PASSWORD`).

---

## 4. Forgot-password email delivery

- The forgot-password API creates a reset token and returns a generic “check your inbox” message. Today it does **not** send email; production should add an email provider.
- **Before going live:** Integrate an email service (e.g. SendGrid, Resend, AWS SES) and send the reset link to the user’s email. The route builds `resetLink` in `app/api/auth/forgot-password/route.ts`; use that in the email body.
- Until email is implemented, users can only reset password if you provide the link through another channel (e.g. support).

---

## 5. SportsDataIO (basketball)

- **SPORTSDATAIO_API_KEY**: Set in production if you use CBB/NBA imports or live stats. Without it, those API calls will fail with a clear error.
- Confirm the key has access to the leagues you use (e.g. NBA, NCAAB).
- Bulk live-stats and import endpoints are called by your backend/cron; ensure the deploy environment can reach SportsDataIO and that the key is not exposed to the client.

---

## 6. Optional / recommended

- **Support email**: `lib/support.ts` uses `SUPPORT_EMAIL = "support@fantasytrack.test"`. For production, change to a real address or make it configurable via env (e.g. `SUPPORT_EMAIL`).
- **Logging**: Dev-only `console.log` usage has been removed or gated; ensure production logging (e.g. your host’s log aggregation) is sufficient for debugging.
- **Admin**: Restrict access to `/admin` and internal APIs by role; the app already gates by `session.user.isAdmin`.

---

## Summary

1. Set **DATABASE_URL**, **NEXTAUTH_URL**, **NEXTAUTH_SECRET** (and **SPORTSDATAIO_API_KEY** if using basketball).
2. Run **Prisma migrations** on the production DB.
3. Verify **auth** (URL, secret, one admin user).
4. Plan **forgot-password email** (integrate a provider or document workaround).
5. Confirm **SportsDataIO** key and network access if using basketball features.
