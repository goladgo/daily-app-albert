# daily-app-albert

Personal daily management app — Next.js on Vercel, Vercel Postgres, Google + Outlook calendar integration, work-tab email triage (Flagged / Inbox / auto-created tasks) fed by a Claude scheduled task.

## Environment variables (set in Vercel project settings)

- `APP_PASSWORD`, `SESSION_SECRET` — app login
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — Google Calendar OAuth
- `OUTLOOK_CLIENT_ID`, `OUTLOOK_CLIENT_SECRET` — Outlook Calendar OAuth
- `INGEST_SECRET` — shared secret for `/api/*/ingest` endpoints (posted to by the scheduled task)
- `CRON_SECRET` — for `/api/cron/check-reminders`
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` — web push notifications
- Postgres connection vars — provided automatically by the linked Vercel Postgres store

## Deploys

Connected to this GitHub repo — pushes to `main` deploy automatically via Vercel.

_Connected to Vercel for automatic deployments as of 2026-08-26 — verifying auto-deploy._
