import { NextResponse } from 'next/server';

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const { password } = body;
  const appPassword = process.env.APP_PASSWORD;

  if (!appPassword) {
    return NextResponse.json(
      { error: 'Server not configured: set APP_PASSWORD env var in Vercel project settings.' },
      { status: 500 }
    );
  }

  if (password !== appPassword) {
    return NextResponse.json({ error: 'Wrong password' }, { status: 401 });
  }

  const session = process.env.SESSION_SECRET || 'dev-secret-change-me';
  const res = NextResponse.json({ ok: true });
  res.cookies.set('session', session, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
