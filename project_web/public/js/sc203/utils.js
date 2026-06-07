'use strict';

/* ============================================================
   sc203/utils.js — 상수 및 공용 유틸 함수
   의존: common.js (getBMIStatus, calcMinSafeWeight 재정의 포함)
   ============================================================ */

/* ── 과도한 목표 여부 (주 1kg 초과 감량 기준) ── */
function isExcessive(targetLoss, weeks) {
  if (!weeks || !targetLoss) return false;
  return (targetLoss / weeks) > 1.0;
}

/* ── 경고 표시 / 숨김 ── */
function showWarning(msg) {
  const warningEl = document.getElementById('goalWarning');
  if (!warningEl) return;
  warningEl.textContent = '⚠️ ' + msg;
  warningEl.classList.add('show');
}

function hideWarning() {
  const warningEl = document.getElementById('goalWarning');
  if (!warningEl) return;
  warningEl.classList.remove('show');
}
