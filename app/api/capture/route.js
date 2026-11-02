import { NextResponse } from 'next/server';
import { sql, ensureInit } from '@/lib/db';
import { createGoogleEvent } from '@/lib/google';

export const dynamic = 'force-dynamic';

// Voice/Siri capture endpoint, called from an iPhone Shortcut.
// Protected by its own key (CAPTURE_KEY) sent in the x-capture-key header.
// Body: { type: 'braindump' | 'grocery' | 'task' | 'event', text, start?, category? }

function authorized(req) {
  const key = req.headers.get('x-capture-key');
  return !!process.env.CAPTURE_KEY && key === process.env.CAPTURE_KEY;
}

const bad = (msg, status = 400) => NextResponse.json({ ok: false, message: msg }, { status });

export async function POST(req) {
  if (!authorized(req)) return bad('unauthorized', 401);

  const body = await req.json().catch(() => ({}));
  const type = String(body.type || '').toLowerCase().trim();
  const text = String(body.text || '').trim().slice(0, 500);
  if (!text) return bad('Nothing to add');

  await ensureInit();

  if (type === 'braindump' || type === 'note') {
    await sql`INSERT INTO braindump_items (content) VALUES (${text})`;
    return NextResponse.json({ ok: true, message: 'Added to your brain dump' });
  }

  if (type === 'grocery' || type === 'groceries') {
    // "milk, eggs, bread" becomes three items (commas / new lines only).
    const items = text.split(/[,\n]+/).map((s) => s.trim()).filter(Boolean).slice(0, 20);
    if (items.length === 0) return bad('Nothing to add');
    for (const name of items) {
      await sql`INSERT INTO grocery_items (name) VALUES (${name})`;
    }
    return NextResponse.json({
      ok: true,
      message: `Added to groceries: ${items.join(', ')}`,
    });
  }

  if (type === 'task') {
    const category = body.category === 'work' ? 'work' : 'personal';
    let startTime = null;
    if (body.start) {
      const d = new Date(body.start);
      if (Number.isNaN(d.getTime())) return bad('Could not read that time');
      startTime = d.toISOString();
    }
    await sql`
      INSERT INTO schedule_items (title, category, is_reminder, start_time, all_day)
      VALUES (${text}, ${category}, ${!!body.reminder}, ${startTime}, ${!startTime})
    `;
    return NextResponse.json({ ok: true, message: `Added ${category} task for today` });
  }

  if (type === 'event') {
    if (!body.start) return bad('An event needs a date');
    const startStr = String(body.start).trim();
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(startStr);
    let start = startStr;
    if (!dateOnly) {
      const d = new Date(startStr);
      if (Number.isNaN(d.getTime())) return bad('Could not read that date');
      start = d.toISOString();
    }
    const result = await createGoogleEvent({ title: text, start, allDay: dateOnly || !!body.allDay });
    if (!result) return bad('Google Calendar is not connected');
    if (result.error) return bad('Google rejected the event', 502);
    return NextResponse.json({ ok: true, message: 'Added to your Google Calendar' });
  }

  return bad('Unknown type. Use braindump, grocery, task or event');
}
