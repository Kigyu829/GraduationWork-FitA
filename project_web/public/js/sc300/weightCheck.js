'use strict';

/* ============================================================
   sc300/weightCheck.js — 체중 입력 · 저장 · 검증 로직
   의존: sc300/utils.js, common.js
   ============================================================ */

function initPage() {
  const data = Storage.getUser();

  /* 프로필 미완성이면 홈으로 (온보딩 먼저) */
  if (!data.weight || !data.height || !data.targetWeight) {
    location.replace('sc301.html');
    return;
  }

  /* 오늘 체중 이미 입력됐으면 홈으로 */
  const today    = new Date();
  const todayStr = todayDateStr();
  const todayKey = `todayWeight_${lsKey('check', todayStr)}`;
  if (localStorage.getItem(todayKey)) {
    location.replace('sc301.html');
    return;
  }

  /* ── 날짜 ── */
  const weekNames = ['일','월','화','수','목','금','토'];
  const dateEl = document.getElementById('wcDate');
  if (dateEl) {
    dateEl.textContent =
      `${today.getFullYear()}년 ${today.getMonth()+1}월 ${today.getDate()}일 (${weekNames[today.getDay()]})`;
  }

  /* ── 닉네임 인사 ── */
  const reg  = Storage.getRegistered();
  const nick = reg.nickname || '';
  const greetEl = document.getElementById('wcGreeting');
  if (greetEl && nick) greetEl.textContent = `안녕하세요, ${nick}님! 👋`;

  /* ── 전날 체중 힌트 ── */
  const prevDate = new Date(today);
  prevDate.setDate(today.getDate() - 1);
  const prevDateStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth()+1).padStart(2,'0')}-${String(prevDate.getDate()).padStart(2,'0')}`;
  const prevKey    = `todayWeight_${lsKey('check', prevDateStr)}`;
  const prevWeight = parseFloat(localStorage.getItem(prevKey) || data.weight || 0);

  const prevEl = document.getElementById('wcPrev');
  if (prevEl && prevWeight > 0) {
    prevEl.textContent = `어제 체중: ${prevWeight}kg`;
  }

  /* ── 목표 진행 바 ── */
  const initialWeight = Number(data.initialWeight || data.weight || 0);
  const targetWeight  = Number(data.targetWeight  || 0);
  const barWrap = document.getElementById('wcGoalBarWrap');
  const goalFill = document.getElementById('wcGoalFill');
  const startLabel = document.getElementById('wcGoalStartLabel');
  const endLabel   = document.getElementById('wcGoalEndLabel');

  if (initialWeight > targetWeight && barWrap) {
    barWrap.style.display = 'block';
    if (startLabel) startLabel.textContent = `시작 ${initialWeight}kg`;
    if (endLabel)   endLabel.textContent   = `목표 ${targetWeight}kg`;
    const pct = Math.min(100, Math.max(0,
      Math.round(((initialWeight - Number(data.weight)) / (initialWeight - targetWeight)) * 100)
    ));
    if (goalFill) setTimeout(() => { goalFill.style.width = `${pct}%`; }, 80);
  }

  /* ── 엘리먼트 참조 ── */
  const input   = document.getElementById('wcInput');
  const bmiEl   = document.getElementById('wcBmiPreview');
  const hintEl  = document.getElementById('wcHint');
  const saveBtn = document.getElementById('wcSaveBtn');
  const skipBtn = document.getElementById('wcSkipBtn');
  const heightCm = Number(data.height || 0);

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
