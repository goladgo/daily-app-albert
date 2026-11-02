import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { ensureWorkTasks, WORK_TASK_LABELS } from '@/lib/workTasks';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// GET because the scheduled task reaches the app through the Vercel
// connector (web_fetch_vercel_url), which can only make GET requests.
// One task per call, fields as URL-encoded query params:
//   secret, tid (thread id), mid (message id), label, title, summary,
//   sender, project, due, link, received
// Dedupes by thread: a re-sent message is ignored; a NEW message on an
// existing thread updates the task and reopens it.
const clip = (v, n) => (v == null ? null : String(v).trim().slice(0, n) || null);

export async function GET(req) {
  const p = new URL(req.url).searchParams;
  if (!process.env.INGEST_SECRET || p.get('secret') !== process.env.INGEST_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const threadId = clip(p.get('tid') || p.get('mid'), 500);
  const title = clip(p.get('title'), 200);
  if (!threadId || !title) {
    return NextResponse.json({ error: 'tid and title are required' }, { status: 400 });
  }

  const rawLabel = clip(p.get('label'), 40) || 'Other';
  const label = WORK_TASK_LABELS.find((l) => l.toLowerCase() === rawLabel.toLowerCase()) || 'Other';
  const received = p.get('received');
  const receivedAt = received && !Number.isNaN(new Date(received).getTime())
    ? new Date(received).toISOString() : null;

  await ensureWorkTasks();
  const { rows } = await sql`
    INSERT INTO work_tasks (thread_id, message_id, label, title, summary, sender, project, due, link, received_at)
    VALUES (${threadId}, ${clip(p.get('mid'), 500)}, ${label}, ${title}, ${clip(p.get('summary'), 1500)},
            ${clip(p.get('sender'), 200)}, ${clip(p.get('project'), 200)}, ${clip(p.get('due'), 100)},
            ${clip(p.get('link'), 2000)}, ${receivedAt})
    ON CONFLICT (thread_id) DO UPDATE SET
      message_id = EXCLUDED.message_id,
      label = EXCLUDED.label,
      title = EXCLUDED.title,
      summary = EXCLUDED.summary,
      sender = EXCLUDED.sender,
      project = COALESCE(EXCLUDED.project, work_tasks.project),
      due = COALESCE(EXCLUDED.due, work_tasks.due),
      link = EXCLUDED.link,
      received_at = EXCLUDED.received_at,
      done = false,
      dismissed = false,
      updated_at = now()
    WHERE work_tasks.message_id IS DISTINCT FROM EXCLUDED.message_id
    RETURNING id, label, title
  `;

  return NextResponse.json(rows[0] ? { ok: true, ...rows[0] } : { ok: true, skipped: true });
}
