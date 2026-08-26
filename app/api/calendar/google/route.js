import { NextResponse } from 'next/server';
import { createGoogleEvent } from '@/lib/google';

export async function POST(req) {
  const body = await req.json();
  const { title, start, allDay } = body || {};

  if (!title || !title.trim() || !start) {
    return NextResponse.json({ error: 'title and start are required' }, { status: 400 });
  }

  const result = await createGoogleEvent({ title: title.trim(), start, allDay: !!allDay });

  if (!result) {
    return NextResponse.json({ error: 'Google Calendar not connected' }, { status: 400 });
  }
  if (result.error) {
    return NextResponse.json({ error: 'Failed to create event' }, { status: result.status || 500 });
  }

  return NextResponse.json(result);
}
