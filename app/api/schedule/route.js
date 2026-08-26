import { NextResponse } from 'next/server';
import { sql, ensureInit, rolloverOverdueItems } from '@/lib/db';

export async function GET(req) {
  await ensureInit();
  await rolloverOverdueItems();
  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  let rows;
  if (from && to) {
    ({ rows } = await sql`
      SELECT * FROM schedule_items
      WHERE completed = false
      AND (start_time IS NULL OR (start_time >= ${from}::timestamptz AND start_time < ${to}::timestamptz))
      ORDER BY all_day DESC, start_time ASC NULLS LAST
    `);
  } else {
    ({ rows } = await sql`
      SELECT * FROM schedule_items
      WHERE completed = false
      ORDER BY all_day DESC, start_time ASC NULLS LAST
    `);
  }

  return NextResponse.json(rows);
}

export async function POST(req) {
  await ensureInit();
  const body = await req.json();
  const { title, notes, category, is_reminder, start_time, all_day } = body;

  if (!title || !title.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }

  const { rows } = await sql`
    INSERT INTO schedule_items (title, notes, category, is_reminder, start_time, all_day)
    VALUES (
      ${title.trim()},
      ${notes || null},
      ${category || 'personal'},
      ${!!is_reminder},
      ${start_time || null},
      ${!start_time}
    )
    RETURNING *
  `;

  return NextResponse.json(rows[0]);
}
