import { sql, ensureInit } from '@/lib/db';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/calendar openid email';

function redirectUri(origin) {
  return `${origin}/api/auth/google/callback`;
}

export function googleAuthUrl(origin) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(origin),
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export async function googleExchangeCode(code, origin) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri(origin),
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${await res.text()}`);
  return res.json();
}

async function refreshGoogleToken(refreshToken) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed: ${await res.text()}`);
  return res.json();
}

export async function getGoogleAccessToken() {
  await ensureInit();
  const { rows } = await sql`SELECT * FROM oauth_accounts WHERE provider = 'google'`;
  const account = rows[0];
  if (!account) return null;

  const expiresAt = account.expires_at ? new Date(account.expires_at).getTime() : 0;
  if (expiresAt > Date.now() + 60000) {
    return account.access_token;
  }

  if (!account.refresh_token) return null;

  let tokens;
  try {
    tokens = await refreshGoogleToken(account.refresh_token);
  } catch (err) {
    // A dead/revoked refresh token should degrade to "Google not connected"
    // rather than throwing — this used to propagate out of Promise.all in
    // /api/calendar/week and take down the entire calendar response
    // (Outlook events included), not just the Google side.
    console.error('Google token refresh failed, treating as disconnected:', err);
    return null;
  }
  const newExpiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();
  await sql`
    UPDATE oauth_accounts SET access_token = ${tokens.access_token}, expires_at = ${newExpiresAt}, updated_at = now()
    WHERE provider = 'google'
  `;
  return tokens.access_token;
}

const BIRTHDAYS_CALENDAR_ID = 'addressbook#contacts@group.v.calendar.google.com';

async function fetchRawCalendarEvents(token, calendarId, from, to) {
  const params = new URLSearchParams({
    timeMin: from,
    timeMax: to,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '100',
  });

  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    return { error: true, status: res.status };
  }

  const data = await res.json();
  return (data.items || []).filter((ev) => ev.status !== 'cancelled');
}

export async function fetchGoogleWeekEvents(from, to) {
  const token = await getGoogleAccessToken();
  if (!token) return null;

  const primaryEvents = await fetchRawCalendarEvents(token, 'primary', from, to);
  if (primaryEvents && primaryEvents.error) {
    return primaryEvents;
  }

  const birthdayEvents = await fetchRawCalendarEvents(token, BIRTHDAYS_CALENDAR_ID, from, to);
  const birthdays = Array.isArray(birthdayEvents) ? birthdayEvents : [];

  const toItem = (ev, source) => ({
    id: `google_${ev.id}`,
    title: ev.summary || '(no title)',
    start: ev.start?.dateTime || ev.start?.date || null,
    allDay: !ev.start?.dateTime,
    source,
  });

  const combined = [
    ...primaryEvents.map((ev) => toItem(ev, 'google')),
    ...birthdays.map((ev) => toItem(ev, 'google_birthday')),
  ];

  const seen = new Set();
  return combined.filter((ev) => {
    if (seen.has(ev.id)) return false;
    seen.add(ev.id);
    return true;
  });
}

function toGoogleEventBody({ title, start, allDay }) {
  if (allDay) {
    const [y, m, d] = start.split('-').map(Number);
    const end = new Date(y, m - 1, d + 1);
    const endStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
    return {
      summary: title,
      start: { date: start },
      end: { date: endStr },
    };
  }
  const endIso = new Date(new Date(start).getTime() + 30 * 60000).toISOString();
  return {
    summary: title,
    start: { dateTime: start },
    end: { dateTime: endIso },
  };
}

function fromGoogleEvent(ev) {
  return {
    id: `google_${ev.id}`,
    title: ev.summary || '(no title)',
    start: ev.start?.dateTime || ev.start?.date || null,
    allDay: !ev.start?.dateTime,
    source: 'google',
  };
}

export async function createGoogleEvent({ title, start, allDay }) {
  const token = await getGoogleAccessToken();
  if (!token) return null;

  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(toGoogleEventBody({ title, start, allDay })),
  });
  if (!res.ok) return { error: true, status: res.status };
  return fromGoogleEvent(await res.json());
}

export async function updateGoogleEvent(eventId, { title, start, allDay }) {
  const token = await getGoogleAccessToken();
  if (!token) return null;

  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(toGoogleEventBody({ title, start, allDay })),
  });
  if (!res.ok) return { error: true, status: res.status };
  return fromGoogleEvent(await res.json());
}

export async function deleteGoogleEvent(eventId) {
  const token = await getGoogleAccessToken();
  if (!token) return false;

  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.ok || res.status === 410;
}
