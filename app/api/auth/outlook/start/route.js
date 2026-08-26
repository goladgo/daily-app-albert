import { NextResponse } from 'next/server';
import { outlookAuthUrl } from '@/lib/outlook';

export async function GET(req) {
  const origin = new URL(req.url).origin;
  return NextResponse.redirect(outlookAuthUrl(origin));
}
