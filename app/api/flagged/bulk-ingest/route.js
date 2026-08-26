import { NextResponse } from 'next/server';
import { sql, ensureInit } from '@/lib/db';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get('secret');
  const data = searchParams.get('data');

  if (!process.env.INGEST_SECRET || secret !== process.env.INGEST_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  if (!data) {
    return NextResponse.json({ error: 'data query param required (base64 JSON array)' }, { status: 400 });
  }

  let items;
  try {
    const decoded = Buffer.from(data, 'base64').toString('utf-8');
    items = JSON.parse(decoded);
  } catch (err) {
    return NextResponse.json({ error: 'invalid base64/JSON in data param' }, { status: 400 });
  }

  if (!Array.isArray(items)) {
    return NextResponse.json({ error: 'data must decode to a JSON array' }, { status: 400 });
  }

  await ensureInit();

  let inserted = 0;
  let skipped = 0;
  for (const item of items) {
    const { messageId, subject, sender, summary, receivedAt } = item || {};
    if (!summary || !summary.trim()) {
      skipped += 1;
      continue;
    }
    const { rows } = await sql`
      INSERT INTO flagged_emails (message_id, subject, sender, summary, received_at)
      VALUES (${messageId || null}, ${subject || null}, ${sender || null}, ${summary.trim()}, ${receivedAt || null})
      ON CONFLICT (message_id) DO NOTHING
      RETURNING id
    `;
    if (rows[0]) inserted += 1;
    else skipped += 1;
  }

  return NextResponse.json({ ok: true, inserted, skipped, total: items.length });
}
