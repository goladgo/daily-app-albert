import { NextResponse } from 'next/server';
import { updateGoogleEvent, deleteGoogleEvent } from '@/lib/google';

export async function PATCH(req, { params }) {
  const body = await req.json();
  const { title, start, allDay } = body || {};

  if (!title || !title.trim() || !start) {
    return NextResponse.json({ error: 'title and start are required' }, { status: 400 });
  }

  const result = await updateGoogleEvent(params.id, { title: title.trim(), start, allDay: !!allDay });

  if (!result) {
    return NextResponse.json({ error: 'Google Calendar not connected' }, { status: 400 });
  }
  if (result.error) {
    return NextResponse.json({ error: 'Failed to update event' }, { status: result.status || 500 });
  }

  return NextResponse.json(result);
}

export async function DELETE(req, { params }) {
  const ok = await deleteGoogleEvent(params.id);
  if (!ok) {
    return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
