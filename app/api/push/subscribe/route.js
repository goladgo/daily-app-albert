import { NextResponse } from 'next/server';
import { sql, ensureInit } from '@/lib/db';

export async function POST(req) {
  await ensureInit();
  const body = await req.json();
  const { endpoint, keys } = body || {};

  if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
  }

  await sql`
    INSERT INTO push_subscriptions (endpoint, p256dh, auth)
    VALUES (${endpoint}, ${keys.p256dh}, ${keys.auth})
    ON CONFLICT (endpoint) DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth
  `;

  return NextResponse.json({ ok: true });
}

export async function DELETE(req) {
  await ensureInit();
  const { endpoint } = await req.json();
  if (endpoint) {
    await sql`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint}`;
  }
  return NextResponse.json({ ok: true });
}
