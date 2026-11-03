// Live Cabrillo water status from the LA County Public Health beach page.
// Parses the posted advisories (rain advisory, ocean water use warnings,
// closures). Per-beach lab grades are only on the county's map, so this
// reports advisories/warnings, never invented grades. Returns null if the
// page can't be read or its structure isn't recognized.

const PAGES = [
  'https://publichealth.lacounty.gov/phcommon/public/eh/water_quality/beach_grades.cfm',
  'http://publichealth.lacounty.gov/phcommon/public/eh/water_quality/beach_grades.cfm',
];
const RELEASE_URL = (id) =>
  `http://publichealth.lacounty.gov/phcommon/public/media/mediapubhpdetail.cfm?prid=${id}`;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

let cache = { at: 0, ttl: 0, value: null };

async function getHtml(url, ms = 7000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(url, { headers: HEADERS, signal: ctl.signal, cache: 'no-store', redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function toText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function tzOffsetMs(ms) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles', hourCycle: 'h23',
    year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
  }).formatToParts(new Date(ms)).reduce((a, p) => ((a[p.type] = p.value), a), {});
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUtc - ms;
}
function pacificToUtcMs(y, m, d, h = 0, min = 0) {
  const guess = Date.UTC(y, m, d, h, min);
  return guess - tzOffsetMs(guess);
}

const MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'];

// "Wednesday, November 4, 2026, at 10:00am" -> UTC ms
function parseUntil(s) {
  const m = /([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4}),?\s*(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*([ap])m/i.exec(s || '');
  if (!m) return null;
  const mon = MONTHS.indexOf(m[1].toLowerCase());
  if (mon < 0) return null;
  let h = +m[4] % 12;
  if (m[6].toLowerCase() === 'p') h += 12;
  return pacificToUtcMs(+m[3], mon, +m[2], h, m[5] ? +m[5] : 0);
}

function parseMDY(s) {
  const [mm, dd, yy] = s.split('/').map(Number);
  return pacificToUtcMs(yy, mm - 1, dd, 0, 0);
}

function fmtShort(ms) {
  return new Date(ms).toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}
function fmtDay(ms) {
  return new Date(ms).toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric' });
}

function cabrilloSides(text) {
  const snippets = [...text.matchAll(/Cabrillo[^.;]{0,100}/gi)].map((m) => m[0]);
  if (snippets.length === 0) return { inner: false, outer: false, mentioned: false };
  const inner = snippets.some((s) => /inner|harbor|bay side/i.test(s));
  const outer = snippets.some((s) => /outer|ocean|open|surf|beach side/i.test(s));
  if (!inner && !outer) return { inner: true, outer: true, mentioned: true };
  return { inner, outer, mentioned: true };
}

export async function parseWater(pageHtml, getRelease = (id) => getHtml(RELEASE_URL(id)), now = Date.now()) {
  const text = toText(pageHtml);
  const start = text.indexOf('Press Release');
  const end = text.indexOf('Archived Ocean Related Press Release');
  if (start < 0 || end < 0 || end <= start) return null;
  const region = text.slice(start, end);

  const entryRe = /((?:Beach Closure|Ocean Water Use Warning|Ocean Water Quality Rain Advisory|Rain Advisory)[^]{0,220}?)\s(\d{2}\/\d{2}\/\d{4})/gi;
  const entries = [];
  let m;
  while ((m = entryRe.exec(region))) {
    entries.push({ heading: m[1].trim(), date: parseMDY(m[2]) });
  }
  if (entries.length === 0) return null;

  const prids = [];
  for (const x of pageHtml.matchAll(/mediapubhpdetail\.cfm\?prid=(\d+)/gi)) {
    if (!prids.includes(x[1])) prids.push(x[1]);
  }

  const out = {
    inner: { status: 'good', detail: 'No active county warning or advisory', testedOn: null },
    outer: { status: 'good', detail: 'No active county warning or advisory', testedOn: null },
    advisory: null,
  };
  const notes = [];
  const clearedAfter = (date) => entries.some((e) => /lift|clear|rescind|remov/i.test(e.heading) && e.date >= date);

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const ageDays = (now - e.date) / 86400000;

    if (/rain advisory/i.test(e.heading)) {
      const until = /In Effect Until\s+(.{0,70}?)$/i.exec(e.heading);
      const untilMs = until ? parseUntil(until[1]) : null;
      const active = untilMs ? now < untilMs : ageDays <= 3;
      if (active) {
        const when = untilMs ? `until ${fmtShort(untilMs)}` : 'in effect';
        for (const side of ['inner', 'outer']) {
          if (out[side].status === 'good') out[side] = { status: 'advisory', detail: `County rain advisory ${when}`, testedOn: null };
        }
        notes.push(`LA County rain advisory ${when}: avoid water contact.`);
      }
      continue;
    }

    // Ocean water use warning or closure
    if (ageDays > 7 || clearedAfter(e.date)) continue;
    let covered = null;
    if (prids[i]) {
      try {
        const rel = toText(await getRelease(prids[i]));
        covered = cabrilloSides(rel);
      } catch (err) {
        covered = null;
      }
    }
    if (covered && covered.mentioned) {
      for (const side of ['inner', 'outer']) {
        if (covered[side]) out[side] = { status: 'closed', detail: `County ${/closure/i.test(e.heading) ? 'closure' : 'warning'} issued ${fmtDay(e.date)}`, testedOn: null };
      }
    } else if (!covered) {
      notes.push(`County ocean water warning issued ${fmtDay(e.date)}: couldn't confirm if Cabrillo is included.`);
    }
  }

  out.advisory = notes.length ? notes.join(' ').slice(0, 240) : null;
  return out;
}

export async function fetchWaterStatus() {
  if (Date.now() - cache.at < cache.ttl) return cache.value;
  let value = null;
  let ttl = 2 * 60 * 1000;
  try {
    let html = null;
    for (const url of PAGES) {
      try { html = await getHtml(url); break; } catch (e) { /* try next */ }
    }
    if (html) {
      value = await parseWater(html);
      if (value) ttl = 15 * 60 * 1000;
      else console.error('water: page fetched but structure not recognized');
    } else {
      console.error('water: could not fetch county page');
    }
  } catch (err) {
    console.error('water: failed', err);
  }
  cache = { at: Date.now(), ttl, value };
  return value;
}
