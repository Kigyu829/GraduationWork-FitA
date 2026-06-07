'use strict';

/* ════════════════════════════════
   sc701/weightGraph.js
   최근 30일 체중 변화 SVG 그래프 렌더링
   의존: common.js (getCurrentUid, db, firebase)
   ════════════════════════════════ */

async function renderWeightGraph() {
  const svg       = document.getElementById('weightGraphSvg');
  const labelsEl  = document.getElementById('weightGraphLabels');
  const emptyEl   = document.getElementById('weightGraphEmpty');
  if (!svg) return;

  const uid = getCurrentUid();
  if (!uid) return;   /* auth 미확정 — onAuthStateChanged 후 재호출됨 */
  const points = [];

  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const key     = `todayWeight_check_${uid}_${dateStr}`;
    const val     = parseFloat(localStorage.getItem(key));
    points.push({ dateStr, weight: isNaN(val) ? null : val, dayLabel: `${d.getMonth()+1}/${d.getDate()}` });
  }

  /* localStorage에 없는 날짜를 Firestore에서 보완 */
  if (points.some(p => p.weight === null) && typeof db !== 'undefined') {
    try {
      const snap = await db.collection('users').doc(uid).collection('daily')
        .where(firebase.firestore.FieldPath.documentId(), '>=', points[0].dateStr)
        .where(firebase.firestore.FieldPath.documentId(), '<=', points[points.length - 1].dateStr)
        .get();
      snap.forEach(doc => {
        const data = doc.data();
        if (typeof data.weight !== 'number') return;
        const pt = points.find(p => p.dateStr === doc.id);
        if (pt && pt.weight === null) {
          pt.weight = data.weight;
          localStorage.setItem(`todayWeight_check_${uid}_${doc.id}`, String(data.weight));
        }
      });
    } catch { /* 네트워크 오류 — localStorage 데이터만 사용 */ }
  }

  const valid = points.filter(p => p.weight !== null);
  if (valid.length < 2) {
    if (svg)     svg.style.display    = 'none';
    if (labelsEl) labelsEl.style.display = 'none';
    if (emptyEl)  emptyEl.style.display  = 'block';
    return;
  }

  const weights = valid.map(p => p.weight);
  const minW    = Math.floor(Math.min(...weights) - 1);
  const maxW    = Math.ceil(Math.max(...weights)  + 1);
  const rangeW  = maxW - minW || 1;

  const W = 300, H = 160, padL = 30, padR = 8, padT = 10, padB = 10;
  const gW = W - padL - padR;
  const gH = H - padT - padB;

  function xOf(idx)    { return padL + (idx / (points.length - 1)) * gW; }
  function yOf(weight) { return padT + (1 - (weight - minW) / rangeW) * gH; }

  /* Y축 라벨 (최대, 중간, 최소) */
  const midW   = ((maxW + minW) / 2).toFixed(1);
  const yLines = [
    { val: maxW, y: yOf(maxW) },
    { val: midW, y: yOf(parseFloat(midW)) },
    { val: minW, y: yOf(minW) },
  ];

  let svgHtml = '';

  /* 격자선 */
  yLines.forEach(({ y, val }) => {
    svgHtml += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>`;
    svgHtml += `<text x="${padL - 4}" y="${y + 3.5}" text-anchor="end" font-size="8" fill="rgba(255,255,255,0.35)">${val}</text>`;
  });

  /* 면적 채우기 */
  const firstValid = valid[0];
  const lastValid  = valid[valid.length - 1];
  const pathD = valid.map((p, i) => {
    const allIdx = points.findIndex(q => q.dateStr === p.dateStr);
    return `${i === 0 ? 'M' : 'L'}${xOf(allIdx)},${yOf(p.weight)}`;
  }).join(' ');
  const fillD = `${pathD} L${xOf(points.findIndex(q => q.dateStr === lastValid.dateStr))},${H - padB} L${xOf(points.findIndex(q => q.dateStr === firstValid.dateStr))},${H - padB} Z`;

  svgHtml += `<defs>
    <linearGradient id="wgGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(102,208,188,0.35)"/>
      <stop offset="100%" stop-color="rgba(102,208,188,0)"/>
    </linearGradient>
  </defs>`;
  svgHtml += `<path d="${fillD}" fill="url(#wgGrad)" stroke="none"/>`;
  svgHtml += `<path d="${pathD}" fill="none" stroke="var(--teal,#66D0BC)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;

  /* 점 + 툴팁 */
  valid.forEach(p => {
    const allIdx = points.findIndex(q => q.dateStr === p.dateStr);
    const cx = xOf(allIdx), cy = yOf(p.weight);
    svgHtml += `<circle cx="${cx}" cy="${cy}" r="3.5" fill="var(--teal,#66D0BC)" stroke="var(--card,#1a2632)" stroke-width="1.5"/>`;
    svgHtml += `<title>${p.dayLabel}: ${p.weight}kg</title>`;
  });

  svg.innerHTML = svgHtml;

  /* X축 라벨 — 7일 간격 */
  if (labelsEl) {
    const labelPoints = points.filter((_, i) => i % 7 === 0 || i === points.length - 1);
    labelsEl.innerHTML = '';
    const totalW = svg.getBoundingClientRect().width || 300;
    labelPoints.forEach(p => {
      const allIdx = points.findIndex(q => q.dateStr === p.dateStr);
      const span   = document.createElement('span');
      span.textContent  = p.dayLabel;
      span.style.cssText = `position:absolute;left:${(padL + (allIdx / (points.length-1)) * gW) / W * 100}%;transform:translateX(-50%);font-size:9px;color:rgba(255,255,255,0.4);`;
      labelsEl.appendChild(span);
    });
    labelsEl.style.position = 'relative';
    labelsEl.style.height   = '14px';
  }
}
