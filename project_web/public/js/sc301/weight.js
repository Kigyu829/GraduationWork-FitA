'use strict';

/* ════════════════════════════════
   오늘 체중 입력
   ════════════════════════════════ */
function initTodayWeight() {
  const input   = document.getElementById('todayWeightInput');
  const saveBtn = document.getElementById('todayWeightSaveBtn');
  const hint    = document.getElementById('todayWeightHint');

  const todayKey = `todayWeight_${getTodayKey()}`;
  const saved    = localStorage.getItem(todayKey);
  if (saved && input) input.value = saved;

  saveBtn?.addEventListener('click', () => {
    const val = parseFloat(input?.value);
    if (!val || val < 20 || val > 300) {
      if (hint) { hint.textContent = '올바른 체중을 입력해주세요.'; hint.style.color = 'var(--red)'; }
      return;
    }

    /* ── 최저 권장 체중 + 급격한 변화를 순차 커스텀 confirm으로 검증 ── */
    const userData301 = Storage.getUser();
    const heightCm    = Number(userData301.height || 0);
    const minSafe301  = heightCm > 0 ? Math.round(18.5 * (heightCm/100) ** 2 * 10) / 10 : 30;

    const prevKey = `todayWeight_${(function(){
      const y = new Date(); y.setDate(y.getDate()-1);
      return y.getFullYear()+'-'+String(y.getMonth()+1).padStart(2,'0')+'-'+String(y.getDate()).padStart(2,'0');
    })()}`;
    const prevWeight = parseFloat(localStorage.getItem(prevKey) || userData301.weight || 0);

    function doSaveWeight() {
      localStorage.setItem(todayKey, val);
      Storage.mergeUser({ weight: String(val) });
      if (hint) hint.textContent = '';
      showWeightSavedPopup(val);
      renderProgress();
      renderSidebar();
      renderStreakBanner();
    }

    function checkSuddenChange(onPass) {
      if (prevWeight > 0 && Math.abs(val - prevWeight) >= 5) {
        const diff = (val - prevWeight).toFixed(1);
        const sign = Number(diff) > 0 ? '+' : '';
        showCustomConfirm({
          icon: '📊',
          title: '체중 변화가 커요',
          desc: `어제 <strong>${prevWeight}kg</strong> → 오늘 <strong>${val}kg</strong><br>하루 차이가 <strong style="color:var(--red)">${sign}${diff}kg</strong>이에요.<br><br>정말 <strong>${val}kg</strong>으로 저장할까요?`,
          okText: '그래도 저장',
          cancelText: '다시 입력',
          onOk: onPass
        });
      } else {
        onPass();
      }
    }

    if (val < minSafe301) {
      showCustomConfirm({
        icon: '⚖️',
        title: '권장 체중 이하예요',
        desc: `입력한 체중 <strong>${val}kg</strong>은 키 <strong>${heightCm}cm</strong> 기준<br>최저 권장 체중 <strong style="color:var(--teal)">${minSafe301}kg</strong>(BMI 18.5)보다 낮아요.<br><br>실수가 아닌지 확인해주세요.`,
        okText: '그래도 저장',
        cancelText: '다시 입력',
        danger: true,
        onOk: () => checkSuddenChange(doSaveWeight)
      });
    } else {
      checkSuddenChange(doSaveWeight);
    }
  });

  input?.addEventListener('keydown', e => { if (e.key === 'Enter') saveBtn?.click(); });
}
