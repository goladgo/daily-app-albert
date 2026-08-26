import { NextResponse } from 'next/server';
import { sql, ensureInit } from '@/lib/db';

export async function PATCH(req, { params }) {
  await ensureInit();
  const id = Number(params.id);
  const { completed } = await req.json();

  const { rows } = await sql`
    UPDATE schedule_items SET completed = ${!!completed}
    WHERE id = ${id}
    RETURNING *
  `;

  return NextResponse.json(rows[0] || {});
}

export async function DELETE(req, { params }) {
  await ensureInit();
  const id = Number(params.id);
  await sql`DELETE FROM schedule_items WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
