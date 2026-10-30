import { NextResponse } from 'next/server';
import { sql, ensureInit } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// Read-only Local Events feed for other apps (Bloom). Protected by
// EVENTS_FEED_KEY via the x-feed-key header. Ignores the `dismissed` flag
// so each app keeps its own "not interested" state.
export async function GET(req) {
  const key = req.headers.get('x-feed-key');
  if (!process.env.EVENTS_FEED_KEY || key !== process.env.EVENTS_FEED_KEY) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  await ensureInit();
  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from') || new Date().toISOString();
  const to = searchParams.get('to') || new Date(Date.now() + 7 * 86400000).toISOString();

  const { rows } = await sql`
    SELECT id, title, description, venue, category, start_time, all_day, url
    FROM local_events
    WHERE start_time >= ${from}::timestamptz AND start_time < ${to}::timestamptz
    ORDER BY start_time ASC
  `;
  return NextResponse.json(rows);
}
