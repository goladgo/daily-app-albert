import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { ensureHomeTables } from '@/lib/home';
import { fetchWaterStatus } from '@/lib/water';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET() {
  await ensureHomeTables();
  const { rows } = await sql`SELECT data, updated_at FROM daily_brief WHERE id = 1`;
  const stored = rows[0] ? rows[0].data : null;

  // Live county data wins over whatever the morning task stored for water.
  const live = await fetchWaterStatus().catch(() => null);
  let data = stored;
  if (live) {
    data = { news: [], ...(stored || {}), water: live };
  }

  return NextResponse.json({
    data,
    updatedAt: rows[0] ? rows[0].updated_at : null,
    waterLive: !!live,
  });
}
