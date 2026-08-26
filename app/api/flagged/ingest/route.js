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

  const { rows } = await sql`
    INSERT INTO flagged_emails (message_id, subject, sender, summary, received_at)
    VALUES (${messageId || null}, ${subject || null}, ${sender || null}, ${summary.trim()}, ${receivedAt || null})
    ON CONFLICT (message_id) DO NOTHING
    RETURNING *
  `;

  return NextResponse.json(rows[0] || { skipped: true });
}
