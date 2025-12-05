// api/result.js
// Vercel serverless proxy for BEU result endpoint
// Basic caching in memory to reduce hits.

const CACHE_TTL = 5 * 60 * 1000; // 5 min
const cache = new Map();

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const redg_no = (req.query.redg_no || '').trim();
  const semester = (req.query.semester || 'III').trim();
  const year = (req.query.year || '2024').trim();
  const exam_held = (req.query.exam_held || '').trim();

  if (!/^\d{5,20}$/.test(redg_no)) {
    return res.status(400).json({ error: 'Invalid registration number' });
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
        'User-Agent': 'Result-Viewer/1.0',
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://beu-bih.ac.in/'
      }
    });

    const text = await r.text();
    let parsed;
    try { parsed = JSON.parse(text); }
    catch {
      // Sometimes server returns raw HTML / text. Try extract JSON substring
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start >= 0 && end > start) {
        try { parsed = JSON.parse(text.slice(start, end + 1)); }
        catch(e) { parsed = { raw: text }; }
      } else parsed = { raw: text };
    }

    // store in cache
    cache.set(cacheKey, { t: now, data: parsed });

    return res.status(200).json({ source: 'beu', status: r.status, data: parsed });
  } catch (err) {
    return res.status(500).json({ error: err.message || String(err) });
  }
}
