import { NextResponse } from 'next/server';
import { sql, ensureInit } from '@/lib/db';

export async function DELETE(req, { params }) {
  await ensureInit();
  const id = Number(params.id);
  await sql`DELETE FROM braindump_items WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
