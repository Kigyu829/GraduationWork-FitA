'use strict';

/* ════════════════════════════════
   업로드
   ════════════════════════════════ */
function bindUpload() {
  const zone        = document.getElementById('uploadZone') || document.getElementById('dropZone');
  const fileInput   = document.getElementById('fileInput')  || document.getElementById('foodFileInput');
  const uploadBtn   = document.getElementById('uploadBtn');
  const zoneInner   = document.getElementById('uploadZoneInner') || document.getElementById('uploadPlaceholder');
  const preview     = document.getElementById('uploadPreview');
  const previewImg  = document.getElementById('previewImg');
  const actions     = document.getElementById('uploadActions');
  const infoEl      = document.getElementById('selectedInfo');
  const cancelBtn   = document.getElementById('cancelBtn');
  const analyzeBtn  = document.getElementById('analyzeBtn');

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
    if (analyzeBtn) analyzeBtn.disabled = false;

    const reader = new FileReader();
    reader.onload = ev => {
      if (previewImg) {
        previewImg.src          = ev.target.result;
        previewImg.style.display = 'block';
      }
      if (zoneInner) zoneInner.style.display = 'none';
      if (preview)   preview.style.display   = 'flex';
      if (zone)      zone.classList.add('has-preview');
    };
    reader.readAsDataURL(file);

    const sizeMB = (file.size / 1024 / 1024).toFixed(1);
    if (infoEl) infoEl.textContent = `📎 ${file.name}  (${sizeMB} MB)`;
    if (actions) actions.style.display = 'flex';
  }

  cancelBtn?.addEventListener('click', () => {
    selectedFile = null;
    if (fileInput) fileInput.value = '';
    if (previewImg) { previewImg.src = ''; previewImg.style.display = 'none'; }
    if (preview)   preview.style.display   = 'none';
    if (zoneInner) zoneInner.style.display = 'flex';
    if (zone)      zone.classList.remove('has-preview');
    if (actions)   actions.style.display = 'none';
    if (analyzeBtn) analyzeBtn.disabled = true;
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
