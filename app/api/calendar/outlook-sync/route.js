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
  const { from, to, events } = body || {};

  if (!from || !to || !Array.isArray(events)) {
    return NextResponse.json({ error: 'from, to, and events[] are required' }, { status: 400 });
  }

  await sql`DELETE FROM outlook_calendar_events WHERE start_time >= ${from}::timestamptz AND start_time < ${to}::timestamptz`;

  let count = 0;
  for (const ev of events) {
    if (!ev || !ev.eventId || !ev.subject || !ev.start) continue;
    await sql`
      INSERT INTO outlook_calendar_events (event_id, subject, start_time, all_day, location, synced_at)
      VALUES (${ev.eventId}, ${ev.subject}, ${ev.start}::timestamptz, ${!!ev.allDay}, ${ev.location || null}, now())
      ON CONFLICT (event_id) DO UPDATE SET
        subject = EXCLUDED.subject,
        start_time = EXCLUDED.start_time,
        all_day = EXCLUDED.all_day,
        location = EXCLUDED.location,
        synced_at = now()
    `;
    count += 1;
  }

  return NextResponse.json({ ok: true, count });
}
