export function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function weekBounds() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return { from: start.toISOString(), to: end.toISOString(), monday: start };
}

export function buildDayBuckets(monday) {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push({
      key: d.toDateString(),
      isToday: d.toDateString() === new Date().toDateString(),
      label: d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }),
    });
  }
  return days;
}

export function bucketize(events, dayBuckets) {
  const buckets = dayBuckets.map((d) => ({ ...d, timed: [], anytime: [] }));
  const byKey = Object.fromEntries(buckets.map((b) => [b.key, b]));
  const todayKey = new Date().toDateString();

  for (const ev of events) {
    if (!ev.start) {
      const target = byKey[todayKey] || buckets[0];
      target.anytime.push(ev);
      continue;
    }

    let bucketKey;
    if (ev.allDay && typeof ev.start === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(ev.start)) {
      const [y, m, dd] = ev.start.split('-').map(Number);
      bucketKey = new Date(y, m - 1, dd).toDateString();
    } else {
      bucketKey = new Date(ev.start).toDateString();
    }

    let target = byKey[bucketKey];
    if (!target) {
      const evTime = new Date(ev.start).getTime();
      const windowStart = new Date(dayBuckets[0].key).getTime();
      if (!Number.isNaN(evTime) && evTime < windowStart) {
        target = byKey[todayKey] || buckets[0];
      } else {
        continue;
      }
    }
    if (ev.allDay) target.anytime.push(ev);
    else target.timed.push(ev);
  }

  buckets.forEach((b) => b.timed.sort((a, c) => new Date(a.start) - new Date(c.start)));
  return buckets;
}

export function formatTime(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
