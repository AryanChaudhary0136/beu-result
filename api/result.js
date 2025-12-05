// api/result.js
// Vercel serverless function. Put at repo path: /api/result.js
// Proxies BEU endpoint and returns JSON { status, data } where data is parsed JSON or { raw: "..." }.

export default async function handler(req, res) {
  // CORS & preflight
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
  const month = (req.query.month || '').trim(); // optional if you pass exam_held directly
  const year = (req.query.year || '2024').trim();
  const exam_held = (req.query.exam_held || (month && year ? `${month}/${year}` : 'July/2025')).trim();

  if (!/^\d{5,20}$/.test(redg_no)) {
    return res.status(400).json({ error: 'Invalid registration number (redg_no). Example: 23155150039' });
  }

  const beuBase = 'https://beu-bih.ac.in/backend/v1/result/get-result';
  const beuUrl = `${beuBase}?year=${encodeURIComponent(year)}&redg_no=${encodeURIComponent(redg_no)}&semester=${encodeURIComponent(semester)}&exam_held=${encodeURIComponent(exam_held)}`;

  try {
    const r = await fetch(beuUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Result-Viewer/1.0',
        'Accept': 'application/json, text/plain, */*',
        // if your HAR showed Referer, add: 'Referer': 'https://beu-bih.ac.in/'
      },
    });

    const status = r.status;
    const text = await r.text();

    // Try parse JSON safely
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      // return raw text inside data.raw so frontend can show it
      parsed = { raw: text };
    }

    return res.status(200).json({ status, data: parsed });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
