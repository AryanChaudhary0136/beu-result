// script.js - Frontend Logic

// Wait for HTML to load before populating Year
document.addEventListener('DOMContentLoaded', function() {
  const sel = document.getElementById('year');
  if (sel) {
    sel.innerHTML = ''; // Clear previous if any
    for (let y = 2020; y <= 2030; y++) {
      const o = document.createElement('option');
      o.value = o.textContent = y;
      // Screenshot mein 2025 tha, isliye 2025 select kar rahe hain
      if (y === 2025) o.selected = true; 
      sel.appendChild(o);
    }
  }
});

const apiBase = '/api/result'; // Vercel route

// Setup Event Listeners
document.addEventListener('DOMContentLoaded', function() {
  const goBtn = document.getElementById('go');
  const regInput = document.getElementById('redg');
  const pdfBtn = document.getElementById('downloadPdf');

  if(goBtn) goBtn.addEventListener('click', fetchResult);
  if(regInput) regInput.addEventListener('keydown', (e) => { 
    if (e.key === 'Enter') goBtn.click(); 
  });
  if(pdfBtn) pdfBtn.addEventListener('click', downloadPdfAction);
});

async function fetchResult(){
  const redg = document.getElementById('redg').value.trim();
  const sem = document.getElementById('sem').value.trim();
  const month = document.getElementById('month').value.trim();
  const year = document.getElementById('year').value.trim();
  
  if(!redg){ alert('Enter your registration number'); return; }

  const exam_held = `${month}/${year}`;
  const url = `${apiBase}?redg_no=${encodeURIComponent(redg)}&semester=${encodeURIComponent(sem)}&year=${encodeURIComponent(year)}&exam_held=${encodeURIComponent(exam_held)}`;

  document.getElementById('msg').textContent = 'Loading...';
  document.getElementById('outBox').hidden = true;
  
  try {
    const r = await fetch(url);
    const ct = r.headers.get('content-type') || '';
    let dataWrap;
    if (ct.includes('application/json')) {
      dataWrap = await r.json();
    } else {
      const txt = await r.text();
      try { dataWrap = JSON.parse(txt); } catch { dataWrap = { data: { raw: txt } }; }
    }

    document.getElementById('msg').textContent = '';

    if (dataWrap.error) {
      alert('Error: ' + dataWrap.error);
      return;
    }

    const data = (dataWrap.data && typeof dataWrap.data === 'object') ? dataWrap.data : dataWrap;
    renderResult(data, sem, year);
  } catch (err) {
    document.getElementById('msg').textContent = '';
    alert('Fetch error: ' + (err.message || err));
  }
}

function renderResult(data, semInput, yearInput){
  const outBox = document.getElementById('outBox');
  
  // Fill Header Info
  document.getElementById('examTitle').textContent = `B.Tech. ${data.semester || semInput} Semester Examination, ${yearInput}`;
  document.getElementById('dSem').textContent = data.semester || semInput;
  document.getElementById('dExam').textContent = data.exam_held || '';
  document.getElementById('dReg').textContent = data.redg_no || data.registration_no || '';
  document.getElementById('dName').textContent = (data.name || data.student_name || '').toUpperCase();
  document.getElementById('dFather').textContent = (data.father_name || '').toUpperCase();
  document.getElementById('dMother').textContent = (data.mother_name || '').toUpperCase();
  document.getElementById('dCollege').textContent = data.college_name || '';
  document.getElementById('dCourse').textContent = data.course_name || '';

  // Helper to build Subject Table
  function buildSubTable(subjects, title) {
      if(!subjects || subjects.length === 0) return '';
      let rows = subjects.map(s => `
          <tr>
              <td>${s.code || s.subject_code || ''}</td>
              <td>${s.name || s.subject_name || ''}</td>
              <td>${s.ese || ''}</td>
              <td>${s.ia || ''}</td>
              <td>${s.total || s.obtained || ''}</td>
              <td>${s.grade || ''}</td>
              <td>${s.credit || ''}</td>
          </tr>
      `).join('');
      
      return `
          <div class="section-title">${title}</div>
          <table class="marks-table">
              <thead>
                  <tr>
                      <th style="width:15%">Subject Code</th>
                      <th>Subject Name</th>
                      <th style="width:8%">ESE</th>
                      <th style="width:8%">IA</th>
                      <th style="width:8%">Total</th>
                      <th style="width:8%">Grade</th>
                      <th style="width:8%">Credit</th>
                  </tr>
              </thead>
              <tbody>${rows}</tbody>
          </table>
      `;
  }

  // Theory & Practical Areas Separation Logic
  const theoryDiv = document.getElementById('theorySection');
  const practDiv = document.getElementById('practicalSection');
  
  let theory = data.theorySubjects || [];
  let practical = data.practicalSubjects || [];
  
  if(theory.length === 0 && practical.length === 0 && data.subjects){
      data.subjects.forEach(s => {
           const code = (s.code || '').toUpperCase();
           const name = (s.name || '').toUpperCase();
           if(code.endsWith('P') || name.includes('LAB') || name.includes('PRACTICAL')) practical.push(s);
           else theory.push(s);
      });
  }

  theoryDiv.innerHTML = buildSubTable(theory, 'THEORY');
  practDiv.innerHTML = buildSubTable(practical, 'PRACTICAL');

  // SGPA Table Logic
  const tbody = document.getElementById('sgpaBody');
  let sgpas = ['-', '-', '-', '-', '-', '-', '-', '-'];
  
  if(Array.isArray(data.sgpa)){
      data.sgpa.forEach((val, idx) => {
          if(idx < 8) sgpas[idx] = val;
      });
  }
  
  let cgpa = data.cgpa || data.cur_cgpa || data.CGPA || '-';

  tbody.innerHTML = `<tr>
      <td style="font-weight:bold">SGPA</td>
      <td>${sgpas[0]}</td><td>${sgpas[1]}</td><td>${sgpas[2]}</td><td>${sgpas[3]}</td>
      <td>${sgpas[4]}</td><td>${sgpas[5]}</td><td>${sgpas[6]}</td><td>${sgpas[7]}</td>
      <td>${cgpa}</td>
  </tr>`;

  // Remarks
  const remarkText = (data.remarks || 'PASS').toUpperCase();
  document.getElementById('dRemarks').textContent = remarkText;
  if(remarkText.includes('FAIL')) {
      document.getElementById('dRemarks').style.color = 'red';
  } else {
      document.getElementById('dRemarks').style.color = 'green';
  }

  outBox.hidden = false;
}

// Separate function for PDF download
function downloadPdfAction() {
  const printContent = document.getElementById('printArea').innerHTML;
  const styles = `
    <style>
      body{font-family:'Times New Roman', serif; padding:20px; color:#000;}
      table{width:100%;border-collapse:collapse;margin-bottom:15px;font-size:12px;}
      td,th{border:1px solid #000;padding:5px;}
      .header-text{text-align:center;margin-bottom:20px;}
      .section-title{font-weight:bold;margin-top:15px;margin-bottom:5px;font-size:13px;text-transform:uppercase;}
      .remarks-box{border:1px solid #000;padding:10px;margin-top:10px;font-weight:bold;}
      .footer-notes{font-size:10px;margin-top:30px;color:#444;}
      .marks-table th { background-color: #f0f0f0 !important; -webkit-print-color-adjust: exact; }
    </style>
  `;
  
  const w = window.open('', '_blank', 'width=900,height=800');
  w.document.write('<html><head><title>Print Result</title>' + styles + '</head><body>');
  w.document.write(printContent);
  w.document.write('</body></html>');
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 500);
}
