import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { sql, ensureInit } from '@/lib/db';
import { fetchGoogleWeekEvents } from '@/lib/google';
import { fetchOutlookWeekEvents } from '@/lib/outlook';

export const dynamic = 'force-dynamic';

function isAuthorized(req) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get('secret') || req.headers.get('x-cron-secret');
  return !!process.env.CRON_SECRET && secret === process.env.CRON_SECRET;
}

async function sendToAllSubs(subs, payload, webpush) {
  let sent = 0;
  for (const sub of subs) {
    const pushSub = {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth },
    };
    try {
      await webpush.sendNotification(pushSub, payload);
      sent += 1;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await sql`DELETE FROM push_subscriptions WHERE endpoint = ${sub.endpoint}`;
      }
    }
  }
  return sent;
}

export async function GET(req) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  await ensureInit();

  const vapidPublic = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;

  if (!vapidPublic || !vapidPrivate) {
    return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 500 });
  }

  webpush.setVapidDetails('mailto:albertq31@gmail.com', vapidPublic, vapidPrivate);

  const { rows: subs } = await sql`SELECT * FROM push_subscriptions`;

  let totalSent = 0;
  let localItemCount = 0;
  let calendarEventCount = 0;

  const { rows: due } = await sql`
    SELECT * FROM schedule_items
    WHERE completed = false AND notified = false
    AND start_time IS NOT NULL AND start_time <= now()
  `;

  for (const item of due) {
    const time = new Date(item.start_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const title = item.is_reminder ? 'Reminder' : `${item.category === 'work' ? 'Work' : 'Personal'} · ${time}`;
    const payload = JSON.stringify({ title, body: item.title, url: '/' });
    totalSent += await sendToAllSubs(subs, payload, webpush);
    await sql`UPDATE schedule_items SET notified = true WHERE id = ${item.id}`;
    localItemCount += 1;
  }

  const now = new Date();
  const soon = new Date(now.getTime() + 15 * 60 * 1000);
  const nowIso = now.toISOString();
  const soonIso = soon.toISOString();

  const [googleEvents, outlookEvents] = await Promise.all([
    fetchGoogleWeekEvents(nowIso, soonIso),
    fetchOutlookWeekEvents(nowIso, soonIso),
  ]);

  const upcoming = [
    ...(Array.isArray(googleEvents) ? googleEvents.filter((e) => !e.allDay) : []),
    ...(Array.isArray(outlookEvents) ? outlookEvents.filter((e) => !e.allDay) : []),
  ];

  for (const ev of upcoming) {
    const { rows: already } = await sql`SELECT 1 FROM notified_calendar_events WHERE event_id = ${ev.id}`;
    if (already.length > 0) continue;

    const time = formatTimeUtc(ev.start);
    const source = ev.source === 'google' ? 'Personal' : 'Work';
    const payload = JSON.stringify({ title: `${source} · ${time}`, body: ev.title, url: '/' });

    totalSent += await sendToAllSubs(subs, payload, webpush);

    await sql`INSERT INTO notified_calendar_events (event_id) VALUES (${ev.id}) ON CONFLICT DO NOTHING`;
    calendarEventCount += 1;
  }

  return NextResponse.json({ sent: totalSent, localItems: localItemCount, calendarEvents: calendarEventCount });
}

function formatTimeUtc(iso) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch (e) {
    return '';
  }
}
