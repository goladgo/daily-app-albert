'use client';

import { formatTime } from '@/lib/weekUtils';

const CATEGORY_LABELS = {
  music: 'Music',
  sports: 'Sports',
  outdoors: 'Outdoors',
  general: 'Local',
};

export default function EventRow({ ev, catClass, onToggleLocal, onDeleteLocal, onEditGoogle, onDismissEvent }) {
  const time = ev.allDay ? 'All day' : formatTime(ev.start) || 'Anytime';
  const isLocal = ev.source === 'local';
  const isEvent = ev.source === 'event';
  const isEditableGoogle = ev.source === 'google' && typeof onEditGoogle === 'function';
  const categoryLabel = isEvent && ev.category ? (CATEGORY_LABELS[ev.category] || ev.category) : null;

  return (
    <div
      className={`row event-row ${catClass} ${isEditableGoogle ? 'editable' : ''}`}
      onClick={isEditableGoogle ? () => onEditGoogle(ev) : undefined}
    >
      {isLocal ? (
        <button className="row-check" onClick={() => onToggleLocal(ev.localId, false)}></button>
      ) : (
        <span className="source-dot" title={ev.source} />
      )}
      <div className="row-body">
        <div className="row-title">
          {isLocal && ev.isReminder && <span className="badge badge-reminder">Reminder</span>}
          {categoryLabel && <span className={`badge badge-${ev.category}`}>{categoryLabel}</span>}
          {isEvent && ev.url ? (
            <a href={ev.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
              {ev.title}
            </a>
          ) : (
            ev.title
          )}
        </div>
        <div className="row-meta">{time}</div>
        {ev.notes && <div className="row-meta">{ev.notes}</div>}
      </div>
      {isLocal && (
        <div className="row-actions">
          <button className="icon-btn" onClick={(e) => { e.stopPropagation(); onDeleteLocal(ev.localId); }}>×</button>
        </div>
      )}
      {isEvent && typeof onDismissEvent === 'function' && (
        <div className="row-actions">
          <button className="icon-btn" title="Not interested" onClick={(e) => { e.stopPropagation(); onDismissEvent(ev.localId); }}>×</button>
        </div>
      )}
    </div>
  );
}
