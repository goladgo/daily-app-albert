import { NextResponse } from 'next/server';
import { sql, ensureInit, rolloverOverdueItems } from '@/lib/db';
import { fetchGoogleWeekEvents } from '@/lib/google';
import { fetchOutlookWeekEvents } from '@/lib/outlook';

export async function GET(req) {
  await ensureInit();
  await rolloverOverdueItems();
  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  if (!from || !to) {
    return NextResponse.json({ error: 'from and to are required' }, { status: 400 });
  }

  const [googleEvents, outlookEvents, localRows, syncedOutlookRows] = await Promise.all([
    fetchGoogleWeekEvents(from, to),
    fetchOutlookWeekEvents(from, to),
    sql`
      SELECT * FROM schedule_items
      WHERE completed = false
      AND (start_time IS NULL OR (start_time >= ${from}::timestamptz AND start_time < ${to}::timestamptz))
      ORDER BY start_time ASC NULLS FIRST
    `,
    sql`
      SELECT * FROM outlook_calendar_events
      WHERE start_time >= ${from}::timestamptz AND start_time < ${to}::timestamptz
      ORDER BY start_time ASC
    `,
  ]);

  const localItems = localRows.rows.map((row) => ({
    id: `local_${row.id}`,
    localId: row.id,
    title: row.title,
    notes: row.notes,
    start: row.start_time,
    allDay: !row.start_time,
    source: 'local',
    isReminder: row.is_reminder,
    category: row.category,
  }));

  const syncedOutlookItems = syncedOutlookRows.rows.map((row) => ({
    id: `outlookc_${row.event_id}`,
    title: row.subject,
    start: row.start_time,
    allDay: row.all_day,
    source: 'outlook',
  }));

  const personal = [
    ...(Array.isArray(googleEvents) ? googleEvents : []),
    ...localItems.filter((i) => i.category === 'personal'),
  ];

  const work = [
    ...(Array.isArray(outlookEvents) ? outlookEvents : []),
    ...syncedOutlookItems,
    ...localItems.filter((i) => i.category === 'work'),
  ];

  const sortFn = (a, b) => {
    if (!a.start) return -1;
    if (!b.start) return 1;
    return new Date(a.start) - new Date(b.start);
  };

  return NextResponse.json({
    work: work.sort(sortFn),
    personal: personal.sort(sortFn),
    googleError: googleEvents && googleEvents.error ? googleEvents.status : null,
    outlookError: outlookEvents && outlookEvents.error ? outlookEvents.status : null,
    googleConnected: googleEvents !== null,
    outlookConnected: outlookEvents !== null,
  });
}
