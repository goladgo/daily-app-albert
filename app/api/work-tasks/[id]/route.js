import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { ensureWorkTasks } from '@/lib/workTasks';

// PATCH { done: true } marks a task complete; DELETE dismisses it.
export async function PATCH(req, { params }) {
  await ensureWorkTasks();
  const { done } = await req.json().catch(() => ({}));
  await sql`UPDATE work_tasks SET done = ${!!done}, updated_at = now() WHERE id = ${Number(params.id)}`;
  return NextResponse.json({ ok: true });
}

export async function DELETE(req, { params }) {
  await ensureWorkTasks();
  await sql`UPDATE work_tasks SET dismissed = true, updated_at = now() WHERE id = ${Number(params.id)}`;
  return NextResponse.json({ ok: true });
}
