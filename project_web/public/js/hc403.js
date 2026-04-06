/* hc403.js — 판독 결과 + 인증 (Gemini Vision API 연동)
   의존: common.js
*/
'use strict';

/* ══════════════════════════════════
   ▼ Gemini API 키를 여기에 입력하세요
══════════════════════════════════ */
const GEMINI_API_KEY = 'AIzaSyDCOo8yJY2b2Up17ZUvVOiJeBxq82sMX8A';

/* Gemini 모델 */
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

/* ── Gemini에게 보낼 프롬프트 ── */
const ANALYSIS_PROMPT = `
이 사진에 있는 음식을 분석해주세요.
반드시 아래 JSON 형식으로만 응답하고, 다른 텍스트는 절대 포함하지 마세요.

{
  "name": "음식 이름 (한국어)",
  "match": 일치율 숫자 (0~100, 식단 계획과의 건강도 기준),
  "kcal": 칼로리 숫자 (정수),
  "carb": 탄수화물g (정수),
  "protein": 단백질g (정수),
  "fat": 지방g (정수),
  "memo": "식단 분석 한 줄 코멘트 (한국어)"
}
`.trim();

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

    /* API 호출 */
    setTimeout(analyzeWithGemini, 400);
  }

  /* ══════════════════════════════════
     Gemini Vision API 호출
  ══════════════════════════════════ */
  async function analyzeWithGemini() {
    /* base64 데이터 추출 (data:image/xxx;base64, 부분 제거) */
    const base64Data  = photo.split(',')[1];
    const mimeType    = photo.split(';')[0].split(':')[1]; // e.g. "image/jpeg"

    try {
      const response = await fetch(GEMINI_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64Data,
                }
              },
              { text: ANALYSIS_PROMPT }
            ]
          }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 512,
          }
        })
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        const errMsg  = errBody?.error?.message || response.statusText;
        throw new Error(`API 오류 ${response.status}: ${errMsg}`);
      }

      const data = await response.json();

      /* Gemini 응답에서 텍스트 추출 */
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

      /* JSON 파싱 — 코드블록 마크다운 제거 후 파싱 */
      const jsonText = rawText.replace(/```json|```/g, '').trim();
      const food = JSON.parse(jsonText);

      renderResult(food);

    } catch (err) {
      console.error('Gemini 분석 실패:', err);
      renderError(err.message);
    }
  }

  /* ══════════════════════════════════
     판독 결과 UI 렌더
  ══════════════════════════════════ */
  function renderResult(food) {
    const matchBadge  = document.getElementById('matchBadge');
    const foodName    = document.getElementById('foodName');
    const nutrientsEl = document.getElementById('resultNutrients');
    const memoEl      = document.getElementById('resultMemo');

    /* 일치율 뱃지 */
    if (matchBadge) {
      matchBadge.textContent = `${food.name} ${food.match}% 일치`;
      matchBadge.classList.remove('high', 'mid', 'low');
      if (food.match >= 85)      matchBadge.classList.add('high');
      else if (food.match >= 65) matchBadge.classList.add('mid');
      else                       matchBadge.classList.add('low');
    }

    if (foodName) foodName.textContent = food.name;

    /* 영양 정보 */
    if (nutrientsEl) {
      nutrientsEl.innerHTML = `
        <div class="nutrient-row">
          <span class="nutrient-label">칼로리</span>
          <span class="nutrient-value kcal">${food.kcal} kcal</span>
        </div>
        <div class="nutrient-row">
          <span class="nutrient-label">탄수화물</span>
          <span class="nutrient-value">${food.carb}g</span>
        </div>
        <div class="nutrient-row">
          <span class="nutrient-label">단백질</span>
          <span class="nutrient-value">${food.protein}g</span>
        </div>
        <div class="nutrient-row">
          <span class="nutrient-label">지방</span>
          <span class="nutrient-value">${food.fat}g</span>
        </div>
      `;
    }

    if (memoEl) memoEl.textContent = food.memo;

    /* 버튼 바인딩 */
    bindButtons();
  }

  /* ── API 오류 시 UI ── */
  function renderError(msg) {
    const matchBadge  = document.getElementById('matchBadge');
    const foodName    = document.getElementById('foodName');
    const nutrientsEl = document.getElementById('resultNutrients');
    const memoEl      = document.getElementById('resultMemo');

    if (matchBadge) { matchBadge.textContent = '분석 실패'; matchBadge.classList.add('low'); }
    if (foodName)    foodName.textContent = '판독 오류';
    if (nutrientsEl) nutrientsEl.innerHTML = `<div class="nutrient-row" style="color:var(--red);font-size:12px;">${msg}</div>`;
    if (memoEl)      memoEl.textContent = 'API 키를 확인하거나 다시 시도해주세요.';

    bindButtons();
  }

  /* ── 버튼 공통 바인딩 ── */
  function bindButtons() {
    document.getElementById('retakeBtn')?.addEventListener('click', () => {
      sessionStorage.removeItem('uploadedPhoto');
      sessionStorage.removeItem('uploadedPhotoName');
      navigateTo('sc401.html');
    });
    document.getElementById('certBtn')?.addEventListener('click', showCertSuccess);
  }

  /* ── 인증 완료 팝업 ── */
  function showCertSuccess() {
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

    /* ── sc301 대시보드 체크 연동 (check_ 키) ── */
    const checkKey = `check_${dateStr}`;
    try {
      const state = JSON.parse(localStorage.getItem(checkKey)) || { meal: false, workout: false };
      state.meal  = true;
      localStorage.setItem(checkKey, JSON.stringify(state));
    } catch(e) {
      localStorage.setItem(checkKey, JSON.stringify({ meal: true, workout: false }));
    }

    /* ── sc311 식단 인증 상태 연동 (sc311_ 키) ── */
    /* sc401에서 넘어온 URL 파라미터로 어느 끼니인지, 칼로리가 얼마인지 확인 */
    const params    = new URLSearchParams(sessionStorage.getItem('uploadParams') || '');
    const mealType  = params.get('meal') || 'breakfast';
    const mealKcal  = parseInt(params.get('kcal') || '0', 10);
    const sc311Key  = `sc311_${dateStr}`;
    try {
      const sc311State = JSON.parse(localStorage.getItem(sc311Key)) || { meals: {}, workouts: {} };
      sc311State.meals[mealType] = { verified: true, kcal: mealKcal };
      localStorage.setItem(sc311Key, JSON.stringify(sc311State));
    } catch(e) {
      localStorage.setItem(sc311Key, JSON.stringify({ meals: { [mealType]: { verified: true, kcal: mealKcal } }, workouts: {} }));
    }

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

    requestAnimationFrame(() => {
      requestAnimationFrame(() => overlay.classList.add('show'));
    });

    overlay.querySelector('#certDoneBtn')?.addEventListener('click', () => {
      sessionStorage.removeItem('uploadedPhoto');
      sessionStorage.removeItem('uploadedPhotoName');
      navigateTo('sc301.html');
    });
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