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
  const [tasks, setTasks] = useState([]);

  const loadWeek = useCallback(async () => {
    const { from, to } = weekBounds();
    const data = await fetch(`/api/calendar/week?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`).then((r) => r.json());
    setWorkEvents(Array.isArray(data.work) ? data.work : []);
    setOutlookConnected(!!data.outlookConnected);
  }, []);

  const loadTasks = useCallback(async () => {
    const t = await fetch('/api/work-tasks').then((r) => r.json()).catch(() => []);
    setTasks(Array.isArray(t) ? t : []);
  }, []);

  useEffect(() => {
    loadWeek();
    loadTasks();
  }, [loadWeek, loadTasks]);

  // Scanner runs 8am and noon M-F; refetch on focus and hourly.
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === 'visible') loadTasks();
    }
    document.addEventListener('visibilitychange', handleVisibility);
    const timer = setInterval(loadTasks, 60 * 60 * 1000);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(timer);
    };
  }, [loadTasks]);

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

  async function completeTask(id) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await fetch(`/api/work-tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done: true }),
    });
  }

  async function dismissTask(id) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await fetch(`/api/work-tasks/${id}`, { method: 'DELETE' });
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

      <div className="section">
        <div className="section-title">Work Tasks</div>
        <div className={`card ${tasks.length > 5 ? 'scroll-card' : ''}`}>
          {tasks.length === 0 && <div className="empty-hint">No open work tasks.</div>}
          {tasks.map((t) => (
            <div className="row" key={t.id}>
              <button className="row-check" title="Done" onClick={() => completeTask(t.id)}></button>
              <div className="row-body">
                <div className="row-title">
                  <span className="badge badge-sports">{t.label}</span>
                  {t.link ? (
                    <a href={t.link} target="_blank" rel="noopener noreferrer">{t.title}</a>
                  ) : t.title}
                </div>
                <div className="row-meta">
                  {[t.sender, t.project, t.due ? `Due ${t.due}` : null].filter(Boolean).join(' · ')}
                </div>
                {t.summary && <div className="row-meta">{t.summary}</div>}
              </div>
              <div className="row-actions">
                <button className="icon-btn" title="Not needed" onClick={() => dismissTask(t.id)}>×</button>
              </div>
            </div>
          ))}
        </div>
      </div>

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
