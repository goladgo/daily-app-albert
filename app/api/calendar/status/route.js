import { NextResponse } from 'next/server';
import { sql, ensureInit } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  await ensureInit();
  const { rows } = await sql`SELECT provider, account_email FROM oauth_accounts`;
  const status = { google: null, outlook: null };
  for (const row of rows) {
    status[row.provider] = { connected: true, email: row.account_email };
  }
  return NextResponse.json(status);
}
