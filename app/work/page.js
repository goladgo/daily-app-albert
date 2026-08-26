'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { weekBounds, buildDayBuckets, bucketize } from '@/lib/weekUtils';
import WeekSection from '../components/WeekSection';
import BottomNav from '../components/BottomNav';

export default function WorkPage() {
  const router = useRouter();
  const [workEvents, setWorkEvents] = useState([]);
  const [outlookConnected, setOutlookConnected] = useState(null);
  const [inbox, setInbox] = useState([]);
  const [flagged, setFlagged] = useState([]);

  const loadWeek = useCallback(async () => {
    const { from, to } = weekBounds();
    const data = await fetch(`/api/calendar/week?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`).then((r) => r.json());
    setWorkEvents(Array.isArray(data.work) ? data.work : []);
    setOutlookConnected(!!data.outlookConnected);
  }, []);

  const loadInbox = useCallback(async () => {
    const i = await fetch('/api/inbox').then((r) => r.json());
    setInbox(Array.isArray(i) ? i : []);
  }, []);

  const loadFlagged = useCallback(async () => {
    const f = await fetch('/api/flagged').then((r) => r.json());
    setFlagged(Array.isArray(f) ? f : []);
  }, []);

  useEffect(() => {
    loadWeek();
    loadInbox();
    loadFlagged();
  }, [loadWeek, loadInbox, loadFlagged]);

  async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
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

  async function dismissInboxItem(id) {
    setInbox((prev) => prev.filter((i) => i.id !== id));
    await fetch(`/api/inbox/${id}`, { method: 'DELETE' });
  }

  async function convertInboxItem(item) {
    setInbox((prev) => prev.filter((i) => i.id !== item.id));
    await fetch('/api/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: item.subject || item.summary, category: 'work' }),
    });
    await fetch(`/api/inbox/${item.id}`, { method: 'DELETE' });
    loadWeek();
  }

  async function dismissFlagged(id) {
    setFlagged((prev) => prev.filter((i) => i.id !== id));
    await fetch(`/api/flagged/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  const { monday } = weekBounds();
  const dayBuckets = buildDayBuckets(monday);
  const workBuckets = bucketize(workEvents, dayBuckets);

  return (
    <div className="page">
      <div className="header">
        <div>
          <h1>Work</h1>
          <div className="date">Outlook calendar &amp; work tasks</div>
        </div>
        <button className="logout-btn" onClick={logout}>Log out</button>
      </div>

      {flagged.length > 0 && (
        <div className="section">
          <div className="section-title">Flagged</div>
          <div className={`card ${flagged.length > 5 ? 'scroll-card' : ''}`}>
            {flagged.map((item) => (
              <div className="row" key={item.id}>
                <span className="flag-icon">⚑</span>
                <div className="row-body">
                  <div className="row-title">{item.subject || '(no subject)'}</div>
                  <div className="row-meta">{item.sender ? `From ${item.sender}` : ''}</div>
                  <div className="row-meta">{item.summary}</div>
                </div>
                <div className="row-actions">
                  <button className="icon-btn" title="Dismiss" onClick={() => dismissFlagged(item.id)}>×</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {inbox.length > 0 && (
        <div className="section">
          <div className="section-title">Inbox</div>
          <div className={`card ${inbox.length > 5 ? 'scroll-card' : ''}`}>
            {inbox.map((item) => (
              <div className="row" key={item.id}>
                <span className="flag-icon">✉</span>
                <div className="row-body">
                  <div className="row-title">{item.subject || '(no subject)'}</div>
                  <div className="row-meta">{item.sender ? `From ${item.sender}` : ''}</div>
                  <div className="row-meta">{item.summary}</div>
                </div>
                <div className="row-actions">
                  <button className="icon-btn" title="Move to schedule" onClick={() => convertInboxItem(item)}>→</button>
                  <button className="icon-btn" title="Dismiss" onClick={() => dismissInboxItem(item.id)}>×</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <WeekSection
        title="Work Week"
        buckets={workBuckets}
        connected={outlookConnected}
        connectHref="/api/auth/outlook/start"
        providerName="Outlook Calendar"
        catClass="cat-work"
        onToggleLocal={toggleLocal}
        onDeleteLocal={deleteLocal}
      />

      <BottomNav />
    </div>
  );
}
