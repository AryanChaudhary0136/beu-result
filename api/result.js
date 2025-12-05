// /api/result.js
// Vercel serverless proxy + normalizer for BEU result endpoint
// Put this file in "api/result.js" in your repo.

const BEU_BASE = 'https://beu-bih.ac.in/backend/v1/result/get-result';

export default async function handler(req, res) {
  // CORS
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
  const year = (req.query.year || new Date().getFullYear()).toString();
  const month = (req.query.exam_month || '').trim(); // optional
  const exam_held = (req.query.exam_held || (month ? `${month}/${year}` : `${month}/${year}`)).trim() || `${month}/${year}`;

  if (!/^\d{4,20}$/.test(redg_no)) {
    return res.status(400).json({ error: 'Invalid registration number (redg_no).' });
  }

  const beuUrl = `${BEU_BASE}?year=${encodeURIComponent(year)}&redg_no=${encodeURIComponent(redg_no)}&semester=${encodeURIComponent(semester)}&exam_held=${encodeURIComponent(exam_held)}`;

  try {
    const r = await fetch(beuUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Result-Viewer/1.0',
        'Accept': 'application/json, text/plain, */*'
      }
    });

    const txt = await r.text();

    // Try parse JSON safely
    let parsed;
    try {
      parsed = JSON.parse(txt);
    } catch (err) {
      // Not JSON — return raw content so frontend can show it (and avoid JSON.parse errors)
      return res.status(200).json({ status: r.status, raw: txt });
    }

    // Normalise expected fields into a stable structure for frontend
    const payload = parsed?.data || parsed; // some responses already had { data: {...} }
    const normalized = {
      registration_no: payload?.redg_no || payload?.reg_no || null,
      name: payload?.name || null,
      father_name: payload?.father_name || null,
      mother_name: payload?.mother_name || null,
      college_name: payload?.college_name || payload?.college || null,
      college_code: payload?.college_code || null,
      course: payload?.course || payload?.course_name || null,
      semester: payload?.semester || semester || null,
      exam_held: payload?.exam_held || exam_held || null,
      exam_year: payload?.examYear || payload?.exam_year || year || null,
      theorySubjects: Array.isArray(payload?.theorySubjects) ? payload.theorySubjects : (payload?.theory || payload?.theory_subjects || []),
      practicalSubjects: Array.isArray(payload?.practicalSubjects) ? payload.practicalSubjects : (payload?.practical || payload?.practical_subjects || []),
      sgpa: payload?.sgpa || payload?.SGPA || payload?.cgpa || payload?.CGPA || null,
      raw: payload
    };

    return res.status(200).json({ status: r.status, parsed: normalized });

  } catch (err) {
    console.error('proxy error', err);
    return res.status(500).json({ error: 'Server error: ' + (err.message || String(err)) });
  }
}
