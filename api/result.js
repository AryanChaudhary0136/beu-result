// api/result.js
// Vercel serverless function - proxies BEU endpoint and returns JSON
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  const redg_no = (req.query.redg_no || '').trim();
  const semester = (req.query.semester || 'III').trim();
  const exam_month = (req.query.exam_month || '').trim();
  const exam_year = (req.query.exam_year || '').trim();

  if (!/^\d{5,20}$/.test(redg_no)) {
    return res.status(400).json({ error: 'Invalid registration number (redg_no)' });
  }

  // Build exam_held same as HAR: "Month/Year" e.g. "July/2025"
  const exam_held = (exam_month && exam_year) ? `${exam_month}/${exam_year}` : `${exam_year}`;

  const yearParam = exam_year || (new Date().getFullYear()).toString();

  const beuUrl = `https://beu-bih.ac.in/backend/v1/result/get-result?year=${encodeURIComponent(yearParam)}&redg_no=${encodeURIComponent(redg_no)}&semester=${encodeURIComponent(semester)}&exam_held=${encodeURIComponent(exam_held)}`;

  try {
    const r = await fetch(beuUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Result-Viewer/1.0',
        'Accept': 'application/json, text/plain, */*'
      }
    });

    const text = await r.text();

    // Try parse as JSON. If parse fails, return raw text inside data.raw
    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      data = { raw: text };
    }

    return res.status(200).json({ status: r.status, data });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
