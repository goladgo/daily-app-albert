import { sql } from '@vercel/postgres';

let initialized = false;

export async function ensureInit() {
  if (initialized) return;

  await sql`CREATE TABLE IF NOT EXISTS schedule_items (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    notes TEXT,
    category TEXT NOT NULL DEFAULT 'personal',
    is_reminder BOOLEAN NOT NULL DEFAULT false,
    start_time TIMESTAMPTZ,
    all_day BOOLEAN NOT NULL DEFAULT false,
    completed BOOLEAN NOT NULL DEFAULT false,
    notified BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;

  await sql`ALTER TABLE schedule_items ADD COLUMN IF NOT EXISTS notified BOOLEAN NOT NULL DEFAULT false`;
  await sql`ALTER TABLE schedule_items ADD COLUMN IF NOT EXISTS source_message_id TEXT`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS schedule_items_source_message_id_key ON schedule_items (source_message_id)`;

  await sql`CREATE TABLE IF NOT EXISTS grocery_items (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    checked BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS braindump_items (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS push_subscriptions (
    id SERIAL PRIMARY KEY,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS oauth_accounts (
    provider TEXT PRIMARY KEY,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at TIMESTAMPTZ,
    account_email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS notified_calendar_events (
    event_id TEXT PRIMARY KEY,
    notified_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS email_summaries (
    id SERIAL PRIMARY KEY,
    message_id TEXT UNIQUE,
    subject TEXT,
    sender TEXT,
    summary TEXT NOT NULL,
    received_at TIMESTAMPTZ,
    dismissed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS outlook_calendar_events (
    event_id TEXT PRIMARY KEY,
    subject TEXT NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    all_day BOOLEAN NOT NULL DEFAULT false,
    location TEXT,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS flagged_emails (
    id SERIAL PRIMARY KEY,
    message_id TEXT UNIQUE,
    subject TEXT,
    sender TEXT,
    summary TEXT NOT NULL,
    received_at TIMESTAMPTZ,
    dismissed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;

  initialized = true;
}

export async function rolloverOverdueItems() {
  await ensureInit();
  await sql`
    UPDATE schedule_items
    SET start_time = CASE
      WHEN all_day THEN date_trunc('day', now())
      ELSE date_trunc('day', now()) + (start_time - date_trunc('day', start_time))
    END
    WHERE completed = false
      AND start_time IS NOT NULL
      AND start_time < date_trunc('day', now())
  `;
}

export { sql };
