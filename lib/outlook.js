import { sql, ensureInit } from '@/lib/db';

const AUTH_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
const TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const SCOPE = 'offline_access openid email User.Read Calendars.Read';

function redirectUri(origin) {
  return `${origin}/api/auth/outlook/callback`;
}

export function outlookAuthUrl(origin) {
  const params = new URLSearchParams({
    client_id: process.env.OUTLOOK_CLIENT_ID,
    redirect_uri: redirectUri(origin),
    response_type: 'code',
    response_mode: 'query',
    scope: SCOPE,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export async function outlookExchangeCode(code, origin) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.OUTLOOK_CLIENT_ID,
      client_secret: process.env.OUTLOOK_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri(origin),
      scope: SCOPE,
    }),
  });
  if (!res.ok) throw new Error(`Outlook token exchange failed: ${await res.text()}`);
  return res.json();
}

async function refreshOutlookToken(refreshToken) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.OUTLOOK_CLIENT_ID,
      client_secret: process.env.OUTLOOK_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      scope: SCOPE,
    }),
  });
  if (!res.ok) throw new Error(`Outlook token refresh failed: ${await res.text()}`);
  return res.json();
}

export async function getOutlookAccessToken() {
  await ensureInit();
  const { rows } = await sql`SELECT * FROM oauth_accounts WHERE provider = 'outlook'`;
  const account = rows[0];
  if (!account) return null;

  const expiresAt = account.expires_at ? new Date(account.expires_at).getTime() : 0;
  if (expiresAt > Date.now() + 60000) {
    return account.access_token;
  }

  if (!account.refresh_token) return null;

  let tokens;
  try {
    tokens = await refreshOutlookToken(account.refresh_token);
  } catch (err) {
    // Same reasoning as the Google side: a dead/revoked refresh token
    // should degrade to "Outlook not connected" rather than throwing and
    // taking down the whole /api/calendar/week response.
    console.error('Outlook token refresh failed, treating as disconnected:', err);
    return null;
  }
  const newExpiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();
  await sql`
    UPDATE oauth_accounts SET
      access_token = ${tokens.access_token},
      refresh_token = ${tokens.refresh_token || account.refresh_token},
      expires_at = ${newExpiresAt},
      updated_at = now()
    WHERE provider = 'outlook'
  `;
  return tokens.access_token;
}

export async function fetchOutlookWeekEvents(from, to) {
  const token = await getOutlookAccessToken();
  if (!token) return null;

  const params = new URLSearchParams({
    startDateTime: from,
    endDateTime: to,
  });

  const res = await fetch(`https://graph.microsoft.com/v1.0/me/calendarview?${params.toString()}&$orderby=start/dateTime&$top=100`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Prefer: 'outlook.timezone="UTC"',
    },
  });

  if (!res.ok) {
    return { error: true, status: res.status };
  }

  const data = await res.json();
  return (data.value || []).map((ev) => ({
    id: `outlook_${ev.id}`,
    title: ev.subject || '(no title)',
    start: ev.start?.dateTime ? `${ev.start.dateTime}Z` : null,
    allDay: !!ev.isAllDay,
    source: 'outlook',
  }));
}
