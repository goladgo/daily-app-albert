import { NextResponse } from 'next/server';
import { sql, ensureInit } from '@/lib/db';

export async function GET() {
  await ensureInit();
  const { rows } = await sql`
    SELECT * FROM grocery_items ORDER BY checked ASC, created_at ASC
  `;
  return NextResponse.json(rows);
}

export async function POST(req) {
  await ensureInit();
  const { name } = await req.json();

  if (!name || !name.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  const { rows } = await sql`
    INSERT INTO grocery_items (name) VALUES (${name.trim()}) RETURNING *
  `;
  return NextResponse.json(rows[0]);
}
