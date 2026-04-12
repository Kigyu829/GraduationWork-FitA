/* hc403.js — 판독 결과 + 인증 (CNN 서버 연동)
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

  /* 사진 로드 후 애니메이션 시작 */
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

    /* hc402에서 저장한 CNN 결과 읽기 */
    setTimeout(renderFromCnn, 400);
  }

  /* ══════════════════════════════════
     CNN 결과 렌더 (hc402에서 sessionStorage에 저장한 값 사용)
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

  /* ══════════════════════════════════
     판독 결과 UI 렌더
  ══════════════════════════════════ */
  function renderResult(data) {
    const matchBadge  = document.getElementById('matchBadge');
    const foodName    = document.getElementById('foodName');
    const nutrientsEl = document.getElementById('resultNutrients');
    const memoEl      = document.getElementById('resultMemo');

    const matchPct = Math.round(data.confidence * 100);

    /* 인식률 뱃지 */
    if (matchBadge) {
      matchBadge.textContent = `${data.detected_food_kr} ${matchPct}% 인식`;
      matchBadge.classList.remove('high', 'mid', 'low');
      if (matchPct >= 70)      matchBadge.classList.add('high');
      else if (matchPct >= 45) matchBadge.classList.add('mid');
      else                     matchBadge.classList.add('low');
    }

    if (foodName) foodName.textContent = data.detected_food_kr;

    /* Top 5 인식 결과 */
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

    /* 버튼 바인딩 */
    bindButtons();
  }

  /* ── 오류 시 UI ── */
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
  }

  /* ── 버튼 공통 바인딩 ── */
  function bindButtons() {
    document.getElementById('retakeBtn')?.addEventListener('click', () => {
      sessionStorage.removeItem('uploadedPhoto');
      sessionStorage.removeItem('uploadedPhotoName');
      sessionStorage.removeItem('cnnResult');
      navigateTo('sc401.html');
    });
    document.getElementById('certBtn')?.addEventListener('click', showCertSuccess);
  }

  /* ── 인증 완료 팝업 ── */
  function showCertSuccess() {
    const uploadParams = new URLSearchParams(sessionStorage.getItem('uploadParams') || '');
    const mealType     = uploadParams.get('meal') || 'breakfast';
    const mealKcal     = parseInt(uploadParams.get('kcal') || '0', 10);
    const expectedFood = uploadParams.get('mainFood') || '';

    /* CNN이 인식한 음식 이름 */
    let detectedFood = '';
    try {
      const cnnData = JSON.parse(sessionStorage.getItem('cnnResult'));
      detectedFood  = cnnData?.data?.detected_food_kr || '';
    } catch(e) {}

    /* 음식 일치 여부 (공백 제거 후 포함 여부로 느슨하게 비교) */
    function isFoodMatch() {
      if (!expectedFood || !detectedFood) return true;
      const norm = s => s.replace(/\s/g, '').toLowerCase();
      return norm(detectedFood).includes(norm(expectedFood)) ||
             norm(expectedFood).includes(norm(detectedFood));
    }

    /* localStorage에 인증 상태 저장 (food: 실제 인증된 음식명) */
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
      sc311State.meals[mealType] = { verified: true, kcal: mealKcal, food: food || '' };
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

    /* 성공 오버레이 */
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

    /* 불일치 강제 인증 후 격려 오버레이 */
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
      /* 음식 불일치 경고 팝업 */
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

/* drawer.js — 슬라이드 사이드바 공통
   의존: common.js
*/
'use strict';

window.addEventListener('DOMContentLoaded', () => {
  const toggle  = document.getElementById('drawerToggle');
  const drawer  = document.getElementById('drawer');
  const overlay = document.getElementById('drawerOverlay');
  const close   = document.getElementById('drawerClose');
  const logout  = document.getElementById('drawerLogout');

  function openDrawer() {
    drawer?.classList.add('open');
    overlay?.classList.add('show');
  }

  function closeDrawer() {
    drawer?.classList.remove('open');
    overlay?.classList.remove('show');
  }

  toggle?.addEventListener('click', openDrawer);
  close?.addEventListener('click', closeDrawer);
  overlay?.addEventListener('click', closeDrawer);

  /* ESC 키로 닫기 */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeDrawer();
  });

  /* 메뉴 버튼 네비게이션 */
  drawer?.querySelectorAll('.drawer-menu-btn[data-href]').forEach(btn => {
    btn.addEventListener('click', () => {
      navigateTo(btn.dataset.href);
    });
  });

  /* 로그아웃 */
  logout?.addEventListener('click', () => {
    localStorage.removeItem('healthUserData');
    navigateTo('sc101.html');
  });
});