import { NextResponse } from 'next/server';
import { sql, ensureInit } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  await ensureInit();
  const { rows } = await sql`
    SELECT * FROM flagged_emails
    WHERE dismissed = false
    ORDER BY received_at DESC NULLS LAST, created_at DESC
  `;
  return NextResponse.json(rows);
}
