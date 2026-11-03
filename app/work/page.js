'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { weekBounds, buildDayBuckets, bucketize } from '@/lib/weekUtils';
import WeekSection from '../components/WeekSection';
import BottomNav from '../components/BottomNav';

// Age of a task: short text plus a color that warms as it goes stale
// (<24h normal, 24-48h amber, >48h red).
function taskAge(iso) {
  if (!iso) return null;
  const hours = (Date.now() - new Date(iso).getTime()) / 36e5;
  if (Number.isNaN(hours)) return null;
  const text = hours < 1 ? 'just now' : hours < 24 ? `${Math.floor(hours)}h ago` : `${Math.floor(hours / 24)}d ago`;
  const level = hours >= 48 ? 'red' : hours >= 24 ? 'amber' : 'normal';
  return { text, level };
}

const AGE_BADGE = {
  normal: null,
  amber: { background: 'rgba(245, 158, 11, 0.15)', color: 'var(--reminder)' },
  red: { background: 'rgba(239, 68, 68, 0.15)', color: 'var(--danger)' },
};

const CLAMP = { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' };

export default function WorkPage() {
  const router = useRouter();
  const [workEvents, setWorkEvents] = useState([]);
  const [outlookConnected, setOutlookConnected] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [expanded, setExpanded] = useState({});

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
          {tasks.map((t) => {
            const age = taskAge(t.received_at);
            const isOpen = !!expanded[t.id];
            return (
              <div className="row" key={t.id}>
                <button className="row-check" title="Done" onClick={() => completeTask(t.id)}></button>
                <div
                  className="row-body"
                  style={{ cursor: t.summary ? 'pointer' : undefined }}
                  onClick={() => setExpanded((prev) => ({ ...prev, [t.id]: !prev[t.id] }))}
                >
                  <div className="row-title">
                    <span className="badge badge-sports" style={age ? AGE_BADGE[age.level] || undefined : undefined}>{t.label}</span>
                    {t.link ? (
                      <a href={t.link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>{t.title}</a>
                    ) : t.title}
                  </div>
                  <div className="row-meta">
                    {[age ? age.text : null, t.sender, t.project, t.due ? `Due ${t.due}` : null].filter(Boolean).join(' · ')}
                  </div>
                  {t.summary && (
                    <div className="row-meta" style={isOpen ? undefined : CLAMP}>{t.summary}</div>
                  )}
                </div>
                <div className="row-actions">
                  <button className="icon-btn" title="Not needed" onClick={() => dismissTask(t.id)}>×</button>
                </div>
              </div>
            );
          })}
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
