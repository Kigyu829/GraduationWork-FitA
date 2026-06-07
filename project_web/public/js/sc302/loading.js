'use strict';

/* ============================================================
   sc302/loading.js — 로딩 UI 및 분기 처리
   의존: utils.js (MESSAGES, STEPS), api.js (fetchAiPlans)
   ============================================================ */

/* ── 당일 플랜 안내 카드 표시 ── */
function showAlreadyPlanCard() {
  document.getElementById('loadingCard')?.style.setProperty('display', 'none');
  const card = document.getElementById('alreadyPlanCard');
  if (card) card.style.display = '';

  document.getElementById('btnBackToDash')?.addEventListener('click', () => {
    location.href = 'sc301.html';
  });

  document.getElementById('btnOpenAiChat')?.addEventListener('click', () => {
    /* AI 상담 오버레이 열기 — sc311에서 더 풍부한 상담 가능하므로 이동 후 열기 */
    location.href = 'sc311.html?openChat=1';
  });
}

/* ── 서버 연결 실패 UI ── */
function showPlanError() {
  const card = document.getElementById('loadingCard');
  if (!card) return;
  card.innerHTML = `
    <div style="text-align:center;padding:8px 0;">
      <div style="font-size:48px;margin-bottom:16px;">😔</div>
      <div style="font-size:18px;font-weight:700;color:var(--text,#fff);margin-bottom:8px;">AI 서버에 연결할 수 없어요</div>
      <div style="font-size:13px;color:var(--text-sec,rgba(255,255,255,0.6));line-height:1.7;margin-bottom:24px;">
        서버가 실행 중인지 확인하거나<br>잠시 후 다시 시도해주세요.
      </div>
      <button class="primary-btn" onclick="location.reload()" style="margin-bottom:10px;">
        🔄 다시 시도
      </button>
      <button class="secondary-btn" onclick="location.href='sc301.html'">
        건너뛰고 홈으로
      </button>
    </div>
  `;
}

/* ── 로딩 시퀀스 ── */
function startLoadingSequence() {
  const msgEl = document.getElementById('loadingMsg');
  const pctEl = document.getElementById('loadingPct');

  /* API 호출 — 실패 여부 추적 */
  let plansFailed = false;
  const plansPromise = fetchAiPlans().catch(err => {
    console.warn('[sc302] AI 플랜 로드 실패:', err.message);
    plansFailed = true;
  });

  /* 메시지 순환 */
  let msgIdx = 0;
  const msgInterval = setInterval(() => {
    if (!msgEl) return;
    msgEl.classList.add('fade');
    setTimeout(() => {
      msgIdx = (msgIdx + 1) % MESSAGES.length;
      msgEl.textContent = MESSAGES[msgIdx];
      msgEl.classList.remove('fade');
    }, 400);
  }, 1800);

  /* 단계 진행 */
  const totalDuration = STEPS.reduce((s, st) => s + st.duration, 0);
  let elapsed = 0;

  STEPS.forEach((step, i) => {
    setTimeout(() => {
      if (i > 0) {
        document.getElementById(STEPS[i - 1].id)?.classList.replace('active', 'done');
      }
      document.getElementById(step.id)?.classList.add('active');

      elapsed += step.duration;
      const pct = Math.round((elapsed / totalDuration) * 100);
      if (pctEl) pctEl.textContent = `${pct}% 완료`;
    }, STEPS.slice(0, i).reduce((s, st) => s + st.duration, 0));
  });

  /* 애니메이션 완료 후 API 응답 대기 → 결과에 따라 분기 */
  setTimeout(async () => {
    clearInterval(msgInterval);
    document.getElementById(STEPS[STEPS.length - 1].id)?.classList.replace('active', 'done');
    if (msgEl) msgEl.textContent = '서버 응답을 기다리는 중...';

    await plansPromise;

    if (plansFailed || !Storage.getUser().aiMealPlan) {
      showPlanError();
      return;
    }

    if (msgEl) msgEl.textContent = '✅ 플랜이 완성되었어요!';
    if (pctEl) pctEl.textContent = '100% 완료';

    setTimeout(() => { location.href = 'sc301.html'; }, 700);

  }, totalDuration);
}
