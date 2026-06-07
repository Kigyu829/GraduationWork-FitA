'use strict';

/* ============================================================
   sc201_2/utils.js — 공용 유틸 함수 (힌트 표시, 입력 상태)
   ============================================================ */

/* ── 힌트 표시 헬퍼 ── */
function setHint(elId, msg, type = '') {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = msg;
  el.className   = 'field-hint ' + type;
}

function setInputState(input, state) {
  input.classList.remove('error', 'valid');
  if (state) input.classList.add(state);
}
