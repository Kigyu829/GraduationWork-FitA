'use strict';

/* ============================================================
   sc311/motivation.js — 동기부여 메시지 (AI 서버 호출)
   의존: utils.js
   ============================================================ */

async function fetchMotivation() {
  const textEl = document.getElementById('motivationText');
  if (!textEl) return;

  const today   = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const cacheKey = lsKey('motivationMsg', dateStr);

  const cached = localStorage.getItem(cacheKey);
  if (cached) { textEl.textContent = cached; return; }

  let missedCount = 0;
  const missedTypes = { meal: 0, workout: 0 };
  for (let i = 1; i <= 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const key  = lsKey('check', dStr);
    try {
      const chk = JSON.parse(localStorage.getItem(key)) || {};
      if (!chk.meal)    missedTypes.meal++;
      if (!chk.workout) missedTypes.workout++;
      if (!chk.meal || !chk.workout) missedCount++;
    } catch { missedCount++; }
  }

  const reasons = [];
  if (missedTypes.meal > 0)    reasons.push(`식단 미인증 ${missedTypes.meal}일`);
  if (missedTypes.workout > 0) reasons.push(`운동 미이행 ${missedTypes.workout}일`);
  const missedReasons = reasons.join(', ') || '없음';

  const userData    = Storage.getUser();
  const userInfoStr = [
    userData.gender       ? `성별 ${userData.gender}`         : '',
    userData.weight       ? `체중 ${userData.weight}kg`       : '',
    userData.targetWeight ? `목표 ${userData.targetWeight}kg` : '',
    userData.goalWeeks    ? `기간 ${userData.goalWeeks}주`    : '',
  ].filter(Boolean).join(', ');

  try {
    const res = await fetch(`${AI_SERVER}/api/motivation`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userInfo: userInfoStr, missedCount, missedReasons }),
    });
    if (!res.ok) throw new Error(`서버 오류 (${res.status})`);
    const json = await res.json();
    if (!json.success) throw new Error(json.message);

    const msg = json.message.trim();
    textEl.textContent = msg;
    localStorage.setItem(cacheKey, msg);
  } catch (err) {
    textEl.textContent = '오늘도 건강한 하루 보내세요! 💪';
    console.warn('동기부여 메시지 로드 실패:', err.message);
  }
}
