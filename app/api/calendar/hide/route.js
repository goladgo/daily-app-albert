import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { ensureHomeTables } from '@/lib/home';

export const dynamic = 'force-dynamic';

// Hides an Outlook event from the app (Outlook itself is read-only here).
export async function POST(req) {
  await ensureHomeTables();
  const { id } = await req.json().catch(() => ({}));
  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }
  await sql`INSERT INTO hidden_calendar_events (event_id) VALUES (${id}) ON CONFLICT DO NOTHING`;
  return NextResponse.json({ ok: true });
}
