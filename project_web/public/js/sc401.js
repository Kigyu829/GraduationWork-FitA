/* sc401.js — 식단 사진 업로드
   의존: common.js

   [진입 경로 분기]
   A. sc311 인증 버튼 → ?meal=breakfast&kcal=340&mainFood=... 파라미터 있음
      → 날짜·끼니 선택 없이 바로 업로드 화면
   B. 메뉴(드로어)에서 직접 진입 → 파라미터 없음
      → 업로드 카드 위에 날짜·끼니 선택 UI 표시
      → 선택 완료 후 uploadParams에 저장하고 업로드 진행
*/
'use strict';

window.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(location.search);

  if (urlParams.has('meal')) {
    /* ── A. sc311에서 넘어온 경우 ── */
    sessionStorage.setItem('uploadParams', urlParams.toString());
    hideMealSelector();
  } else {
    /* ── B. 직접 진입 ── */
    sessionStorage.removeItem('uploadParams');
    showMealSelector();
  }

  bindSidebar();
  bindUpload();
  bindMealSelector();
});

/* ════════════════════════════════
   날짜 · 끼니 선택 UI
   ════════════════════════════════ */
function showMealSelector() {
  const selector = document.getElementById('mealSelector');
  if (selector) selector.style.display = 'block';
}

function hideMealSelector() {
  const selector = document.getElementById('mealSelector');
  if (selector) selector.style.display = 'none';
}

function bindMealSelector() {
  const mealBtns = document.querySelectorAll('.meal-select-btn');

  mealBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      mealBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      /* 클릭 즉시 uploadParams 저장 */
      const selectedMeal = btn.dataset.meal;
      const userData     = Storage.getUser();
      const mealPlan     = userData.aiMealPlan;
      const kcal         = mealPlan?.[selectedMeal]?.calories || 0;
      const mainFood     = mealPlan?.[selectedMeal]?.main_food || '';

      const params = new URLSearchParams({ meal: selectedMeal, kcal });
      if (mainFood) params.set('mainFood', mainFood);
      sessionStorage.setItem('uploadParams', params.toString());
    });
  });
}

/* ════════════════════════════════
   사이드바
   ════════════════════════════════ */
function bindSidebar() {
  document.getElementById('sidebarLogo')?.addEventListener('click', () => {
    location.href = 'sc301.html';
  });
  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    if (typeof auth !== 'undefined') auth.signOut().catch(() => {});
    Storage.clearAll();
    location.href = 'sc101.html';
  });
  document.getElementById('backBtn')?.addEventListener('click', () => {
    navigateTo('sc301.html');
  });
  document.getElementById('backToMain')?.addEventListener('click', () => {
    navigateTo('sc311.html');
  });
  if (typeof bindMenuBtns === 'function') bindMenuBtns();
}

/* ════════════════════════════════
   업로드
   ════════════════════════════════ */
function bindUpload() {
  const zone       = document.getElementById('uploadZone');
  const fileInput  = document.getElementById('fileInput');
  const uploadBtn  = document.getElementById('uploadBtn');
  const zoneInner  = document.getElementById('uploadZoneInner');
  const preview    = document.getElementById('uploadPreview');
  const previewImg = document.getElementById('previewImg');
  const actions    = document.getElementById('uploadActions');
  const infoEl     = document.getElementById('selectedInfo');
  const cancelBtn  = document.getElementById('cancelBtn');
  const analyzeBtn = document.getElementById('analyzeBtn');

  let selectedFile = null;

  uploadBtn?.addEventListener('click', e => {
    e.stopPropagation();
    fileInput?.click();
  });

  zone?.addEventListener('click', () => { fileInput?.click(); });

  fileInput?.addEventListener('change', () => {
    if (fileInput.files?.length) handleFile(fileInput.files[0]);
  });

  zone?.addEventListener('dragover', e => {
    e.preventDefault();
    zone.classList.add('dragover');
  });
  zone?.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone?.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('dragover');
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) handleFile(file);
  });

  function handleFile(file) {
    if (file.size > 10 * 1024 * 1024) {
      alert('파일 크기가 10MB를 초과합니다.');
      return;
    }
    selectedFile = file;

    const reader = new FileReader();
    reader.onload = ev => {
      previewImg.src = ev.target.result;
      zoneInner.style.display = 'none';
      preview.style.display   = 'flex';
      zone.classList.add('has-preview');
    };
    reader.readAsDataURL(file);

    const sizeMB = (file.size / 1024 / 1024).toFixed(1);
    if (infoEl) infoEl.textContent = `📎 ${file.name}  (${sizeMB} MB)`;
    if (actions) actions.style.display = 'flex';
  }

  cancelBtn?.addEventListener('click', () => {
    selectedFile = null;
    fileInput.value = '';
    previewImg.src  = '';
    preview.style.display   = 'none';
    zoneInner.style.display = 'flex';
    zone.classList.remove('has-preview');
    if (actions) actions.style.display = 'none';
  });

  /* 분석 시작 → uploadParams 확인 후 hc402로 */
  analyzeBtn?.addEventListener('click', () => {
    if (!selectedFile) return;

    /* B 경로: uploadParams 미설정 시 끼니 먼저 선택하도록 안내 */
    const params = sessionStorage.getItem('uploadParams');
    if (!params || !new URLSearchParams(params).has('meal')) {
      /* 선택 UI로 포커스 */
      const selector = document.getElementById('mealSelector');
      if (selector) {
        selector.scrollIntoView({ behavior: 'smooth' });
        selector.classList.add('selector-shake');
        setTimeout(() => selector.classList.remove('selector-shake'), 600);
      }
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(selectedFile);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 800;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else       { w = Math.round(w * MAX / h); h = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      try {
        sessionStorage.setItem('uploadedPhoto', dataUrl);
        sessionStorage.setItem('uploadedPhotoName', selectedFile.name);
        navigateTo('hc402.html');
      } catch (e) {
        alert('이미지가 너무 큽니다. 더 작은 이미지를 사용해주세요.');
      }
    };
    img.src = url;
  });
}
