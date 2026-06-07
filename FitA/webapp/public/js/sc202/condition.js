'use strict';

/* ── "해당 없음" 체크 시 다른 항목 해제, 다른 항목 체크 시 "해당 없음" 해제 ── */
const condNoneEl = document.getElementById('condNone');
document.querySelectorAll('input[name="condition"]').forEach(cb => {
  cb.addEventListener('change', () => {
    if (cb.value === '없음' && cb.checked) {
      document.querySelectorAll('input[name="condition"]').forEach(other => {
        if (other.value !== '없음') other.checked = false;
      });
    } else if (cb.value !== '없음' && cb.checked && condNoneEl) {
      condNoneEl.checked = false;
    }
  });
});
