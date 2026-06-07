'use strict';

/* ── 체중 입력 · 저장 · 스킵 로직 ── */
function initWeightInput(data, todayStr, todayKey) {
  const input    = document.getElementById('wcInput');
  const bmiEl    = document.getElementById('wcBmiPreview');
  const hintEl   = document.getElementById('wcHint');
  const saveBtn  = document.getElementById('wcSaveBtn');
  const skipBtn  = document.getElementById('wcSkipBtn');
  const heightCm = Number(data.height || 0);

  /* ── 전날 체중 힌트 ── */
  const today    = new Date();
  const prevDate = new Date(today);
  prevDate.setDate(today.getDate() - 1);
  const prevDateStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth()+1).padStart(2,'0')}-${String(prevDate.getDate()).padStart(2,'0')}`;
  const prevKey     = `todayWeight_${lsKey('check', prevDateStr)}`;
  const prevWeight  = parseFloat(localStorage.getItem(prevKey) || data.weight || 0);

  const prevEl = document.getElementById('wcPrev');
  if (prevEl && prevWeight > 0) {
    prevEl.textContent = `어제 체중: ${prevWeight}kg`;
  }

  /* ── 실시간 BMI 미리보기 ── */
  input?.addEventListener('input', () => {
    if (hintEl) hintEl.textContent = '';
    const val = parseFloat(input.value);
    if (val && heightCm > 0) {
      const bmi    = val / ((heightCm / 100) ** 2);
      const status = getBMIStatus(bmi);
      if (bmiEl) {
        bmiEl.textContent = `BMI ${bmi.toFixed(1)} · ${status.label}`;
        bmiEl.style.color = status.color;
      }
    } else {
      if (bmiEl) bmiEl.textContent = '';
    }
  });

  /* ── 저장 ── */
  function doSave() {
    const val = parseFloat(input?.value);
    if (!val || val < 20 || val > 300) {
      if (hintEl) hintEl.textContent = '올바른 체중을 입력해주세요 (20~300kg).';
      return;
    }

    const minSafe = heightCm > 0
      ? Math.round(18.5 * (heightCm / 100) ** 2 * 10) / 10
      : 30;

    async function applyAndGo() {
      localStorage.setItem(todayKey, String(val));
      Storage.mergeUser({ weight: String(val) });
      const uid = getCurrentUid();
      if (uid && typeof db !== 'undefined') {
        try {
          await db.collection('users').doc(uid).collection('daily').doc(todayStr)
            .set({ weight: val }, { merge: true });
        } catch(err) { console.error(err); }
      }
      location.replace('sc301.html');
    }

    function checkSuddenChange(onPass) {
      if (prevWeight > 0 && Math.abs(val - prevWeight) >= 5) {
        const diff = (val - prevWeight).toFixed(1);
        const sign = Number(diff) > 0 ? '+' : '';
        showCustomConfirm({
          icon: '📊',
          title: '체중 변화가 커요',
          desc: `어제 <strong>${prevWeight}kg</strong> → 오늘 <strong>${val}kg</strong><br>`
              + `하루 차이가 <strong style="color:var(--red)">${sign}${diff}kg</strong>이에요.<br><br>`
              + `정말 <strong>${val}kg</strong>으로 저장할까요?`,
          okText: '그래도 저장',
          cancelText: '다시 입력',
          onOk: onPass,
        });
      } else {
        onPass();
      }
    }

    if (val < minSafe) {
      showCustomConfirm({
        icon: '⚖️',
        title: '권장 체중 이하예요',
        desc: `입력한 <strong>${val}kg</strong>은 키 <strong>${heightCm}cm</strong> 기준<br>`
            + `최저 권장 체중 <strong style="color:var(--teal)">${minSafe}kg</strong>(BMI 18.5)보다 낮아요.`,
        okText: '그래도 저장',
        cancelText: '다시 입력',
        danger: true,
        onOk: () => checkSuddenChange(applyAndGo),
      });
    } else {
      checkSuddenChange(applyAndGo);
    }
  }

  saveBtn?.addEventListener('click', doSave);
  input?.addEventListener('keydown', e => { if (e.key === 'Enter') doSave(); });
  skipBtn?.addEventListener('click', () => location.replace('sc301.html'));

  /* 입력 필드 자동 포커스 */
  setTimeout(() => input?.focus(), 300);
}
