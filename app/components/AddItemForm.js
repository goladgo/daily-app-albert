'use client';

import { useState } from 'react';
import MicButton from './MicButton';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Unified add: Task (today, optional time) / Google event / Local event.
export default function AddItemForm({ googleConnected, onAdd, onCancel }) {
  const [type, setType] = useState('task');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(todayStr());
  const [time, setTime] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [category, setCategory] = useState('personal');
  const [reminder, setReminder] = useState(false);
  const [venue, setVenue] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onAdd({ type, title: title.trim(), date, time, allDay, category, reminder, venue: venue.trim() });
    } finally {
      setSaving(false);
    }
  }

  const showDate = type !== 'task';
  const showAllDay = type !== 'task';

  return (
    <form className="add-form" onSubmit={submit}>
      <div className="pill-group">
        <div className={`pill ${type === 'task' ? 'active personal' : ''}`} onClick={() => setType('task')}>Task</div>
        {googleConnected && (
          <div className={`pill ${type === 'google' ? 'active work' : ''}`} onClick={() => setType('google')}>Google event</div>
        )}
        <div className={`pill ${type === 'local' ? 'active personal' : ''}`} onClick={() => setType('local')}>Local event</div>
      </div>

      <div className="row-inline">
        <input type="text" placeholder="What is it?" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        <MicButton onResult={(t) => setTitle((p) => (p ? `${p} ${t}` : t))} />
      </div>

      {type === 'local' && (
        <input type="text" placeholder="Venue (optional)" value={venue} onChange={(e) => setVenue(e.target.value)} />
      )}

      <div className="row-inline">
        {showDate && <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
        {!(showAllDay && allDay) && <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />}
      </div>

      {showAllDay && (
        <label className="checkbox-row">
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} /> All day
        </label>
      )}

      {type === 'task' && (
        <>
          <div className="pill-group">
            <div className={`pill ${category === 'work' ? 'active work' : ''}`} onClick={() => setCategory('work')}>Work</div>
            <div className={`pill ${category === 'personal' ? 'active personal' : ''}`} onClick={() => setCategory('personal')}>Personal</div>
          </div>
          <label className="checkbox-row">
            <input type="checkbox" checked={reminder} onChange={(e) => setReminder(e.target.checked)} /> This is a reminder
          </label>
        </>
      )}

      <div className="form-actions">
        <button type="button" className="btn-cancel" onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="submit" className="btn-save" disabled={saving || !title.trim()}>{saving ? 'Saving…' : 'Save'}</button>
      </div>
    </form>
  );
}
