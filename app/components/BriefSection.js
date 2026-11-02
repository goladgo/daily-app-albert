'use client';

const STATUS_LABEL = { good: 'Good', advisory: 'Advisory', closed: 'Warning / closed', unknown: 'No data' };
const CAT_LABEL = { crime: 'Crime', business: 'New business', events: 'Events', warning: 'Warning', other: 'News' };

function Beach({ name, info }) {
  const s = info?.status || 'unknown';
  return (
    <div className={`water-tile water-${s}`}>
      <div className="water-name">{name}</div>
      <div className="water-status">{STATUS_LABEL[s]}</div>
      {info?.detail && <div className="water-detail">{info.detail}</div>}
      {info?.testedOn && <div className="water-detail">Tested {info.testedOn}</div>}
    </div>
  );
}

function updatedLabel(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  const t = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return today ? `Updated ${t}` : `Updated ${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${t}`;
}

export default function BriefSection({ brief }) {
  const data = brief?.data;
  const stale = brief?.updatedAt && new Date().toDateString() !== new Date(brief.updatedAt).toDateString();

  return (
    <div className="section">
      <div className="section-title brief-title">
        <span>Morning Brief</span>
        {brief?.updatedAt && <span className={`brief-updated ${stale ? 'stale' : ''}`}>{updatedLabel(brief.updatedAt)}</span>}
      </div>

      {!data && <div className="card"><div className="empty-hint">Brief hasn’t been posted yet.</div></div>}

      {data && (
        <>
          <div className="water-grid">
            <Beach name="Cabrillo Inner" info={data.water?.inner} />
            <Beach name="Cabrillo Outer" info={data.water?.outer} />
          </div>
          {data.water?.advisory && <div className="water-note">{data.water.advisory}</div>}
          {(data.water?.inner?.status !== 'good' && data.water?.inner?.status !== 'advisory' && data.water?.inner?.status !== 'closed') ||
           (data.water?.outer?.status !== 'good' && data.water?.outer?.status !== 'advisory' && data.water?.outer?.status !== 'closed') ? (
            <div className="water-links">
              Not verified today ·{' '}
              <a href="tel:18005255662">Call county beach hotline</a> ·{' '}
              <a href="https://www.google.com/search?q=Cabrillo+Beach+water+quality+today" target="_blank" rel="noopener noreferrer">Check online</a>
            </div>
          ) : null}

          <div className="card brief-news">
            {(!data.news || data.news.length === 0) && <div className="empty-hint">No notable local news today.</div>}
            {(data.news || []).map((n, i) => (
              <div className="row" key={i}>
                <div className="row-body">
                  <div className="row-title">
                    <span className={`badge badge-news-${n.category}`}>{CAT_LABEL[n.category] || 'News'}</span>
                    {n.url ? <a href={n.url} target="_blank" rel="noopener noreferrer">{n.headline}</a> : n.headline}
                  </div>
                  {n.summary && <div className="row-meta">{n.summary}</div>}
                  {n.source && <div className="row-meta">{n.source}</div>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
