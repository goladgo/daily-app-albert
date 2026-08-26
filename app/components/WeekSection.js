'use client';

import EventRow from './EventRow';

export default function WeekSection({ title, buckets, connected, connectHref, providerName,
  catClass, onToggleLocal, onDeleteLocal, onEditGoogle }) {
  return (
    <div className="section">
      <div className="section-title">{title}</div>
      {connected === false && (
        <div className="card connect-card">
          <div>Connect {providerName} to see it here.</div>
          <a className="connect-btn" href={connectHref}>Connect {providerName}</a>
        </div>
      )}
      <div className="card week-card">
        {buckets.map((day) => (
          <div className={`day-group ${day.isToday ? 'day-today' : ''}`} key={day.key}>
            <div className="day-label">{day.label}{day.isToday ? ' · Today' : ''}</div>
            {day.timed.length === 0 && day.anytime.length === 0 && (
              <div className="day-empty">—</div>
            )}
            {day.anytime.map((ev) => (
              <EventRow key={ev.id} ev={ev} catClass={catClass} onToggleLocal={onToggleLocal} onDeleteLocal={onDeleteLocal} onEditGoogle={onEditGoogle} />
            ))}
            {day.timed.map((ev) => (
              <EventRow key={ev.id} ev={ev} catClass={catClass} onToggleLocal={onToggleLocal} onDeleteLocal={onDeleteLocal} onEditGoogle={onEditGoogle} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
