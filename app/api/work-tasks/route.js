import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { ensureWorkTasks } from '@/lib/workTasks';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET() {
  await ensureWorkTasks();
  const { rows } = await sql`
    SELECT * FROM work_tasks
    WHERE done = false AND dismissed = false
    ORDER BY received_at DESC NULLS LAST, created_at DESC
  `;
  return NextResponse.json(rows);
}
