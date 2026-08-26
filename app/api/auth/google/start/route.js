import { NextResponse } from 'next/server';
import { googleAuthUrl } from '@/lib/google';

export async function GET(req) {
  const origin = new URL(req.url).origin;
  return NextResponse.redirect(googleAuthUrl(origin));
}
