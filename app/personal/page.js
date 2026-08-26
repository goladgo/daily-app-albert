'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { weekBounds, buildDayBuckets, bucketize } from '@/lib/weekUtils';
import WeekSection from '../components/WeekSection';
import BottomNav from '../components/BottomNav';
import GoogleEventModal from '../components/GoogleEventModal';

export default function PersonalPage() {
  const router = useRouter();
  const [personalEvents, setPersonalEvents] = useState([]);
  const [googleConnected, setGoogleConnected] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);

  const loadWeek = useCallback(async () => {
    const { from, to } = weekBounds();
    const data = await fetch(`/api/calendar/week?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`).then((r) => r.json());
    setPersonalEvents(Array.isArray(data.personal) ? data.personal : []);
    setGoogleConnected(!!data.googleConnected);
  }, []);

  useEffect(() => {
    loadWeek();
  }, [loadWeek]);

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

  function openNewEventModal() {
    setEditingEvent(null);
    setModalOpen(true);
  }

  function openEditEventModal(ev) {
    const rawId = ev.id.startsWith('google_') ? ev.id.slice('google_'.length) : ev.id;
    setEditingEvent({ ...ev, rawId });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingEvent(null);
  }

  async function saveEvent({ title, start, allDay }) {
    if (editingEvent) {
      await fetch(`/api/calendar/google/${editingEvent.rawId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, start, allDay }),
      });
    } else {
      await fetch('/api/calendar/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, start, allDay }),
      });
    }
    closeModal();
    loadWeek();
  }

  async function deleteEvent() {
    if (!editingEvent) return;
    await fetch(`/api/calendar/google/${editingEvent.rawId}`, { method: 'DELETE' });
    closeModal();
    loadWeek();
  }

  const { monday } = weekBounds();
  const dayBuckets = buildDayBuckets(monday);
  const personalBuckets = bucketize(personalEvents, dayBuckets);

  return (
    <div className="page">
      <div className="header">
        <div>
          <h1>Personal</h1>
          <div className="date">Google calendar &amp; personal tasks</div>
        </div>
        <button className="logout-btn" onClick={logout}>Log out</button>
      </div>

      {googleConnected && (
        <button className="add-toggle" onClick={openNewEventModal}>+ New event</button>
      )}

      <WeekSection
        title="Personal Week"
        buckets={personalBuckets}
        connected={googleConnected}
        connectHref="/api/auth/google/start"
        providerName="Google Calendar"
        catClass="cat-personal"
        onToggleLocal={toggleLocal}
        onDeleteLocal={deleteLocal}
        onEditGoogle={openEditEventModal}
      />

      {modalOpen && (
        <GoogleEventModal
          event={editingEvent}
          onClose={closeModal}
          onSave={saveEvent}
          onDelete={deleteEvent}
        />
      )}

      <BottomNav />
    </div>
  );
}
