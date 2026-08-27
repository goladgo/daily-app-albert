import { NextResponse } from 'next/server';
import { sql, ensureInit } from '@/lib/db';

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
