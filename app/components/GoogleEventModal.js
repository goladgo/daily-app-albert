'use client';

import { useState } from 'react';

function toDateInputValue(iso, allDay) {
  if (!iso) return new Date().toISOString().slice(0, 10);
  if (allDay) return iso.slice(0, 10);
  return new Date(iso).toISOString().slice(0, 10);
}

function toTimeInputValue(iso, allDay) {
  if (!iso || allDay) return '09:00';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function GoogleEventModal({ event, onClose, onSave, onDelete }) {
  const isEditing = !!event;
  const [title, setTitle] = useState(event?.title || '');
  const [allDay, setAllDay] = useState(event?.allDay || false);
  const [date, setDate] = useState(toDateInputValue(event?.start, event?.allDay));
  const [time, setTime] = useState(toTimeInputValue(event?.start, event?.allDay));
  const [saving, setSaving] = useState(false);

  function handleSave() {
    if (!title.trim() || !date) return;
    setSaving(true);
    let start;
    if (allDay) {
      start = date;
    } else {
      start = new Date(`${date}T${time || '09:00'}:00`).toISOString();
    }
    onSave({ title: title.trim(), start, allDay }).finally(() => setSaving(false));
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2>{isEditing ? 'Edit event' : 'New event'}</h2>
        <input
          type="text"
          placeholder="Event title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="checkbox-row">
          <input
            type="checkbox"
            checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
            id="google-event-allday"
          />
          <label htmlFor="google-event-allday">All day</label>
        </div>
        <div className="row-inline">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          {!allDay && (
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          )}
        </div>
        <div className="form-actions">
          <button className="btn-cancel" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn-save" onClick={handleSave} disabled={saving || !title.trim()}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
        {isEditing && (
          <button
            className="modal-delete"
            disabled={saving}
            onClick={() => { setSaving(true); onDelete().finally(() => setSaving(false)); }}
          >
            Delete event
          </button>
        )}
      </div>
    </div>
  );
}
