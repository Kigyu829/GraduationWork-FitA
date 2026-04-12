/* sc401.js — 식단 사진 업로드
   의존: common.js
*/
'use strict';

window.addEventListener('DOMContentLoaded', () => {
  /* sc311에서 넘어온 끼니 정보(meal, kcal) 파라미터를 sessionStorage에 저장
     → hc403에서 인증 완료 시 어느 끼니인지 알 수 있도록 */
  const urlParams = new URLSearchParams(location.search);
  if (urlParams.has('meal')) {
    sessionStorage.setItem('uploadParams', urlParams.toString());
  }

  bindSidebar();
  bindUpload();
});

/* ── 사이드바 ── */
function bindSidebar() {
  document.getElementById('sidebarLogo')?.addEventListener('click', () => {
    location.href = 'sc301.html';
  });
  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    localStorage.removeItem('healthUserData');
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

/* ── 업로드 ── */
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

  /* 파일 선택 버튼 — stopPropagation으로 zone 클릭 이벤트 전파 차단 */
  uploadBtn?.addEventListener('click', e => {
    e.stopPropagation();
    fileInput?.click();
  });

  /* zone 클릭 — 미리보기 상태일 때는 사진 변경, 아닐 때는 파일 선택 */
  zone?.addEventListener('click', () => {
    fileInput?.click();
  });

  /* 파일 인풋 변경 */
  fileInput?.addEventListener('change', () => {
    if (fileInput.files?.length) handleFile(fileInput.files[0]);
  });

  /* 드래그 앤 드롭 */
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

  /* 파일 처리 */
  function handleFile(file) {
    if (file.size > 10 * 1024 * 1024) {
      alert('파일 크기가 10MB를 초과합니다.');
      return;
    }
    selectedFile = file;

    /* 미리보기 이미지 표시 */
    const reader = new FileReader();
    reader.onload = ev => {
      previewImg.src = ev.target.result;
      zoneInner.style.display = 'none';
      preview.style.display   = 'flex';
      zone.classList.add('has-preview');
    };
    reader.readAsDataURL(file);

    /* 파일 정보 */
    const sizeMB = (file.size / 1024 / 1024).toFixed(1);
    if (infoEl) infoEl.textContent = `📎 ${file.name}  (${sizeMB} MB)`;
    if (actions) actions.style.display = 'flex';
  }

  /* 다시 선택 */
  cancelBtn?.addEventListener('click', () => {
    selectedFile = null;
    fileInput.value = '';
    previewImg.src = '';
    preview.style.display   = 'none';
    zoneInner.style.display = 'flex';
    zone.classList.remove('has-preview');
    if (actions) actions.style.display = 'none';
  });

  /* 분석 시작 → hc402 */
  analyzeBtn?.addEventListener('click', () => {
    if (!selectedFile) return;
    const reader = new FileReader();
    reader.onload = e => {
      sessionStorage.setItem('uploadedPhoto', e.target.result);
      sessionStorage.setItem('uploadedPhotoName', selectedFile.name);
      navigateTo('hc402.html');
    };
    reader.readAsDataURL(selectedFile);
  });
}

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