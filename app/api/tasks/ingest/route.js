import { NextResponse } from 'next/server';
import { sql, ensureInit } from '@/lib/db';

function isAuthorized(req) {
  const secret = req.headers.get('x-ingest-secret');
  return !!process.env.INGEST_SECRET && secret === process.env.INGEST_SECRET;
}

export async function POST(req) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  await ensureInit();
  const body = await req.json();
  const { messageId, subject, sender, summary, receivedAt } = body || {};

  if (!summary || !summary.trim()) {
    return NextResponse.json({ error: 'summary is required' }, { status: 400 });
  }

  const title = subject && subject.trim() ? subject.trim() : summary.trim().slice(0, 80);
  const notes = sender ? `From ${sender}: ${summary.trim()}` : summary.trim();

  const { rows } = await sql`
    INSERT INTO schedule_items (title, notes, category, is_reminder, start_time, all_day, source_message_id)
    VALUES (${title}, ${notes}, 'work', false, null, true, ${messageId || null})
    ON CONFLICT (source_message_id) DO NOTHING
    RETURNING *
  `;

  return NextResponse.json(rows[0] || { skipped: true });
}
