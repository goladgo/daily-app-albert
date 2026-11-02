import { sql, ensureInit } from '@/lib/db';

export const WORK_TASK_LABELS = [
  'Quote', 'Submittals', 'Takeoff', 'Pricing/PO',
  'Call/Follow-up', 'Meeting/Scheduling', 'Info Request', 'Other',
];

let ready = false;

// Work Tasks: one row per email thread that needs action from Albert.
// Fed by the "Work Tasks scanner" scheduled task via /api/work-tasks/ingest.
export async function ensureWorkTasks() {
  await ensureInit();
  if (ready) return;
  await sql`CREATE TABLE IF NOT EXISTS work_tasks (
    id SERIAL PRIMARY KEY,
    thread_id TEXT UNIQUE NOT NULL,
    message_id TEXT,
    label TEXT NOT NULL DEFAULT 'Other',
    title TEXT NOT NULL,
    summary TEXT,
    sender TEXT,
    project TEXT,
    due TEXT,
    link TEXT,
    received_at TIMESTAMPTZ,
    done BOOLEAN NOT NULL DEFAULT false,
    dismissed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  ready = true;
}
