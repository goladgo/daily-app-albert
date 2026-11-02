import ICAL from 'ical.js';
import { fetchOutlookWeekEvents } from '@/lib/outlook';

// Reads the user's published Outlook calendar (ICS link kept in the
// OUTLOOK_ICS_URL env var). No Microsoft login or admin consent needed.
// Only titles, times and locations are used; descriptions are ignored.

let cache = { at: 0, text: null };
const TTL_MS = 60 * 1000;

async function loadIcsText() {
  const raw = process.env.OUTLOOK_ICS_URL;
  if (!raw) return null;
  if (cache.text && Date.now() - cache.at < TTL_MS) return cache.text;

  // Tolerate stray whitespace/newlines or wrapping quotes in the env value.
  const url = raw.trim().replace(/^["']|["']$/g, '');

  const res = await fetch(url, {
    cache: 'no-store',
    redirect: 'follow',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      Accept: 'text/calendar, text/plain;q=0.9, */*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });
  if (!res.ok) {
    // Safe diagnostics only (never the secret path itself).
    const looksRight = url.startsWith('https://outlook.office365.com/owa/calendar/') && url.endsWith('/calendar.ics');
    let snippet = '';
    try { snippet = (await res.text()).slice(0, 120).replace(/\s+/g, ' '); } catch (e) {}
    throw new Error(`ICS fetch failed: ${res.status} (url length ${url.length}, expected shape ${looksRight}, type ${res.headers.get('content-type')}) ${snippet}`);
  }
  const text = await res.text();
  if (!text.includes('BEGIN:VCALENDAR')) {
    throw new Error(`ICS response was not a calendar (length ${text.length}, type ${res.headers.get('content-type')})`);
  }
  cache = { at: Date.now(), text };
  return text;
}

function isCanceled(title) {
  return /^cancell?ed\b/i.test(title);
}

function pushEvent(out, ev, start, end, fromMs, toMs, fromDate, toDate) {
  const title = (ev.summary || '').trim();
  if (!title || isCanceled(title)) return;
  const loc = (ev.location || '').trim();
  const notes = loc && !/^microsoft teams meeting$/i.test(loc) ? loc : null;

  if (start.isDate) {
    const s = Date.UTC(start.year, start.month - 1, start.day);
    const e = end ? Date.UTC(end.year, end.month - 1, end.day) : s + 86400000;
    for (let t = s; t < e && t < s + 31 * 86400000; t += 86400000) {
      const ds = new Date(t).toISOString().slice(0, 10);
      if (ds >= fromDate && ds < toDate) {
        out.push({ id: `outlookics_${ev.uid}|${ds}`, title, start: ds, allDay: true, source: 'outlook', notes });
      }
    }
    return;
  }

  const ms = start.toJSDate().getTime();
  if (ms >= fromMs && ms < toMs) {
    out.push({ id: `outlookics_${ev.uid}|${ms}`, title, start: new Date(ms).toISOString(), allDay: false, source: 'outlook', notes });
  }
}

export async function fetchOutlookIcsEvents(from, to) {
  const text = await loadIcsText();
  if (!text) return null;

  const fromMs = new Date(from).getTime();
  const toMs = new Date(to).getTime();
  const fromDate = new Date(fromMs).toISOString().slice(0, 10);
  const toDate = new Date(toMs).toISOString().slice(0, 10);

  const root = new ICAL.Component(ICAL.parse(text));
  for (const tz of root.getAllSubcomponents('vtimezone')) {
    try { ICAL.TimezoneService.register(tz); } catch (e) {}
  }

  const masters = new Map();
  const exceptions = [];
  const singles = [];
  for (const ve of root.getAllSubcomponents('vevent')) {
    const ev = new ICAL.Event(ve);
    if (ev.isRecurrenceException()) exceptions.push(ev);
    else if (ev.isRecurring()) masters.set(ev.uid, ev);
    else singles.push(ev);
  }
  for (const ex of exceptions) {
    const m = masters.get(ex.uid);
    if (m) m.relateException(ex);
    else singles.push(ex);
  }

  const out = [];
  for (const ev of singles) {
    try { pushEvent(out, ev, ev.startDate, ev.endDate, fromMs, toMs, fromDate, toDate); } catch (e) {}
  }
  for (const m of masters.values()) {
    try {
      const it = m.iterator();
      let next;
      let guard = 0;
      while ((next = it.next()) && guard++ < 3000) {
        if (next.toJSDate().getTime() >= toMs + 86400000) break;
        const d = m.getOccurrenceDetails(next);
        pushEvent(out, d.item, d.startDate, d.endDate, fromMs, toMs, fromDate, toDate);
      }
    } catch (e) {}
  }

  const seen = new Set();
  return out
    .filter((e) => (seen.has(e.id) ? false : seen.add(e.id)))
    .sort((a, b) => new Date(a.start) - new Date(b.start));
}

// For the reminder cron: use the published calendar when configured,
// otherwise fall back to the live Graph call.
export async function fetchOutlookEventsForReminders(from, to) {
  if (process.env.OUTLOOK_ICS_URL) {
    try {
      const evs = await fetchOutlookIcsEvents(from, to);
      if (Array.isArray(evs)) return evs;
    } catch (e) {
      console.error('ICS reminders fetch failed:', e);
    }
  }
  return fetchOutlookWeekEvents(from, to);
}
