import { NextResponse } from 'next/server';
import { sql, ensureInit } from '@/lib/db';
import { googleExchangeCode } from '@/lib/google';

export async function GET(req) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const origin = url.origin;

  if (!code) {
    return NextResponse.redirect(`${origin}/?calendar_error=google`);
  }

  await ensureInit();

  try {
    const tokens = await googleExchangeCode(code, origin);
    const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();

    let accountEmail = null;
    try {
      const infoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (infoRes.ok) {
        const info = await infoRes.json();
        accountEmail = info.email || null;
      }
    } catch (e) {}

    await sql`
      INSERT INTO oauth_accounts (provider, access_token, refresh_token, expires_at, account_email, updated_at)
      VALUES ('google', ${tokens.access_token}, ${tokens.refresh_token || null}, ${expiresAt}, ${accountEmail}, now())
      ON CONFLICT (provider) DO UPDATE SET
        access_token = EXCLUDED.access_token,
        refresh_token = COALESCE(EXCLUDED.refresh_token, oauth_accounts.refresh_token),
        expires_at = EXCLUDED.expires_at,
        account_email = EXCLUDED.account_email,
        updated_at = now()
    `;

    return NextResponse.redirect(`${origin}/?calendar_connected=google`);
  } catch (err) {
    return NextResponse.redirect(`${origin}/?calendar_error=google`);
  }
}
