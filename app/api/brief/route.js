import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { ensureHomeTables } from '@/lib/home';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET() {
  await ensureHomeTables();
  const { rows } = await sql`SELECT data, updated_at FROM daily_brief WHERE id = 1`;
  if (!rows[0]) return NextResponse.json({ data: null, updatedAt: null });
  return NextResponse.json({ data: rows[0].data, updatedAt: rows[0].updated_at });
}
