/* hc403.js — 판독 결과 + 인증 (CNN 서버 연동)
   의존: common.js

   [메뉴 불일치 흐름]
   1. CNN 인식 음식이 AI 플랜 메뉴에 없으면 → reason-panel 노출
   2. 치팅  → kcal=인식된 음식 칼로리, reason='cheating' 으로 doVerify
   3. 재인식 → sc401로 돌아가 새 사진 촬영
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
        /* 사진 속 실제 음식 개수만큼만 표시:
           상위 신뢰도의 35% 미만이거나 절대값 20% 미만인 항목은 노이즈로 제외 */
        const topConf = top5[0].confidence;
        const minConf = Math.max(0.20, topConf * 0.35);
        const items   = top5.filter(item => item.confidence >= minConf);
        const displayItems = items.length > 0 ? items : top5.slice(0, 1);

        nutrientsEl.innerHTML = displayItems.map((item, i) => {
          const pct   = Math.round(item.confidence * 100);
          const name  = item.class_name_kr || item.class_name;
          const badge = pct >= 45 ? '✅' : pct >= 27 ? '🔍' : '❓';
          return `
            <div class="nutrient-row">
              <span class="nutrient-label">${badge} ${i === 0 ? '주요' : `${i + 1}번째`}</span>
              <span class="nutrient-value${i === 0 ? ' kcal' : ''}">
                ${name} (${pct}%)
              </span>
            </div>`;
        }).join('');
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

    /* 칼로리 수정 필드 노출 및 초기값 설정 */
    const kcalEditRow   = document.getElementById('kcalEditRow');
    const certKcalInput = document.getElementById('certKcalInput');
    if (kcalEditRow) kcalEditRow.style.display = '';
    if (certKcalInput) certKcalInput.value = getUploadParams().mealKcal || '';

    const topConf2  = (data.top_5 || []).length > 0 ? data.top_5[0].confidence : 0;
    const minConf2  = Math.max(0.20, topConf2 * 0.35);
    const allFoods  = (data.top_5 || [])
      .filter(f => f.confidence >= minConf2)
      .map(f => f.class_name_kr || f.class_name)
      .filter(Boolean);
    if (!allFoods.includes(data.detected_food_kr) && data.detected_food_kr) {
      allFoods.unshift(data.detected_food_kr);
    }
    bindButtons(data.detected_food_kr, allFoods);
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

    /* 판독 오류 시 reason-panel 절대 표시 안 함 */
    document.getElementById('reasonPanel')?.classList.remove('show');

    bindButtons('');
  }

  /* ══════════════════════════════════
     버튼 바인딩
  ══════════════════════════════════ */
  function bindButtons(detectedFood, allFoods = []) {
    /* 재업로드 */
    document.getElementById('retakeBtn')?.addEventListener('click', () => {
      sessionStorage.removeItem('uploadedPhoto');
      sessionStorage.removeItem('uploadedPhotoName');
      sessionStorage.removeItem('cnnResult');
      navigateTo('sc401.html');
    });

    /* 인증하기 버튼 */
    document.getElementById('certBtn')?.addEventListener('click', () => {
      handleCertClick(detectedFood, allFoods);
    });

    /* 사유 패널 버튼들 */
    bindReasonPanel(detectedFood);
  }

  /* ══════════════════════════════════
     인증 클릭 → 3단계 매칭 로직
     1) 1등(주요) 음식이 플랜 매칭 → 바로 통과
     2) 1등 불일치, 2등 이하 중 신뢰도 40%↑가 매칭 → 경고 팝업 후 선택
     3) 모두 불일치 → 사유 패널
  ══════════════════════════════════ */
  function handleCertClick(detectedFood, allFoods = []) {
    const { mealType } = getUploadParams();

    /* ── 1단계: 주요 음식(1등) 직접 매칭 ── */
    if (isMenuMatch(detectedFood, mealType)) {
      showCertFlow(detectedFood, null);
      return;
    }

    /* ── 2단계: 보조 음식(2등↑, 신뢰도 40% 이상)으로 보완 매칭 ── */
    let cnnData = null;
    try { cnnData = JSON.parse(sessionStorage.getItem('cnnResult'))?.data; } catch(e) {}

    const secondaries = (cnnData?.top_5 || [])
      .slice(1)                          // 1등 제외
      .filter(f => f.confidence >= 0.40); // 40% 이상만

    const matchedSecondary = secondaries.find(f =>
      isMenuMatch(f.class_name_kr || f.class_name, mealType)
    );

    if (matchedSecondary) {
      showSoftMatchWarning(detectedFood, matchedSecondary.class_name_kr || matchedSecondary.class_name);
      return;
    }

    /* ── 3단계: 모두 불일치 → 사유 패널 ── */
    showReasonPanel();
  }

  /* ══════════════════════════════════
     보조 매칭 경고 팝업
     주요 음식은 다르지만 플랜 재료가 고신뢰도로 감지된 경우
  ══════════════════════════════════ */
  function showSoftMatchWarning(detectedFood, matchedFood) {
    const overlay = document.createElement('div');
    overlay.className = 'cert-overlay';
    overlay.innerHTML = `
      <div class="cert-popup">
        <div class="cert-popup-icon">🔍</div>
        <div class="cert-popup-title">주 음식은 달라요</div>
        <div class="cert-popup-sub">
          주요 인식: <strong>${detectedFood}</strong><br>
          플랜 재료 감지: <strong>${matchedFood}</strong><br><br>
          플랜에 있는 재료가 사진에서 감지됐어요.<br>그래도 인증할까요?
        </div>
        <div style="display:flex;gap:10px;width:100%;">
          <button class="secondary-btn cert-popup-btn" id="softMatchCancelBtn" style="flex:1;">사유 선택</button>
          <button class="primary-btn cert-popup-btn" id="softMatchOkBtn" style="flex:1;">그래도 인증</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('show')));

    overlay.querySelector('#softMatchCancelBtn')?.addEventListener('click', () => {
      overlay.remove();
      showReasonPanel();
    });
    overlay.querySelector('#softMatchOkBtn')?.addEventListener('click', () => {
      overlay.remove();
      pendingVerify = doVerify(detectedFood, getEditedKcal(), 'secondary_match');
      showSuccessOverlay(null);
    });
  }

  /* ══════════════════════════════════
     메뉴 일치 여부 판단
     해당 끼니의 전체 메뉴 배열과 비교
  ══════════════════════════════════ */
  function isMenuMatch(detectedFood, mealType) {
    if (!detectedFood) return true;
    const norm = s => s.replace(/\s/g, '').toLowerCase();
    const d = norm(detectedFood);

    const mealPlan = Storage.getUser().aiMealPlan;
    if (!mealPlan) return true; // 플랜 없으면 통과

    const meal = mealPlan[mealType];
    if (!meal) return true;

    const menuArr = Array.isArray(meal.menu) ? meal.menu : [meal.menu || ''];
    const tokens  = menuArr
      .flatMap(m => m.split(/[,·+\s]+/))
      .map(norm)
      .filter(Boolean);

    return tokens.some(token => d.includes(token) || token.includes(d));
  }

  /* ══════════════════════════════════
     사유 패널 노출 / 숨김
  ══════════════════════════════════ */
  function showReasonPanel() {
    const panel      = document.getElementById('reasonPanel');
    const actionsEl  = document.getElementById('resultActions');
    if (panel)     { panel.style.display = ''; panel.classList.add('show'); }
    if (actionsEl) actionsEl.style.display = 'none';
  }

  function hideReasonPanel() {
    const panel      = document.getElementById('reasonPanel');
    const actionsEl  = document.getElementById('resultActions');
    if (panel)     { panel.classList.remove('show'); panel.style.display = 'none'; }
    if (actionsEl) actionsEl.style.display = '';
  }

  /* ══════════════════════════════════
     인식된 음식 칼로리 룩업 (1인분 기준 근사치)
  ══════════════════════════════════ */
  const FOOD_KCAL_MAP = {
    '가지볶음':80,'간장게장':150,'갈비구이':350,'갈비찜':400,'갈비탕':300,
    '갈치구이':200,'갈치조림':220,'감자전':250,'감자조림':120,'감자채볶음':100,
    '감자탕':380,'갓김치':30,'건새우볶음':120,'경단':180,'계란국':60,
    '계란말이':150,'계란찜':100,'계란후라이':90,'고등어구이':250,'고등어조림':230,
    '고사리나물':80,'고추장진미채볶음':130,'고추튀김':200,'곰탕/설렁탕':280,
    '곱창구이':300,'곱창전골':350,'과메기':180,'김밥':350,'김치볶음밥':420,
    '김치전':280,'김치찌개':150,'김치찜':200,'깍두기':25,'깻잎장아찌':40,
    '꼬막찜':120,'꽁치조림':230,'꽈리고추무침':50,'꿀떡':150,'나박김치':20,
    '누룽지':200,'닭갈비':320,'닭계장':280,'닭볶음탕':350,'더덕구이':100,
    '도라지무침':60,'도토리묵':80,'동그랑땡':200,'동태찌개':180,'된장찌개':100,
    '두부김치':200,'두부조림':150,'땅콩조림':220,'떡갈비':300,'떡국/만두국':350,
    '떡꼬치':250,'떡볶이':320,'라면':500,'라볶이':400,'막국수':380,
    '만두':300,'매운탕':200,'멍게':50,'메추리알장조림':120,'멸치볶음':100,
    '무국':60,'무생채':40,'물냉면':380,'물회':200,'미역국':50,
    '미역줄기볶음':60,'배추김치':20,'백김치':20,'보쌈':350,'부추김치':30,
    '북엇국':80,'불고기':320,'비빔냉면':420,'비빔밥':550,'산낙지':100,
    '삼겹살':450,'삼계탕':380,'새우볶음밥':430,'새우튀김':280,'생선전':200,
    '소세지볶음':300,'송편':250,'수육':400,'수정과':80,'수제비':350,
    '숙주나물':30,'순대':300,'순두부찌개':150,'시금치나물':40,'시래기국':60,
    '식혜':120,'알밥':400,'애호박볶음':70,'약과':250,'약식':300,
    '양념게장':200,'양념치킨':500,'어묵볶음':180,'연근조림':150,'열무국수':350,
    '열무김치':25,'오이소박이':20,'오징어채볶음':150,'오징어튀김':280,
    '우엉조림':120,'유부초밥':300,'육개장':280,'육회':200,'잔치국수':350,
    '잡곡밥':320,'잡채':280,'장어구이':350,'장조림':180,'전복죽':300,
    '젓갈':50,'제육볶음':380,'조개구이':150,'조기구이':200,'족발':450,
    '주꾸미볶음':200,'주먹밥':350,'짜장면':550,'짬뽕':500,'쫄면':420,
    '찜닭':400,'총각김치':25,'추어탕':250,'칼국수':420,'코다리조림':220,
    '콩국수':400,'콩나물국':40,'콩나물무침':30,'콩자반':100,'파김치':30,
    '파전':300,'편육':350,'피자':600,'한과':200,'해물찜':250,
    '호박전':200,'호박죽':200,'홍어무침':180,'황태구이':200,'회무침':180,
    '후라이드치킨':550,'훈제오리':400,
  };

  function lookupFoodKcal(foodName) {
    if (!foodName) return 300;
    return FOOD_KCAL_MAP[foodName] ?? 300;  /* 없으면 300kcal 기본값 */
  }

  /* ══════════════════════════════════
     사유 선택 패널 버튼 바인딩
  ══════════════════════════════════ */
  function bindReasonPanel(detectedFood) {
    /* 치팅으로 기록 — 인식된 음식의 칼로리로 저장 */
    document.getElementById('reasonCheating')?.addEventListener('click', () => {
      const detectedKcal = lookupFoodKcal(detectedFood);
      showCustomConfirm({
        icon:         '🍔',
        title:        '치팅으로 기록할까요?',
        desc:         `<strong>${detectedFood || '인식된 음식'}</strong>으로 기록됩니다.<br>`
                    + `칼로리: <strong style="color:var(--teal,#66D0BC)">${detectedKcal} kcal</strong>`,
        confirmText:  '치팅으로 기록',
        cancelText:   '취소',
        confirmClass: 'primary',
        onConfirm: () => {
          pendingVerify = doVerify(detectedFood || '치팅', detectedKcal, 'cheating');
          showEncouragementOverlay(detectedFood || '치팅');
        },
      });
    });

    /* 이미지 재인식 — 새 사진 촬영 후 재시도 */
    document.getElementById('reasonRetry')?.addEventListener('click', () => {
      sessionStorage.removeItem('uploadedPhoto');
      sessionStorage.removeItem('uploadedPhotoName');
      sessionStorage.removeItem('cnnResult');
      location.href = 'sc401.html';
    });

    /* 기타: 직접 입력 후 인증 */
    document.getElementById('reasonChatSubmit')?.addEventListener('click', () => {
      const input  = document.getElementById('reasonChatInput');
      const reason = input?.value.trim();
      if (!reason) { alert('사유를 입력해주세요.'); return; }
      pendingVerify = doVerify(detectedFood || reason, getEditedKcal(), reason);
      showSuccessOverlay(`"${reason}"으로 기록됐어요.`);
    });

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

    if (!forceReason && expectedFood && !isMenuMatch(detectedFood, uploadParams.mealType)) {
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
        pendingVerify = doVerify(detectedFood, getEditedKcal(), 'mismatch');
        showEncouragementOverlay(detectedFood);
      });
    } else {
      pendingVerify = doVerify(detectedFood, getEditedKcal(), forceReason || 'matched');
      showSuccessOverlay(null);
    }
  }

  /* ══════════════════════════════════
     localStorage에 인증 상태 저장
     reason: 'matched' | 'fasting' | 'cheating' | 'mismatch' | 기타 텍스트
  ══════════════════════════════════ */
  function compressImage(dataUrl, maxWidth, quality) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const scale  = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  let pendingVerify = null; /* 사진 업로드 Promise 추적 */
  async function doVerify(food, kcal, reason) {
    const uploadParams = getUploadParams();
    const mealType     = uploadParams.mealType;
    const finalKcal    = (reason === 'fasting') ? 0 : (kcal ?? uploadParams.mealKcal);

    const today   = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    const sc311Key = lsKey('sc311', dateStr);

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

    /* 전체 식단 인증 여부 → check 키 업데이트 */
    const checkKey    = lsKey('check', dateStr);
    const allVerified = ['breakfast', 'lunch', 'dinner'].every(k => sc311State.meals[k]?.verified);
    try {
      const state = JSON.parse(localStorage.getItem(checkKey)) || { meal: false, workout: false };
      state.meal  = allVerified;
      localStorage.setItem(checkKey, JSON.stringify(state));
    } catch(e) {
      localStorage.setItem(checkKey, JSON.stringify({ meal: allVerified, workout: false }));
    }
    syncDayToFirestore(dateStr); // 사진 없이 먼저 저장

    /* ── 식단 사진 압축 후 Firestore 저장 (Firebase Storage 미사용) ── */
    const photoDataUrl = sessionStorage.getItem('uploadedPhoto');
    if (photoDataUrl && reason !== 'fasting') {
      try {
        const compressed = await compressImage(photoDataUrl, 400, 0.6);
        sc311State.meals[mealType].photo = compressed;
        localStorage.setItem(sc311Key, JSON.stringify(sc311State));
        syncDayToFirestore(dateStr); // 사진 포함하여 재동기화
      } catch(err) {
        console.error('식단 사진 압축 실패:', err);
      }
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

    overlay.querySelector('#certDoneBtn')?.addEventListener('click', async () => {
      if (pendingVerify) try { await pendingVerify; } catch(e) {}
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

    overlay.querySelector('#certEncourageDoneBtn')?.addEventListener('click', async () => {
      if (pendingVerify) try { await pendingVerify; } catch(e) {}
      sessionStorage.removeItem('uploadedPhoto');
      sessionStorage.removeItem('uploadedPhotoName');
      sessionStorage.removeItem('cnnResult');
      navigateTo('sc301.html');
    });
  }

  /* ══════════════════════════════════
     수정된 칼로리 읽기 (입력값 우선)
  ══════════════════════════════════ */
  function getEditedKcal() {
    const inp = document.getElementById('certKcalInput');
    const val = parseInt(inp?.value, 10);
    return (!isNaN(val) && val >= 0) ? val : getUploadParams().mealKcal;
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
