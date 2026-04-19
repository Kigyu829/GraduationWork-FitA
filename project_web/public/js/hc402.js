/* hc402.js — 스캔 애니메이션 + CNN 서버 호출 → hc403
   의존: common.js
*/
'use strict';

const CNN_SERVER = '';

window.addEventListener('DOMContentLoaded', () => {
  const photo = sessionStorage.getItem('uploadedPhoto');
  if (!photo) {
    location.href = 'sc401.html';
    return;
  }

  const photoEl       = document.getElementById('scanPhoto');
  const progressFill  = document.getElementById('progressFill');
  const progressLabel = document.getElementById('progressLabel');
  const statusEl      = document.getElementById('scanStatus');
  const hintEl        = document.getElementById('scanHint');

  photoEl.src = photo;

  /* ── 1단계: 90%까지 진행하는 애니메이션 (Promise 반환) ── */
  function runAnimation() {
    return new Promise(resolve => {
      const messages = [
        { pct: 20, status: '사진을 스캔하는 중...',    hint: 'CNN이 음식의 종류를 파악하고 있어요' },
        { pct: 45, status: '특징 추출 중...',          hint: '딥러닝 모델이 이미지를 분석하고 있어요' },
        { pct: 70, status: '분류 모델 추론 중...',     hint: '150종 한국 음식과 비교하고 있어요' },
        { pct: 90, status: 'CNN 서버 응답 대기 중...', hint: '모델이 이미지를 인식하고 있어요' },
      ];

      let step = 0;

      function nextStep() {
        if (step >= messages.length) { resolve(); return; }
        const m = messages[step];
        progressFill.style.width  = m.pct + '%';
        progressLabel.textContent = m.pct + '%';
        if (statusEl) statusEl.textContent = m.status;
        if (hintEl)   hintEl.textContent   = m.hint;
        step++;
        setTimeout(nextStep, 700);
      }

      photoEl.onload = () => { setTimeout(nextStep, 400); };
      if (photoEl.complete) setTimeout(nextStep, 400);
    });
  }

  /* ── CNN 서버 호출 ── */
  async function callCnn(dataUrl) {
    const [meta, base64] = dataUrl.split(',');
    const mimeType = meta.split(';')[0].split(':')[1];

    /* base64 → Blob */
    const binary = atob(base64);
    const bytes  = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: mimeType });

    const formData = new FormData();
    formData.append('image', blob, 'food.jpg');

    const res = await fetch(`${CNN_SERVER}/cnn/api/analyze`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) throw new Error(`CNN 서버 오류 (${res.status})`);
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'CNN 분석 실패');
    return json.data;
  }

  /* ── 애니메이션(90%)과 CNN 호출을 동시에 실행
        둘 다 끝나면 → 100% 완료 표시 → 오버레이 → hc403 ── */
  Promise.allSettled([runAnimation(), callCnn(photo)]).then(([, cnn]) => {
    /* 2단계: CNN 응답 도착 시 100%로 완료 */
    progressFill.style.width  = '100%';
    progressLabel.textContent = '100%';
    if (statusEl) statusEl.textContent = '스캔 완료!';
    if (hintEl)   hintEl.textContent   = 'CNN 판독이 완료됐어요';

    if (cnn.status === 'fulfilled') {
      sessionStorage.setItem('cnnResult', JSON.stringify({ success: true, data: cnn.value }));
    } else {
      sessionStorage.setItem('cnnResult', JSON.stringify({ success: false, error: cnn.reason.message }));
    }

    /* 완료 메시지 잠깐 보여주고 오버레이 */
    setTimeout(showAnalyzingOverlay, 600);
  });

  /* ── 파란 로딩 오버레이 ── */
  function showAnalyzingOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'analyzing-overlay';
    overlay.innerHTML = `
      <div class="analyzing-box">
        <div class="analyzing-spinner"></div>
        <div class="analyzing-title">분석 중입니다</div>
        <div class="analyzing-sub">CNN이 사진을 판독하고 있어요</div>
        <div class="analyzing-dots">
          <span></span><span></span><span></span>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => overlay.classList.add('show'));
    });

    setTimeout(() => { navigateTo('hc403.html'); }, 1600);
  }
});
