import { NextResponse } from 'next/server';
import { sql, ensureInit } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET(req) {
  await ensureInit();
  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  let rows;
  if (from && to) {
    ({ rows } = await sql`
      SELECT * FROM local_events
      WHERE dismissed = false
      AND start_time >= ${from}::timestamptz AND start_time < ${to}::timestamptz
      ORDER BY start_time ASC
    `);
  } else {
    ({ rows } = await sql`
      SELECT * FROM local_events
      WHERE dismissed = false
      ORDER BY start_time ASC
    `);
  }

  return NextResponse.json(rows);
}

// Manual add from the Home tab. source='manual' so the research ingest
// (which only replaces source='research' rows) never wipes these.
export async function POST(req) {
  await ensureInit();
  const body = await req.json().catch(() => ({}));
  const { title, start, allDay, venue, category } = body;

  if (!title || !String(title).trim() || !start) {
    return NextResponse.json({ error: 'title and start are required' }, { status: 400 });
  }
  const cat = ['music', 'sports', 'outdoors', 'general'].includes(category) ? category : 'general';

  const { rows } = await sql`
    INSERT INTO local_events (title, venue, category, start_time, all_day, source)
    VALUES (${String(title).trim()}, ${venue || null}, ${cat}, ${start}::timestamptz, ${!!allDay}, 'manual')
    RETURNING *
  `;
  return NextResponse.json(rows[0]);
}
