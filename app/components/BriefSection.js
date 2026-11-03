'use client';

const STATUS_LABEL = { good: 'Good', advisory: 'Advisory', closed: 'Warning / closed', unknown: 'No data' };
const COUNTY_MAP_URL = 'http://publichealth.lacounty.gov/phcommon/public/eh/water_quality/beach_grades.cfm';
const KNOWN = ['good', 'advisory', 'closed'];

function Beach({ name, info }) {
  const s = info?.status || 'unknown';
  return (
    <a
      className={`water-tile water-${s}`}
      href={COUNTY_MAP_URL}
      target="_blank"
      rel="noopener noreferrer"
      title="Open the county beach grade map"
    >
      <div className="water-name">{name}</div>
      <div className="water-status">{STATUS_LABEL[s]}</div>
      {info?.detail && <div className="water-detail">{info.detail}</div>}
      {info?.testedOn && <div className="water-detail">Tested {info.testedOn}</div>}
      <div className="water-detail water-map">County grade map ↗</div>
    </a>
  );
}

// Cabrillo Beach water status (live from the county page; falls back to
// the morning task's stored value only if it was posted today).
export default function BriefSection({ brief }) {
  const storedToday =
    brief?.updatedAt && new Date().toDateString() === new Date(brief.updatedAt).toDateString();
  const water = brief?.waterLive || storedToday ? brief?.data?.water : null;

  const unverified = !KNOWN.includes(water?.inner?.status) || !KNOWN.includes(water?.outer?.status);

  return (
    <div className="section">
      <div className="section-title">Cabrillo Beach Water</div>

      <div className="water-grid">
        <Beach name="Cabrillo Inner" info={water?.inner} />
        <Beach name="Cabrillo Outer" info={water?.outer} />
      </div>

      {water?.advisory && <div className="water-note">{water.advisory}</div>}

      {unverified && (
        <div className="water-links">
          Not verified today ·{' '}
          <a href="tel:18005255662">Call county beach hotline</a> ·{' '}
          <a href="https://www.google.com/search?q=Cabrillo+Beach+water+quality+today" target="_blank" rel="noopener noreferrer">Check online</a>
        </div>
      )}
    </div>
  );
}
