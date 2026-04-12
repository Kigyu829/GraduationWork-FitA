/* hc403.js — 판독 결과 + 인증 + 치팅/단식 기록 (CNN 서버 연동)
   의존: common.js
*/
'use strict';

window.addEventListener('DOMContentLoaded', () => {
  const photo = sessionStorage.getItem('uploadedPhoto');
  if (!photo) {
    location.href = 'sc401.html';
    return;
  }

  const photoEl     = document.getElementById('resultPhoto');
  const photoPanel  = document.getElementById('photoPanel');
  const resultPanel = document.getElementById('resultPanel');

  photoEl.src = photo;

  photoEl.onload = startAnimation;
  if (photoEl.complete) startAnimation();

  function startAnimation() {
    setTimeout(() => {
      document.getElementById('resultContainer')?.classList.add('show');
    }, 60);
    setTimeout(() => {
      photoPanel?.classList.add('slide-in');
    }, 80);
    setTimeout(() => {
      resultPanel?.classList.add('fade-in');
    }, 300);
    setTimeout(renderFromCnn, 400);
  }

  /* ══════════════════════════════════
     CNN 결과 렌더
  ══════════════════════════════════ */
  function renderFromCnn() {
    const raw = sessionStorage.getItem('cnnResult');
    if (!raw) {
      renderError('CNN 분석 결과가 없습니다. 다시 시도해주세요.');
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      if (!parsed.success) throw new Error(parsed.error || 'CNN 분석 실패');
      renderResult(parsed.data);
    } catch (err) {
      console.error('CNN 결과 처리 실패:', err);
      renderError(err.message);
    }
  }

  function renderResult(data) {
    const matchBadge  = document.getElementById('matchBadge');
    const foodName    = document.getElementById('foodName');
    const nutrientsEl = document.getElementById('resultNutrients');
    const memoEl      = document.getElementById('resultMemo');

    const matchPct = Math.round(data.confidence * 100);

    if (matchBadge) {
      matchBadge.textContent = `${data.detected_food_kr} ${matchPct}% 인식`;
      matchBadge.classList.remove('high', 'mid', 'low');
      if (matchPct >= 70)      matchBadge.classList.add('high');
      else if (matchPct >= 45) matchBadge.classList.add('mid');
      else                     matchBadge.classList.add('low');
    }

    if (foodName) foodName.textContent = data.detected_food_kr;

    if (nutrientsEl) {
      const top5 = data.top_5 || [];
      if (top5.length > 0) {
        nutrientsEl.innerHTML = top5.map((item, i) => `
          <div class="nutrient-row">
            <span class="nutrient-label">${i + 1}순위</span>
            <span class="nutrient-value${i === 0 ? ' kcal' : ''}">
              ${item.class_name_kr || item.class_name} (${Math.round(item.confidence * 100)}%)
            </span>
          </div>
        `).join('');
      } else {
        nutrientsEl.innerHTML = `
          <div class="nutrient-row">
            <span class="nutrient-label">인식 결과</span>
            <span class="nutrient-value kcal">${data.detected_food_kr}</span>
          </div>
          <div class="nutrient-row">
            <span class="nutrient-label">신뢰도</span>
            <span class="nutrient-value">${matchPct}%</span>
          </div>
        `;
      }
    }

    if (memoEl) {
      memoEl.textContent = data.is_verified
        ? `CNN 모델이 ${data.detected_food_kr}(으)로 인식했습니다.`
        : `신뢰도가 낮습니다 (${matchPct}%). 다른 각도로 재촬영을 권장합니다.`;
    }

    bindButtons();
    bindSkipButtons();  /* 치팅/단식 버튼 바인딩 */
  }

  function renderError(msg) {
    const matchBadge  = document.getElementById('matchBadge');
    const foodName    = document.getElementById('foodName');
    const nutrientsEl = document.getElementById('resultNutrients');
    const memoEl      = document.getElementById('resultMemo');

    if (matchBadge) { matchBadge.textContent = '분석 실패'; matchBadge.classList.add('low'); }
    if (foodName)    foodName.textContent = '판독 오류';
    if (nutrientsEl) nutrientsEl.innerHTML = `<div class="nutrient-row" style="color:var(--red);font-size:12px;">${msg}</div>`;
    if (memoEl)      memoEl.textContent = 'CNN 서버가 실행 중인지 확인하거나 다시 시도해주세요.';

    bindButtons();
    bindSkipButtons();
  }

  /* ── 인증 버튼 ── */
  function bindButtons() {
    document.getElementById('retakeBtn')?.addEventListener('click', () => {
      sessionStorage.removeItem('uploadedPhoto');
      sessionStorage.removeItem('uploadedPhotoName');
      sessionStorage.removeItem('cnnResult');
      navigateTo('sc401.html');
    });
    document.getElementById('certBtn')?.addEventListener('click', showCertSuccess);
  }

  /* ══════════════════════════════════
     치팅/단식 버튼 바인딩
  ══════════════════════════════════ */
  let skipMode = 'cheat'; /* 'cheat' | 'fast' */
  let eatType  = 'partial'; /* 'partial' | 'all' */

  function bindSkipButtons() {
    const cheatBtn  = document.getElementById('cheatBtn');
    const fastBtn   = document.getElementById('fastBtn');
    const overlay   = document.getElementById('skipModalOverlay');
    const cancelBtn = document.getElementById('skipCancelBtn');
    const confirmBtn = document.getElementById('skipConfirmBtn');

    /* 치팅 버튼 */
    cheatBtn?.addEventListener('click', () => {
      skipMode = 'cheat';
      document.getElementById('skipModalIcon').textContent  = '🍕';
      document.getElementById('skipModalTitle').textContent = '치팅 기록';
      document.getElementById('skipModalSub').textContent   = '어떤 메뉴를 드셨나요? 메모를 남겨주세요.';
      document.getElementById('skipTypeRow').style.display  = 'flex';
      document.getElementById('skipReason').placeholder     = '예) 점심에 피자를 먹었어요 / 저녁 케이크 추가';
      document.getElementById('skipReason').value           = '';
      openSkipModal();
    });

    /* 단식 버튼 */
    fastBtn?.addEventListener('click', () => {
      skipMode = 'fast';
      document.getElementById('skipModalIcon').textContent  = '🚫';
      document.getElementById('skipModalTitle').textContent = '단식 기록';
      document.getElementById('skipModalSub').textContent   = '안 드신 이유를 간단히 남겨주세요.';
      document.getElementById('skipTypeRow').style.display  = 'flex';
      document.getElementById('skipReason').placeholder     = '예) 몸이 좋지 않아서 / 의도적으로 건너뜀';
      document.getElementById('skipReason').value           = '';
      openSkipModal();
    });

    /* 부분/전부 타입 토글 */
    document.querySelectorAll('.skip-type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.skip-type-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        eatType = btn.dataset.type;
      });
    });

    /* 취소 */
    cancelBtn?.addEventListener('click', closeSkipModal);
    overlay?.addEventListener('click', e => { if (e.target === overlay) closeSkipModal(); });

    /* 기록하기 */
    confirmBtn?.addEventListener('click', () => {
      const reason = document.getElementById('skipReason')?.value.trim();
      saveSkipRecord(skipMode, eatType, reason);
      closeSkipModal();
    });
  }

  function openSkipModal() {
    const overlay = document.getElementById('skipModalOverlay');
    overlay?.classList.add('show');
  }

  function closeSkipModal() {
    const overlay = document.getElementById('skipModalOverlay');
    overlay?.classList.remove('show');
  }

  /* ══════════════════════════════════
     치팅/단식 기록 저장 → sc311 전달
  ══════════════════════════════════ */
  function saveSkipRecord(mode, type, reason) {
    const uploadParams = new URLSearchParams(sessionStorage.getItem('uploadParams') || '');
    const mealType     = uploadParams.get('meal') || 'breakfast';
    const mealKcal     = parseInt(uploadParams.get('kcal') || '0', 10);

    const today    = new Date();
    const dateStr  = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    const sc311Key = `sc311_${dateStr}`;

    let sc311State;
    try {
      sc311State = JSON.parse(localStorage.getItem(sc311Key)) || { meals: {}, workouts: {} };
    } catch(e) {
      sc311State = { meals: {}, workouts: {} };
    }

    /* 끼니 상태에 치팅/단식 정보 저장 */
    sc311State.meals[mealType] = {
      verified: true,           /* 인증 완료로 처리 */
      kcal:     type === 'all' ? 0 : mealKcal,
      skipMode: mode,           /* 'cheat' | 'fast' */
      eatType:  type,           /* 'partial' | 'all' */
      reason:   reason || '',
      food:     mode === 'cheat' ? (reason || '치팅') : '단식',
    };

    localStorage.setItem(sc311Key, JSON.stringify(sc311State));

    /* 전체 식단 달성 체크 업데이트 */
    const allVerified = ['breakfast', 'lunch', 'dinner']
      .every(k => sc311State.meals[k]?.verified);
    const checkKey = `check_${dateStr}`;
    try {
      const state = JSON.parse(localStorage.getItem(checkKey)) || { meal: false, workout: false };
      state.meal  = allVerified;
      localStorage.setItem(checkKey, JSON.stringify(state));
    } catch(e) {
      localStorage.setItem(checkKey, JSON.stringify({ meal: allVerified, workout: false }));
    }

    /* 완료 오버레이 */
    const modeLabel = mode === 'cheat' ? '치팅' : '단식';
    const typeLabel = type === 'all' ? '전부 안 먹음' : '일부만 먹음';
    showSkipDoneOverlay(modeLabel, typeLabel, reason);
  }

  function showSkipDoneOverlay(modeLabel, typeLabel, reason) {
    const overlay = document.createElement('div');
    overlay.className = 'cert-overlay';
    overlay.innerHTML = `
      <div class="cert-popup">
        <div class="cert-popup-icon">${modeLabel === '치팅' ? '🍕' : '🚫'}</div>
        <div class="cert-popup-title">${modeLabel} 기록 완료</div>
        <div class="cert-popup-sub">
          <strong>${typeLabel}</strong>으로 기록됐어요.<br>
          ${reason ? `<span style="color:var(--text-mute);font-size:12px;">"${reason}"</span><br>` : ''}
          <br>오늘도 건강한 하루 보내세요! 💪
        </div>
        <button class="primary-btn cert-popup-btn" id="skipDoneBtn">확인</button>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('show')));

    overlay.querySelector('#skipDoneBtn')?.addEventListener('click', () => {
      sessionStorage.removeItem('uploadedPhoto');
      sessionStorage.removeItem('uploadedPhotoName');
      sessionStorage.removeItem('cnnResult');
      navigateTo('sc311.html');
    });
  }

  /* ══════════════════════════════════
     인증 완료 팝업 (기존 로직 유지)
  ══════════════════════════════════ */
  function showCertSuccess() {
    const uploadParams = new URLSearchParams(sessionStorage.getItem('uploadParams') || '');
    const mealType     = uploadParams.get('meal') || 'breakfast';
    const mealKcal     = parseInt(uploadParams.get('kcal') || '0', 10);
    const expectedFood = uploadParams.get('mainFood') || '';

    let detectedFood = '';
    try {
      const cnnData = JSON.parse(sessionStorage.getItem('cnnResult'));
      detectedFood  = cnnData?.data?.detected_food_kr || '';
    } catch(e) {}

    function isFoodMatch() {
      if (!expectedFood || !detectedFood) return true;
      const norm = s => s.replace(/\s/g, '').toLowerCase();
      return norm(detectedFood).includes(norm(expectedFood)) ||
             norm(expectedFood).includes(norm(detectedFood));
    }

    function doVerify(food) {
      const today   = new Date();
      const dateStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
      const sc311Key = `sc311_${dateStr}`;
      let sc311State;
      try {
        sc311State = JSON.parse(localStorage.getItem(sc311Key)) || { meals: {}, workouts: {} };
      } catch(e) {
        sc311State = { meals: {}, workouts: {} };
      }
      sc311State.meals[mealType] = {
        verified: true,
        kcal:     mealKcal,
        food:     food || '',
        skipMode: null,
        eatType:  'full',
        reason:   '',
      };
      localStorage.setItem(sc311Key, JSON.stringify(sc311State));

      const checkKey    = `check_${dateStr}`;
      const allVerified = ['breakfast', 'lunch', 'dinner']
        .every(k => sc311State.meals[k]?.verified);
      try {
        const state = JSON.parse(localStorage.getItem(checkKey)) || { meal: false, workout: false };
        state.meal  = allVerified;
        localStorage.setItem(checkKey, JSON.stringify(state));
      } catch(e) {
        localStorage.setItem(checkKey, JSON.stringify({ meal: allVerified, workout: false }));
      }
    }

    function showSuccessOverlay() {
      const overlay = document.createElement('div');
      overlay.className = 'cert-overlay';
      overlay.innerHTML = `
        <div class="cert-popup">
          <div class="cert-popup-icon">🎉</div>
          <div class="cert-popup-title">인증 완료!</div>
          <div class="cert-popup-sub">오늘의 식단이 성공적으로 인증됐어요.<br>대시보드에서 확인해보세요!</div>
          <button class="primary-btn cert-popup-btn" id="certDoneBtn">대시보드로 이동</button>
        </div>
      `;
      document.body.appendChild(overlay);
      requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('show')));
      overlay.querySelector('#certDoneBtn')?.addEventListener('click', () => {
        sessionStorage.removeItem('uploadedPhoto');
        sessionStorage.removeItem('uploadedPhotoName');
        sessionStorage.removeItem('cnnResult');
        navigateTo('sc301.html');
      });
    }

    function showEncouragementOverlay(food) {
      const overlay = document.createElement('div');
      overlay.className = 'cert-overlay';
      overlay.innerHTML = `
        <div class="cert-popup">
          <div class="cert-popup-icon">😊</div>
          <div class="cert-popup-title">인증 완료!</div>
          <div class="cert-popup-sub">
            <strong>${food}</strong>(으)로 인증됐어요.<br><br>
            다음엔 식단대로 지켜봐요! 꾸준하게 하다 보면 목표에 가까워질 거예요 💪
          </div>
          <button class="primary-btn cert-popup-btn" id="certEncourageDoneBtn">대시보드로 이동</button>
        </div>
      `;
      document.body.appendChild(overlay);
      requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('show')));
      overlay.querySelector('#certEncourageDoneBtn')?.addEventListener('click', () => {
        sessionStorage.removeItem('uploadedPhoto');
        sessionStorage.removeItem('uploadedPhotoName');
        sessionStorage.removeItem('cnnResult');
        navigateTo('sc301.html');
      });
    }

    if (!isFoodMatch()) {
      const mismatch = document.createElement('div');
      mismatch.className = 'cert-overlay';
      mismatch.innerHTML = `
        <div class="cert-popup">
          <div class="cert-popup-icon">⚠️</div>
          <div class="cert-popup-title">음식이 달라요</div>
          <div class="cert-popup-sub">
            인증 음식: <strong>${expectedFood}</strong><br>
            CNN 인식 결과: <strong>${detectedFood}</strong><br><br>
            다른 음식으로 인식됐어요. 그래도 인증할까요?
          </div>
          <div style="display:flex;flex-direction:column;gap:10px;margin-top:8px;">
            <button class="primary-btn" id="forceVerifyBtn">그래도 인증</button>
            <button class="primary-btn" id="retakeMismatchBtn"
              style="background:var(--card,#2a2a3a);color:var(--text,#fff);border:1px solid var(--border,#444);">
              다시 찍기
            </button>
            <button class="skip-btn cheat-btn" id="mismatchCheatBtn"
              style="background:rgba(245,166,35,0.12);border-color:rgba(245,166,35,0.4);color:#F5A623;">
              🍕 치팅으로 기록
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(mismatch);
      requestAnimationFrame(() => requestAnimationFrame(() => mismatch.classList.add('show')));

      mismatch.querySelector('#retakeMismatchBtn')?.addEventListener('click', () => {
        sessionStorage.removeItem('uploadedPhoto');
        sessionStorage.removeItem('uploadedPhotoName');
        sessionStorage.removeItem('cnnResult');
        navigateTo('sc401.html');
      });

      mismatch.querySelector('#forceVerifyBtn')?.addEventListener('click', () => {
        mismatch.remove();
        doVerify(detectedFood);
        showEncouragementOverlay(detectedFood);
      });

      /* 불일치 시 치팅으로 바로 기록 */
      mismatch.querySelector('#mismatchCheatBtn')?.addEventListener('click', () => {
        mismatch.remove();
        saveSkipRecord('cheat', 'partial', `식단과 다른 음식: ${detectedFood}`);
        closeSkipModal();
      });
      return;
    }

    doVerify(expectedFood || detectedFood);
    showSuccessOverlay();
  }
});

/* ── 페이지 전환 헬퍼 ── */
function navigateTo(url) {
  document.body.classList.add('page-exit');
  setTimeout(() => { location.href = url; }, 320);
}

/* drawer.js */
'use strict';

window.addEventListener('DOMContentLoaded', () => {
  const toggle  = document.getElementById('drawerToggle');
  const drawer  = document.getElementById('drawer');
  const overlay = document.getElementById('drawerOverlay');
  const close   = document.getElementById('drawerClose');
  const logout  = document.getElementById('drawerLogout');

  function openDrawer()  { drawer?.classList.add('open');    overlay?.classList.add('show'); }
  function closeDrawer() { drawer?.classList.remove('open'); overlay?.classList.remove('show'); }

  toggle?.addEventListener('click', openDrawer);
  close?.addEventListener('click',  closeDrawer);
  overlay?.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });

  drawer?.querySelectorAll('.drawer-menu-btn[data-href]').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.href));
  });

  logout?.addEventListener('click', () => {
    localStorage.removeItem('healthUserData');
    navigateTo('sc101.html');
  });
});