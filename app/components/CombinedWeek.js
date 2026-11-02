'use client';

import { useState } from 'react';
import EventRow from './EventRow';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'work', label: 'Work' },
  { key: 'personal', label: 'Personal' },
  { key: 'local', label: 'Local' },
];

// One merged rolling week: Outlook + Google + tasks + Local Events.
export default function CombinedWeek({
  dayBuckets, workBuckets, personalBuckets, localBuckets,
  onToggleLocal, onDeleteLocal, onEditGoogle, onDismissEvent, onHideEvent,
}) {
  const [filter, setFilter] = useState('all');

  return (
    <>
      <div className="filter-chips">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`chip ${filter === f.key ? 'active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="card week-card">
        {dayBuckets.map((day, i) => {
          const groups = [];
          if (filter === 'all' || filter === 'work') groups.push({ b: workBuckets[i], cls: 'cat-work' });
          if (filter === 'all' || filter === 'personal') groups.push({ b: personalBuckets[i], cls: 'cat-personal' });
          if (filter === 'all' || filter === 'local') groups.push({ b: localBuckets[i], cls: 'cat-local' });

          const anytime = groups.flatMap((g) => g.b.anytime.map((ev) => ({ ev, cls: g.cls })));
          const timed = groups
            .flatMap((g) => g.b.timed.map((ev) => ({ ev, cls: g.cls })))
            .sort((a, c) => new Date(a.ev.start) - new Date(c.ev.start));
          const rows = [...anytime, ...timed];

          return (
            <div className={`day-group ${day.isToday ? 'day-today' : ''}`} key={day.key}>
              <div className="day-label">{day.label}{day.isToday ? ' · Today' : ''}</div>
              {rows.length === 0 && <div className="day-empty">—</div>}
              {rows.map(({ ev, cls }) => (
                <EventRow
                  key={ev.id}
                  ev={ev}
                  catClass={cls}
                  onToggleLocal={onToggleLocal}
                  onDeleteLocal={onDeleteLocal}
                  onEditGoogle={onEditGoogle}
                  onDismissEvent={onDismissEvent}
                  onHideEvent={onHideEvent}
                />
              ))}
            </div>
          );
        })}
      </div>
    </>
  );
}
