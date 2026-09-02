import { NextResponse } from 'next/server';
import { sql, ensureInit } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  await ensureInit();
  const { rows } = await sql`
    SELECT * FROM braindump_items ORDER BY created_at ASC
  `;
  return NextResponse.json(rows);
}

export async function POST(req) {
  await ensureInit();
  const { content } = await req.json();

  if (!content || !content.trim()) {
    return NextResponse.json({ error: 'Content is required' }, { status: 400 });
  }

  const { rows } = await sql`
    INSERT INTO braindump_items (content) VALUES (${content.trim()}) RETURNING *
  `;
  return NextResponse.json(rows[0]);
}
