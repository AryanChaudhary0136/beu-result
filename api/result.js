// api/result.js
// Vercel serverless proxy for BEU result endpoint
// Robust: handles JSON and non-JSON responses, caches short-term.

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cache = new Map();

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const redg_no = (req.query.redg_no || '').trim();
  const semester = (req.query.semester || 'III').trim();
  const year = (req.query.year || new Date().getFullYear()).trim();
  const month = (req.query.month || '').trim();
  const exam_held = (req.query.exam_held || (month ? `${month}/${year}` : `${month}/${year}`)).trim();

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
        'User-Agent': 'Result-Viewer/1.0',
        'Accept': 'application/json, text/plain, */*'
      },
    });

    const text = await r.text();
    let parsed = null;

    // Try to parse JSON strictly first
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      // If not strict JSON, try to find JSON substring (defensive)
      const firstBrace = text.indexOf('{');
      const lastBrace = text.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        const maybe = text.slice(firstBrace, lastBrace + 1);
        try {
          parsed = JSON.parse(maybe);
        } catch (e2) {
          // fall back to raw
          parsed = { raw: text };
        }
      } else {
        parsed = { raw: text };
      }
    }

    // Cache parsed result
    cache.set(cacheKey, { t: now, data: parsed });

    return res.status(200).json({ source: 'beu', status: r.status, data: parsed });
  } catch (err) {
    return res.status(500).json({ error: err.message || String(err) });
  }
}
