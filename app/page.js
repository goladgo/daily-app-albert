'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { weekBounds, buildDayBuckets, bucketize, urlBase64ToUint8Array } from '@/lib/weekUtils';
import HybridWeek from './components/HybridWeek';
import BottomNav from './components/BottomNav';
import MicButton from './components/MicButton';

function todayStrLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function DashboardPage() {
  const router = useRouter();
  const date = todayStrLocal();

  const [workEvents, setWorkEvents] = useState([]);
  const [personalEvents, setPersonalEvents] = useState([]);
  const [calendarBanner, setCalendarBanner] = useState(null);

  const [grocery, setGrocery] = useState([]);
  const [braindump, setBraindump] = useState([]);
  const [capture, setCapture] = useState('');
  const [groceryInput, setGroceryInput] = useState('');
  const [showAddSchedule, setShowAddSchedule] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('personal');
  const [newTime, setNewTime] = useState('');
  const [newReminder, setNewReminder] = useState(false);

  const [notifSupported, setNotifSupported] = useState(false);
  const [notifPermission, setNotifPermission] = useState('default');
  const [notifBusy, setNotifBusy] = useState(false);

  const loadWeek = useCallback(async () => {
    const { from, to } = weekBounds();
    const data = await fetch(`/api/calendar/week?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`).then((r) => r.json());
    setWorkEvents(Array.isArray(data.work) ? data.work : []);
    setPersonalEvents(Array.isArray(data.personal) ? data.personal : []);
  }, []);

  const loadRest = useCallback(async () => {
    const [g, b] = await Promise.all([
      fetch('/api/grocery').then((r) => r.json()),
      fetch('/api/braindump').then((r) => r.json()),
    ]);
    setGrocery(Array.isArray(g) ? g : []);
    setBraindump(Array.isArray(b) ? b : []);
  }, []);

  useEffect(() => {
    loadWeek();
    loadRest();
  }, [loadWeek, loadRest]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('calendar_connected');
    const error = params.get('calendar_error');
    if (connected) setCalendarBanner({ type: 'ok', text: `${connected === 'google' ? 'Google' : 'Outlook'} Calendar connected.` });
    if (error) setCalendarBanner({ type: 'error', text: `Couldn't connect ${error === 'google' ? 'Google' : 'Outlook'} Calendar. Try again.` });
    if (connected || error) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setNotifSupported(supported);
    if (supported) {
      setNotifPermission(Notification.permission);
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  async function enableNotifications() {
    setNotifBusy(true);
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      const permission = await Notification.requestPermission();
      setNotifPermission(permission);
      if (permission !== 'granted') {
        setNotifBusy(false);
        return;
      }
      const { key } = await fetch('/api/push/vapid-public-key').then((r) => r.json());
      if (!key) {
        setNotifBusy(false);
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      });
    } catch (err) {
      // best-effort
    }
    setNotifBusy(false);
  }

  async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  async function addCapture(e) {
    e.preventDefault();
    if (!capture.trim()) return;
    const text = capture.trim();
    setCapture('');
    const item = await fetch('/api/braindump', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: text }),
    }).then((r) => r.json());
    setBraindump((prev) => [...prev, item]);
  }

  async function deleteBraindump(id) {
    setBraindump((prev) => prev.filter((i) => i.id !== id));
    await fetch(`/api/braindump/${id}`, { method: 'DELETE' });
  }

  async function convertBraindump(item) {
    setBraindump((prev) => prev.filter((i) => i.id !== item.id));
    await fetch('/api/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: item.content, category: 'personal' }),
    });
    await fetch(`/api/braindump/${item.id}`, { method: 'DELETE' });
    loadWeek();
  }

  async function toggleLocal(localId, completed) {
    await fetch(`/api/schedule/${localId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: !completed }),
    });
    loadWeek();
  }

  async function deleteLocal(localId) {
    await fetch(`/api/schedule/${localId}`, { method: 'DELETE' });
    loadWeek();
  }

  async function addSchedule(e) {
    e.preventDefault();
    if (!newTitle.trim()) return;

    let start_time = null;
    if (newTime) {
      const [year, month, day] = date.split('-').map(Number);
      const [hh, mm] = newTime.split(':').map(Number);
      start_time = new Date(year, month - 1, day, hh, mm, 0).toISOString();
    }

    await fetch('/api/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newTitle.trim(),
        category: newCategory,
        is_reminder: newReminder,
        start_time,
      }),
    });
    setNewTitle('');
    setNewTime('');
    setNewReminder(false);
    setShowAddSchedule(false);
    loadWeek();
  }

  async function addGrocery(e) {
    e.preventDefault();
    if (!groceryInput.trim()) return;
    const text = groceryInput.trim();
    setGroceryInput('');
    const item = await fetch('/api/grocery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: text }),
    }).then((r) => r.json());
    setGrocery((prev) => [...prev, item]);
  }

  async function toggleGrocery(item) {
    setGrocery((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, checked: !i.checked } : i))
    );
    await fetch(`/api/grocery/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checked: !item.checked }),
    });
  }

  async function deleteGrocery(id) {
    setGrocery((prev) => prev.filter((i) => i.id !== id));
    await fetch(`/api/grocery/${id}`, { method: 'DELETE' });
  }

  async function clearChecked() {
    const toRemove = grocery.filter((i) => i.checked);
    setGrocery((prev) => prev.filter((i) => !i.checked));
    await Promise.all(
      toRemove.map((i) => fetch(`/api/grocery/${i.id}`, { method: 'DELETE' }))
    );
  }

  const { monday } = weekBounds();
  const dayBuckets = buildDayBuckets(monday);
  const workBuckets = bucketize(workEvents, dayBuckets);
  const personalBuckets = bucketize(personalEvents, dayBuckets);

  return (
    <div className="page">
      <div className="header">
        <div>
          <h1>Today</h1>
          <div className="date">
            {new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
        </div>
        <button className="logout-btn" onClick={logout}>Log out</button>
      </div>

      {notifSupported && notifPermission === 'default' && (
        <div className="notif-banner">
          <div>Get reminders as push notifications, even when the app is closed.</div>
          <button onClick={enableNotifications} disabled={notifBusy}>
            {notifBusy ? 'Enabling…' : 'Enable'}
          </button>
        </div>
      )}

      {calendarBanner && (
        <div className={`notif-banner ${calendarBanner.type === 'error' ? 'banner-error' : ''}`}>
          <div>{calendarBanner.text}</div>
        </div>
      )}

      <form className="quick-capture" onSubmit={addCapture}>
        <input
          type="text"
          placeholder="Quick capture — jot it down before you lose it"
          value={capture}
          onChange={(e) => setCapture(e.target.value)}
        />
        <MicButton onResult={(text) => setCapture((prev) => (prev ? `${prev} ${text}` : text))} />
        <button type="submit">Add</button>
      </form>

      {braindump.length > 0 && (
        <div className="section">
          <div className="section-title">Brain Dump</div>
          <div className="card">
            {braindump.map((item) => (
              <div className="row" key={item.id}>
                <div className="row-body">
                  <div className="row-title">{item.content}</div>
                </div>
                <div className="row-actions">
                  <button className="icon-btn" title="Move to schedule" onClick={() => convertBraindump(item)}>→</button>
                  <button className="icon-btn" title="Delete" onClick={() => deleteBraindump(item.id)}>×</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="section">
        <div className="section-title">Tasks &amp; Schedule</div>

        {!showAddSchedule && (
          <button className="add-toggle" onClick={() => setShowAddSchedule(true)}>
            + Add a task or reminder
          </button>
        )}

        {showAddSchedule && (
          <form className="add-form" onSubmit={addSchedule}>
            <div className="row-inline">
              <input
                type="text"
                placeholder="What is it?"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                autoFocus
              />
              <MicButton onResult={(text) => setNewTitle((prev) => (prev ? `${prev} ${text}` : text))} />
            </div>
            <div className="row-inline">
              <input
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
              />
            </div>
            <div className="pill-group">
              <div
                className={`pill ${newCategory === 'work' ? 'active work' : ''}`}
                onClick={() => setNewCategory('work')}
              >
                Work
              </div>
              <div
                className={`pill ${newCategory === 'personal' ? 'active personal' : ''}`}
                onClick={() => setNewCategory('personal')}
              >
                Personal
              </div>
            </div>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={newReminder}
                onChange={(e) => setNewReminder(e.target.checked)}
              />
              This is a reminder
            </label>
            <div className="form-actions">
              <button type="button" className="btn-cancel" onClick={() => setShowAddSchedule(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-save">Save</button>
            </div>
          </form>
        )}

        <HybridWeek
          dayBuckets={dayBuckets}
          workBuckets={workBuckets}
          personalBuckets={personalBuckets}
          onToggleLocal={toggleLocal}
          onDeleteLocal={deleteLocal}
        />
      </div>

      <div className="section">
        <div className="section-title">Groceries</div>
        <form className="quick-capture" onSubmit={addGrocery}>
          <input
            type="text"
            placeholder="Add a grocery item"
            value={groceryInput}
            onChange={(e) => setGroceryInput(e.target.value)}
          />
          <MicButton onResult={(text) => setGroceryInput((prev) => (prev ? `${prev} ${text}` : text))} />
          <button type="submit">Add</button>
        </form>
        <div className="card">
          {grocery.length === 0 && <div className="empty-hint">List is empty.</div>}
          {grocery.map((item) => (
            <div className="row" key={item.id}>
              <button
                className={`row-check ${item.checked ? 'checked' : ''}`}
                onClick={() => toggleGrocery(item)}
              >
                {item.checked ? '✓' : ''}
              </button>
              <div className="row-body">
                <div className={`row-title ${item.checked ? 'done' : ''}`}>{item.name}</div>
              </div>
              <div className="row-actions">
                <button className="icon-btn" onClick={() => deleteGrocery(item.id)}>×</button>
              </div>
            </div>
          ))}
        </div>
        {grocery.some((i) => i.checked) && (
          <button className="clear-btn" onClick={clearChecked}>Clear checked items</button>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
