import { NextResponse } from 'next/server';
import { sql, ensureInit, rolloverOverdueItems } from '@/lib/db';
import { ensureHomeTables } from '@/lib/home';
import { fetchGoogleWeekEvents } from '@/lib/google';
import { fetchOutlookWeekEvents } from '@/lib/outlook';
import { fetchOutlookIcsEvents } from '@/lib/outlookIcs';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET(req) {
  await ensureInit();
  await ensureHomeTables();
  await rolloverOverdueItems();
  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  if (!from || !to) {
    return NextResponse.json({ error: 'from and to are required' }, { status: 400 });
  }

  // Each provider fetch is caught individually so a failure in one
  // integration (e.g. a revoked OAuth refresh token) can't reject the
  // whole Promise.all and blank out the other provider's events too.
  const [googleEvents, outlookEvents, icsEvents, localRows, syncedOutlookRows, hiddenRows] = await Promise.all([
    fetchGoogleWeekEvents(from, to).catch((err) => {
      console.error('fetchGoogleWeekEvents failed:', err);
      return { error: true, status: 0 };
    }),
    fetchOutlookWeekEvents(from, to).catch((err) => {
      console.error('fetchOutlookWeekEvents failed:', err);
      return { error: true, status: 0 };
    }),
    fetchOutlookIcsEvents(from, to).catch((err) => {
      console.error('fetchOutlookIcsEvents failed:', err);
      return null;
    }),
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
    sql`SELECT event_id FROM hidden_calendar_events`,
  ]);

  const hidden = new Set(hiddenRows.rows.map((r) => r.event_id));

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

  // The live Graph call and the synced table can both return the same
  // meeting. Prefer the synced copy (stable id) and drop duplicates by
  // title + start time, then drop anything the user hid.
  // When the published Outlook calendar (ICS) is available it is the
  // source of truth, so synced rows / the live Graph call are ignored.
  const icsOk = Array.isArray(icsEvents);
  const seenOutlook = new Set();
  const outlookAll = (icsOk ? icsEvents : [
    ...syncedOutlookItems,
    ...(Array.isArray(outlookEvents) ? outlookEvents : []),
  ]).filter((ev) => {
    const key = `${String(ev.title || '').trim().toLowerCase()}|${ev.start ? new Date(ev.start).getTime() : ''}`;
    if (seenOutlook.has(key)) return false;
    seenOutlook.add(key);
    return !hidden.has(ev.id);
  });

  const personal = [
    ...(Array.isArray(googleEvents) ? googleEvents : []),
    ...localItems.filter((i) => i.category === 'personal'),
  ];

  const work = [
    ...outlookAll,
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
    outlookConnected: icsOk || outlookEvents !== null,
  });
}
