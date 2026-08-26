'use client';

import { formatTime } from '@/lib/weekUtils';

export default function EventRow({ ev, catClass, onToggleLocal, onDeleteLocal, onEditGoogle }) {
  const time = ev.allDay ? 'All day' : formatTime(ev.start) || 'Anytime';
  const isLocal = ev.source === 'local';
  const isEditableGoogle = ev.source === 'google' && typeof onEditGoogle === 'function';
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
          {ev.title}
        </div>
        <div className="row-meta">{time}</div>
        {ev.notes && <div className="row-meta">{ev.notes}</div>}
      </div>
      {isLocal && (
        <div className="row-actions">
          <button className="icon-btn" onClick={(e) => { e.stopPropagation(); onDeleteLocal(ev.localId); }}>×</button>
        </div>
      )}
    </div>
  );
}
