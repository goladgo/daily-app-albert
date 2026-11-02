'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { weekBounds, buildDayBuckets, bucketize, urlBase64ToUint8Array } from '@/lib/weekUtils';
import CombinedWeek from './components/CombinedWeek';
import BriefSection from './components/BriefSection';
import AddItemForm from './components/AddItemForm';
import GoogleEventModal from './components/GoogleEventModal';
import BottomNav from './components/BottomNav';
import MicButton from './components/MicButton';
import './home.css';

export default function DashboardPage() {
  const router = useRouter();

  const [workEvents, setWorkEvents] = useState([]);
  const [personalEvents, setPersonalEvents] = useState([]);
  const [localEvents, setLocalEvents] = useState([]);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [calendarBanner, setCalendarBanner] = useState(null);
  const [brief, setBrief] = useState(null);

  const [grocery, setGrocery] = useState([]);
  const [braindump, setBraindump] = useState([]);
  const [capture, setCapture] = useState('');
  const [groceryInput, setGroceryInput] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editingGoogle, setEditingGoogle] = useState(null);

  const [notifSupported, setNotifSupported] = useState(false);
  const [notifPermission, setNotifPermission] = useState('default');
  const [notifBusy, setNotifBusy] = useState(false);

  const loadWeek = useCallback(async () => {
    const { from, to } = weekBounds();
    const data = await fetch(`/api/calendar/week?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`).then((r) => r.json());
    setWorkEvents(Array.isArray(data.work) ? data.work : []);
    setPersonalEvents(Array.isArray(data.personal) ? data.personal : []);
    setGoogleConnected(!!data.googleConnected);
  }, []);

  const loadLocalEvents = useCallback(async () => {
    const { from, to } = weekBounds();
    const data = await fetch(`/api/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`).then((r) => r.json());
    const items = Array.isArray(data) ? data : [];
    setLocalEvents(
      items.map((row) => ({
        id: `event_${row.id}`,
        localId: row.id,
        title: row.title,
        notes: row.venue || null,
        start: row.start_time,
        allDay: row.all_day,
        source: 'event',
        category: row.category,
        url: row.url,
      }))
    );
  }, []);

  const loadBrief = useCallback(async () => {
    try {
      const b = await fetch('/api/brief').then((r) => r.json());
      setBrief(b);
    } catch (e) {}
  }, []);

  const loadRest = useCallback(async () => {
    const [g, b] = await Promise.all([
      fetch('/api/grocery').then((r) => r.json()),
      fetch('/api/braindump').then((r) => r.json()),
    ]);
    setGrocery(Array.isArray(g) ? g : []);
    setBraindump(Array.isArray(b) ? b : []);
  }, []);

  const loadAll = useCallback(() => {
    loadBrief();
    loadWeek();
    loadLocalEvents();
    loadRest();
  }, [loadBrief, loadWeek, loadLocalEvents, loadRest]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Refresh when the app regains focus so the morning open is always current.
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === 'visible') loadAll();
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [loadAll]);

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

  // Remove a Local Event (soft-dismiss).
  async function dismissEvent(localId) {
    setLocalEvents((prev) => prev.filter((e) => e.localId !== localId));
    await fetch(`/api/events/${localId}`, { method: 'DELETE' });
  }

  // Outlook is read-only in this app, so "remove" hides it from Home only.
  async function hideOutlookEvent(ev) {
    setWorkEvents((prev) => prev.filter((e) => e.id !== ev.id));
    await fetch('/api/calendar/hide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: ev.id }),
    });
  }

  async function handleAdd({ type, title, date, time, allDay, category, reminder, venue }) {
    const [y, m, d] = (date || '').split('-').map(Number);
    const startIso = () => {
      if (allDay || !time) return new Date(y, m - 1, d, 0, 0, 0).toISOString();
      const [hh, mm] = time.split(':').map(Number);
      return new Date(y, m - 1, d, hh, mm, 0).toISOString();
    };

    if (type === 'task') {
      let start_time = null;
      if (time) {
        const now = new Date();
        const [hh, mm] = time.split(':').map(Number);
        start_time = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0).toISOString();
      }
      await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, category, is_reminder: reminder, start_time }),
      });
      await loadWeek();
    } else if (type === 'google') {
      const start = allDay || !time ? date : startIso();
      await fetch('/api/calendar/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, start, allDay: allDay || !time }),
      });
      await loadWeek();
    } else {
      await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, start: startIso(), allDay: allDay || !time, venue: venue || null }),
      });
      await loadLocalEvents();
    }
    setShowAdd(false);
  }

  function openEditGoogle(ev) {
    const rawId = ev.id.startsWith('google_') ? ev.id.slice('google_'.length) : ev.id;
    setEditingGoogle({ ...ev, rawId });
  }

  async function saveGoogle({ title, start, allDay }) {
    await fetch(`/api/calendar/google/${editingGoogle.rawId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, start, allDay }),
    });
    setEditingGoogle(null);
    loadWeek();
  }

  async function deleteGoogle() {
    await fetch(`/api/calendar/google/${editingGoogle.rawId}`, { method: 'DELETE' });
    setEditingGoogle(null);
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
  const localBuckets = bucketize(localEvents, dayBuckets);

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

      {/* 1. Quick Capture (+ Brain Dump) */}
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

      {/* 2. Water quality + local news */}
      <BriefSection brief={brief} />

      {/* 3. Combined calendar */}
      <div className="section">
        <div className="section-title">Schedule</div>

        {!showAdd && (
          <button className="add-toggle" onClick={() => setShowAdd(true)}>
            + Add a task, reminder, or event
          </button>
        )}
        {showAdd && (
          <AddItemForm googleConnected={googleConnected} onAdd={handleAdd} onCancel={() => setShowAdd(false)} />
        )}

        <CombinedWeek
          dayBuckets={dayBuckets}
          workBuckets={workBuckets}
          personalBuckets={personalBuckets}
          localBuckets={localBuckets}
          onToggleLocal={toggleLocal}
          onDeleteLocal={deleteLocal}
          onEditGoogle={openEditGoogle}
          onDismissEvent={dismissEvent}
          onHideEvent={hideOutlookEvent}
        />
      </div>

      {/* 4. Groceries */}
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

      {editingGoogle && (
        <GoogleEventModal
          event={editingGoogle}
          onClose={() => setEditingGoogle(null)}
          onSave={saveGoogle}
          onDelete={deleteGoogle}
        />
      )}

      <BottomNav />
    </div>
  );
}
