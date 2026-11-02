import { sql } from '@vercel/postgres';

let homeInitialized = false;

// Tables used by the Home tab (morning brief + hidden Outlook events).
// Kept separate from lib/db.js ensureInit so that file stays untouched.
export async function ensureHomeTables() {
  if (homeInitialized) return;
  await sql`CREATE TABLE IF NOT EXISTS daily_brief (
    id INTEGER PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS hidden_calendar_events (
    event_id TEXT PRIMARY KEY,
    hidden_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  homeInitialized = true;
}
