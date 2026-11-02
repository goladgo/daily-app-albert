import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { ensureHomeTables } from '@/lib/home';

export const dynamic = 'force-dynamic';

function isAuthorized(req) {
  const secret = req.headers.get('x-ingest-secret');
  return !!process.env.INGEST_SECRET && secret === process.env.INGEST_SECRET;
}

const VALID_STATUS = new Set(['good', 'advisory', 'closed', 'unknown']);
const VALID_CAT = new Set(['crime', 'business', 'events', 'warning', 'other']);

function cleanBeach(b) {
  if (!b || typeof b !== 'object') return { status: 'unknown', detail: null, testedOn: null };
  return {
    status: VALID_STATUS.has(b.status) ? b.status : 'unknown',
    detail: b.detail ? String(b.detail).slice(0, 200) : null,
    testedOn: b.testedOn ? String(b.testedOn).slice(0, 40) : null,
  };
}

// Morning brief ingest: one row (id=1) is replaced each run.
// Body: { water: { inner, outer, advisory }, news: [{ headline, summary, category, url, source }] }
export async function POST(req) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  await ensureHomeTables();
  const body = await req.json().catch(() => ({}));
  const water = body.water || {};
  const news = (Array.isArray(body.news) ? body.news : [])
    .filter((n) => n && n.headline && String(n.headline).trim())
    .slice(0, 5)
    .map((n) => ({
      headline: String(n.headline).trim().slice(0, 160),
      summary: n.summary ? String(n.summary).trim().slice(0, 280) : null,
      category: VALID_CAT.has(n.category) ? n.category : 'other',
      url: n.url ? String(n.url) : null,
      source: n.source ? String(n.source).slice(0, 60) : null,
    }));

  const data = {
    water: {
      inner: cleanBeach(water.inner),
      outer: cleanBeach(water.outer),
      advisory: water.advisory ? String(water.advisory).slice(0, 240) : null,
    },
    news,
  };

  await sql`
    INSERT INTO daily_brief (id, data, updated_at)
    VALUES (1, ${JSON.stringify(data)}::jsonb, now())
    ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()
  `;
  return NextResponse.json({ ok: true, news: news.length });
}
