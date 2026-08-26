'use client';

import EventRow from './EventRow';

export default function HybridWeek({ dayBuckets, workBuckets, personalBuckets, onToggleLocal, onDeleteLocal, onEditGoogle }) {
  return (
    <div className="card week-card">
      {dayBuckets.map((day, i) => {
        const work = workBuckets[i];
        const personal = personalBuckets[i];
        const isEmpty =
          work.timed.length === 0 &&
          work.anytime.length === 0 &&
          personal.timed.length === 0 &&
          personal.anytime.length === 0;
        return (
          <div className={`day-group ${day.isToday ? 'day-today' : ''}`} key={day.key}>
            <div className="day-label">{day.label}{day.isToday ? ' · Today' : ''}</div>
            {isEmpty && <div className="day-empty">—</div>}
            {work.anytime.map((ev) => (
              <EventRow key={ev.id} ev={ev} catClass="cat-work" onToggleLocal={onToggleLocal} onDeleteLocal={onDeleteLocal} />
            ))}
            {work.timed.map((ev) => (
              <EventRow key={ev.id} ev={ev} catClass="cat-work" onToggleLocal={onToggleLocal} onDeleteLocal={onDeleteLocal} />
            ))}
            {personal.anytime.map((ev) => (
              <EventRow key={ev.id} ev={ev} catClass="cat-personal" onToggleLocal={onToggleLocal} onDeleteLocal={onDeleteLocal} onEditGoogle={onEditGoogle} />
            ))}
            {personal.timed.map((ev) => (
              <EventRow key={ev.id} ev={ev} catClass="cat-personal" onToggleLocal={onToggleLocal} onDeleteLocal={onDeleteLocal} onEditGoogle={onEditGoogle} />
            ))}
          </div>
        );
      })}
    </div>
  );
}
