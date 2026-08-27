import { NextResponse } from 'next/server';
import { sql, ensureInit } from '@/lib/db';

const VALID_CATEGORIES = new Set(['music', 'sports', 'outdoors', 'general']);

function isAuthorized(req) {
  const secret = req.headers.get('x-ingest-secret');
  return !!process.env.INGEST_SECRET && secret === process.env.INGEST_SECRET;
}

// Bulk-replace ingest for the Local Events section, fed weekly by a
// research automation (see the "Local Events weekly research" scheduled
// task). Mirrors /api/calendar/outlook-sync: the caller tells us the date
// window it searched, we clear out whatever we previously had for that
// window (so re-running the same week doesn't pile up duplicates), then
// insert the fresh batch.
export async function POST(req) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  await ensureInit();
  const body = await req.json();
  const { from, to, events } = body || {};

  if (!from || !to || !Array.isArray(events)) {
    return NextResponse.json({ error: 'from, to, and events[] are required' }, { status: 400 });
  }

  await sql`DELETE FROM local_events WHERE source = 'research' AND start_time >= ${from}::timestamptz AND start_time < ${to}::timestamptz`;

  let count = 0;
  let skipped = 0;
  for (const ev of events) {
    const { title, description, venue, category, start, allDay, url } = ev || {};
    if (!title || !String(title).trim() || !start) {
      skipped += 1;
      continue;
    }
    const cat = VALID_CATEGORIES.has(category) ? category : 'general';
    await sql`
      INSERT INTO local_events (title, description, venue, category, start_time, all_day, url, source)
      VALUES (${String(title).trim()}, ${description || null}, ${venue || null}, ${cat}, ${start}::timestamptz, ${!!allDay}, ${url || null}, 'research')
    `;
    count += 1;
  }

  return NextResponse.json({ ok: true, count, skipped });
}
