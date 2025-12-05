// /api/result.js
// Vercel serverless function - proxy to BEU result endpoint
// Put this file in the repo's "api" folder: api/result.js

const CACHE_TTL_MS = 300 * 1000; // 5 minutes
const cache = new Map();

export default async function handler(req, res) {
  // CORS + preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const redg_no = (req.query.redg_no || '').trim();
  const semester = (req.query.semester || 'III').trim();
  const month = (req.query.month || '').trim();      // e.g. July
  const year = (req.query.year || '').trim();        // e.g. 2025

  if (!/^\d{4,20}$/.test(redg_no)) {
    return res.status(400).json({ error: 'Invalid registration number (redg_no)' });
  }

  // build exam_held exactly like the HAR showed: "Month/Year" → e.g. "July/2025"
  const exam_held = (month && year) ? `${month}/${year}` : `${year}`;

  // Cache key
  const cacheKey = `${redg_no}|${semester}|${exam_held}`;
  const now = Date.now();
  if (cache.has(cacheKey)) {
    const entry = cache.get(cacheKey);
    if (now - entry.t < CACHE_TTL_MS) {
      return res.status(200).json({ source: 'cache', data: entry.data });
    } else {
      cache.delete(cacheKey);
    }
  }

  // BEU endpoint discovered from HAR
  const beuBase = 'https://beu-bih.ac.in/backend/v1/result/get-result';
  const beuUrl = `${beuBase}?year=${encodeURIComponent(year || '2024')}` +
                 `&redg_no=${encodeURIComponent(redg_no)}` +
                 `&semester=${encodeURIComponent(semester)}` +
                 `&exam_held=${encodeURIComponent(exam_held)}`;

  try {
    const r = await fetch(beuUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Result-Viewer/1.0',
        'Accept': 'application/json, text/plain, */*'
        // if BEU required referer/cookie you would add here (from HAR)
      },
    });

    const status = r.status;
    const text = await r.text();

    // Try parse JSON, else return raw text under data.raw
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      parsed = { raw: text };
    }

    // cache
    cache.set(cacheKey, { t: now, data: parsed });

    return res.status(200).json({ source: 'beu', status, data: parsed });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
