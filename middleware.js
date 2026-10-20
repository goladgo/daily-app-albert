import { NextResponse } from 'next/server';

const PUBLIC_EXACT = ['/login', '/api/auth', '/manifest.json', '/icon-192.png', '/icon-512.png', '/favicon.ico', '/sw.js'];
const PUBLIC_PREFIXES = ['/api/cron', '/api/inbox/ingest', '/api/calendar/outlook-sync', '/api/tasks/ingest', '/api/flagged/ingest', '/api/events/ingest'];

function isPublic(pathname) {
  return PUBLIC_EXACT.includes(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

export function middleware(req) {
  const { pathname } = req.nextUrl;

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  const session = req.cookies.get('session')?.value;
  const expected = process.env.SESSION_SECRET || 'dev-secret-change-me';

  if (!session || session !== expected) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
