/* hc403.js — 판독 결과 + 인증 (CNN 서버 연동)
   의존: common.js

   [메뉴 불일치 흐름]
   1. CNN 인식 음식이 AI 플랜 메뉴에 없으면 → reason-panel 노출
   2. 단식  → kcal=0,      reason='fasting'  으로 doVerify
   3. 치팅  → kcal=원래값, reason='cheating' 으로 doVerify
   4. 기타  → 사용자 입력 텍스트를 reason으로 doVerify
   5. 일반 인증(메뉴 일치) → 기존 certBtn 흐름 유지
*/
'use strict';

window.addEventListener('DOMContentLoaded', () => {
  const photo = sessionStorage.getItem('uploadedPhoto');
  if (!photo) {
    location.href = 'sc401.html';
    return;
  }

  const photoEl    = document.getElementById('resultPhoto');
  const photoPanel = document.getElementById('photoPanel');
  const resultPanel = document.getElementById('resultPanel');

  photoEl.src = photo;

  photoEl.onload = startAnimation;
  if (photoEl.complete) startAnimation();

  function startAnimation() {
    setTimeout(() => { document.getElementById('resultContainer')?.classList.add('show'); }, 60);
    setTimeout(() => { photoPanel?.classList.add('slide-in'); }, 80);
    setTimeout(() => { resultPanel?.classList.add('fade-in'); }, 300);
    setTimeout(renderFromCnn, 400);
  }

  /* ══════════════════════════════════
     CNN 결과 렌더
  ══════════════════════════════════ */
  function renderFromCnn() {
    const raw = sessionStorage.getItem('cnnResult');
    if (!raw) { renderError('CNN 분석 결과가 없습니다. 다시 시도해주세요.'); return; }
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
    const foodNameEl  = document.getElementById('foodName');
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
    if (foodNameEl) foodNameEl.textContent = data.detected_food_kr;

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

    bindButtons(data.detected_food_kr);
  }

  /* ── 오류 시 UI ── */
  function renderError(msg) {
    const matchBadge  = document.getElementById('matchBadge');
    const foodNameEl  = document.getElementById('foodName');
    const nutrientsEl = document.getElementById('resultNutrients');
    const memoEl      = document.getElementById('resultMemo');

    if (matchBadge) { matchBadge.textContent = '분석 실패'; matchBadge.classList.add('low'); }
    if (foodNameEl)  foodNameEl.textContent = '판독 오류';
    if (nutrientsEl) nutrientsEl.innerHTML = `<div class="nutrient-row" style="color:var(--red);font-size:12px;">${msg}</div>`;
    if (memoEl)      memoEl.textContent = 'CNN 서버가 실행 중인지 확인하거나 다시 시도해주세요.';

    bindButtons('');
  }

  /* ══════════════════════════════════
     버튼 바인딩
  ══════════════════════════════════ */
  function bindButtons(detectedFood) {
    /* 재업로드 */
    document.getElementById('retakeBtn')?.addEventListener('click', () => {
      sessionStorage.removeItem('uploadedPhoto');
      sessionStorage.removeItem('uploadedPhotoName');
      sessionStorage.removeItem('cnnResult');
      navigateTo('sc401.html');
    });

    /* 인증하기 버튼 */
    document.getElementById('certBtn')?.addEventListener('click', () => {
      handleCertClick(detectedFood);
    });

    /* 사유 패널 버튼들 */
    bindReasonPanel(detectedFood);
  }

  /* ══════════════════════════════════
     인증 클릭 → 메뉴 일치 여부 판단
  ══════════════════════════════════ */
  function handleCertClick(detectedFood) {
    const uploadParams = getUploadParams();
    const expectedFood = uploadParams.expectedFood;

    /* 메뉴에 있는 음식이면 기존 인증 팝업 */
    if (!expectedFood || isMenuMatch(detectedFood, expectedFood)) {
      showCertFlow(detectedFood, null);
    } else {
      /* 메뉴에 없는 음식 → 사유 선택 패널 노출 */
      showReasonPanel();
    }
  }

  /* ══════════════════════════════════
     메뉴 일치 여부 판단
     AI 플랜 전체 메뉴 목록과 비교
  ══════════════════════════════════ */
  function isMenuMatch(detectedFood, expectedFood) {
    if (!detectedFood || !expectedFood) return true;
    const norm = s => s.replace(/\s/g, '').toLowerCase();
    const d = norm(detectedFood);
    const e = norm(expectedFood);

    /* 직접 포함 여부 */
    if (d.includes(e) || e.includes(d)) return true;

    /* AI 플랜 전체 메뉴 토큰과 비교 */
    const userData   = Storage.getUser();
    const mealPlan   = userData.aiMealPlan;
    if (!mealPlan) return false;

    const allMenuTokens = ['breakfast', 'lunch', 'dinner'].flatMap(key => {
      const meal = mealPlan[key];
      if (!meal) return [];
      const menuArr = Array.isArray(meal.menu) ? meal.menu : [meal.menu || ''];
      return menuArr.flatMap(m => m.split(/[,·+\s]+/)).map(norm).filter(Boolean);
    });

    return allMenuTokens.some(token => d.includes(token) || token.includes(d));
  }

  /* ══════════════════════════════════
     사유 패널 노출 / 숨김
  ══════════════════════════════════ */
  function showReasonPanel() {
    const panel      = document.getElementById('reasonPanel');
    const actionsEl  = document.getElementById('resultActions');
    if (panel)     panel.classList.add('show');
    if (actionsEl) actionsEl.style.display = 'none';
  }

  function hideReasonPanel() {
    const panel      = document.getElementById('reasonPanel');
    const actionsEl  = document.getElementById('resultActions');
    if (panel)     panel.classList.remove('show');
    if (actionsEl) actionsEl.style.display = '';
  }

  /* ══════════════════════════════════
     사유 선택 패널 버튼 바인딩
  ══════════════════════════════════ */
  function bindReasonPanel(detectedFood) {
    const uploadParams = getUploadParams();

    /* 단식 */
    document.getElementById('reasonFasting')?.addEventListener('click', () => {
      showCustomConfirm({
        icon:    '🚫',
        title:   '단식으로 기록할까요?',
        desc:    '이 끼니의 칼로리가 <strong>0 kcal</strong>으로 처리됩니다.<br>정말 단식으로 기록하시겠어요?',
        confirmText: '네, 단식으로 기록',
        cancelText:  '취소',
        confirmClass: 'danger',
        onConfirm: () => {
          doVerify(detectedFood || '단식', 0, 'fasting');
          showSuccessOverlay('단식으로 기록됐어요. 칼로리는 0으로 처리됐습니다. 💪');
        },
      });
    });

    /* 치팅 */
    document.getElementById('reasonCheating')?.addEventListener('click', () => {
      doVerify(detectedFood || '치팅', uploadParams.mealKcal, 'cheating');
      showEncouragementOverlay(detectedFood || '치팅');
    });

    /* 기타: 채팅 입력 후 인증 */
    document.getElementById('reasonChatSubmit')?.addEventListener('click', () => {
      const input  = document.getElementById('reasonChatInput');
      const reason = input?.value.trim();
      if (!reason) { alert('사유를 입력해주세요.'); return; }
      doVerify(detectedFood || reason, uploadParams.mealKcal, reason);
      showSuccessOverlay(`"${reason}"으로 기록됐어요.`);
    });

    /* Enter 키로도 제출 */
    document.getElementById('reasonChatInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        document.getElementById('reasonChatSubmit')?.click();
      }
    });

    /* 취소 → 일반 인증으로 */
    document.getElementById('reasonCancel')?.addEventListener('click', hideReasonPanel);
  }

  /* ══════════════════════════════════
     공통 인증 흐름 (메뉴 일치 시)
  ══════════════════════════════════ */
  function showCertFlow(detectedFood, forceReason) {
    const uploadParams = getUploadParams();
    const expectedFood = uploadParams.expectedFood;

    if (!forceReason && expectedFood && !isMenuMatch(detectedFood, expectedFood)) {
      /* 불일치 경고 팝업 */
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
          <div style="display:flex;gap:10px;width:100%;">
            <button class="secondary-btn cert-popup-btn" id="mismatchCancelBtn" style="flex:1;">아니요</button>
            <button class="primary-btn cert-popup-btn" id="mismatchOkBtn" style="flex:1;">그래도 인증</button>
          </div>
        </div>
      `;
      document.body.appendChild(mismatch);
      requestAnimationFrame(() => requestAnimationFrame(() => mismatch.classList.add('show')));

      mismatch.querySelector('#mismatchCancelBtn')?.addEventListener('click', () => mismatch.remove());
      mismatch.querySelector('#mismatchOkBtn')?.addEventListener('click', () => {
        mismatch.remove();
        doVerify(detectedFood, uploadParams.mealKcal, 'mismatch');
        showEncouragementOverlay(detectedFood);
      });
    } else {
      doVerify(detectedFood, uploadParams.mealKcal, forceReason || 'matched');
      showSuccessOverlay(null);
    }
  }

  /* ══════════════════════════════════
     localStorage에 인증 상태 저장
     reason: 'matched' | 'fasting' | 'cheating' | 'mismatch' | 기타 텍스트
  ══════════════════════════════════ */
  function doVerify(food, kcal, reason) {
    const uploadParams = getUploadParams();
    const mealType     = uploadParams.mealType;
    const finalKcal    = (reason === 'fasting') ? 0 : (kcal ?? uploadParams.mealKcal);

    const today   = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    const sc311Key = `sc311_${dateStr}`;

    let sc311State;
    try { sc311State = JSON.parse(localStorage.getItem(sc311Key)) || { meals: {}, workouts: {} }; }
    catch(e) { sc311State = { meals: {}, workouts: {} }; }

    sc311State.meals[mealType] = {
      verified: true,
      kcal:     finalKcal,
      food:     food || '',
      reason:   reason || 'matched',
    };
    localStorage.setItem(sc311Key, JSON.stringify(sc311State));

    /* 전체 식단 인증 여부 → check_ 키 업데이트 */
    const checkKey    = `check_${dateStr}`;
    const allVerified = ['breakfast', 'lunch', 'dinner'].every(k => sc311State.meals[k]?.verified);
    try {
      const state = JSON.parse(localStorage.getItem(checkKey)) || { meal: false, workout: false };
      state.meal  = allVerified;
      localStorage.setItem(checkKey, JSON.stringify(state));
    } catch(e) {
      localStorage.setItem(checkKey, JSON.stringify({ meal: allVerified, workout: false }));
    }
  }

  /* ══════════════════════════════════
     성공 오버레이
  ══════════════════════════════════ */
  function showSuccessOverlay(customMsg) {
    const overlay = document.createElement('div');
    overlay.className = 'cert-overlay';
    overlay.innerHTML = `
      <div class="cert-popup">
        <div class="cert-popup-icon">🎉</div>
        <div class="cert-popup-title">인증 완료!</div>
        <div class="cert-popup-sub">${customMsg || '오늘의 식단이 성공적으로 인증됐어요.<br>대시보드에서 확인해보세요!'}</div>
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

  /* ── 치팅/불일치 격려 오버레이 ── */
  function showEncouragementOverlay(food) {
    const overlay = document.createElement('div');
    overlay.className = 'cert-overlay';
    overlay.innerHTML = `
      <div class="cert-popup">
        <div class="cert-popup-icon">😊</div>
        <div class="cert-popup-title">인증 완료!</div>
        <div class="cert-popup-sub">
          <strong>${food}</strong>(으)로 인증됐어요.<br><br>
          꾸준하게 하다 보면 목표에 가까워질 거예요 💪
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

  /* ══════════════════════════════════
     업로드 파라미터 파싱 헬퍼
  ══════════════════════════════════ */
  function getUploadParams() {
    const raw = sessionStorage.getItem('uploadParams') || '';
    const p   = new URLSearchParams(raw);
    return {
      mealType:     p.get('meal')     || 'breakfast',
      mealKcal:     parseInt(p.get('kcal') || '0', 10),
      expectedFood: p.get('mainFood') || '',
    };
  }
});


/* ══════════════════════════════════
   커스텀 Confirm 모달 (confirm() 대체)
   opts: { icon, title, desc, confirmText, cancelText, confirmClass, onConfirm }
   confirmClass: 'primary' | 'danger'
══════════════════════════════════ */
function showCustomConfirm(opts) {
  document.getElementById('customConfirmModal')?.remove();

  const modal = document.createElement('div');
  modal.id        = 'customConfirmModal';
  modal.className = 'custom-confirm-overlay';
  modal.innerHTML = `
    <div class="custom-confirm-box">
      <div class="custom-confirm-icon">${opts.icon || '⚠️'}</div>
      <div class="custom-confirm-title">${opts.title}</div>
      <div class="custom-confirm-desc">${opts.desc}</div>
      <div class="custom-confirm-actions">
        <button class="custom-confirm-cancel" id="ccCancel">${opts.cancelText || '취소'}</button>
        <button class="custom-confirm-ok ${opts.confirmClass === 'danger' ? 'danger' : ''}" id="ccOk">${opts.confirmText || '확인'}</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  requestAnimationFrame(() => requestAnimationFrame(() => modal.classList.add('show')));

  const close = () => {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 260);
  };

  modal.querySelector('#ccCancel').addEventListener('click', close);
  modal.querySelector('#ccOk').addEventListener('click', () => {
    close();
    opts.onConfirm?.();
  });
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
}


/* ── 상단 로고 클릭: 로그인 여부에 따라 분기 ── */
document.querySelectorAll('.site-logo').forEach(logo => {
  logo.addEventListener('click', e => {
    e.preventDefault();
    const reg = Storage.getRegistered();
    navigateTo(reg.email ? 'sc301.html' : 'sc101.html');
  });
});
/* ── 페이지 전환 헬퍼 ── */
function navigateTo(url) {
  document.body.classList.add('page-exit');
  setTimeout(() => { location.href = url; }, 340);
}