import { NextResponse } from 'next/server';
import { sql, ensureInit } from '@/lib/db';

export async function PATCH(req, { params }) {
  await ensureInit();
  const id = Number(params.id);
  const { checked } = await req.json();

  const { rows } = await sql`
    UPDATE grocery_items SET checked = ${!!checked}
    WHERE id = ${id}
    RETURNING *
  `;

  return NextResponse.json(rows[0] || {});
}

export async function DELETE(req, { params }) {
  await ensureInit();
  const id = Number(params.id);
  await sql`DELETE FROM grocery_items WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
