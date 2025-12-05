// api/result.js
// Vercel serverless proxy for BEU result endpoint
// Returns parsed JSON when possible, otherwise returns raw HTML under data.raw
// Caches in-memory for short time to avoid hammering BEU.

const CACHE_TTL = 300 * 1000; // 5 minutes
const cache = new Map();

export default async function handler(req, res) {
  // Handle OPTIONS for CORS preflight
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
  const year = (req.query.year || '2024').trim();
  const exam_held = (req.query.exam_held || 'July/2025').trim();

  if (!/^\d{4,20}$/.test(redg_no)) {
    return res.status(400).json({ error: 'Invalid registration number (redg_no)' });
  }

  const cacheKey = `${redg_no}|${semester}|${year}|${exam_held}`;
  const now = Date.now();
  if (cache.has(cacheKey)) {
    const entry = cache.get(cacheKey);
    if (now - entry.t < CACHE_TTL) {
      return res.status(200).json({ source: 'cache', data: entry.data });
    } else {
      cache.delete(cacheKey);
    }
  }

  // BEU endpoint from HAR
  const beuBase = 'https://beu-bih.ac.in/backend/v1/result/get-result';
  const beuUrl = `${beuBase}?year=${encodeURIComponent(year)}&redg_no=${encodeURIComponent(redg_no)}&semester=${encodeURIComponent(semester)}&exam_held=${encodeURIComponent(exam_held)}`;

  try {
    const r = await fetch(beuUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Result-Viewer/1.0 (+https://example.com)',
        'Accept': 'application/json, text/plain, */*'
        // add Referer/Cookie here only if absolutely needed
      }
    });

    const status = r.status;
    const text = await r.text();

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      parsed = { raw: text };
    }

    cache.set(cacheKey, { t: now, data: parsed });

    return res.status(200).json({ source: 'beu', status, data: parsed });
  } catch (err) {
    return res.status(500).json({ error: err.message || String(err) });
  }
}
