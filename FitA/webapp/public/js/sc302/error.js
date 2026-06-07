'use strict';

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
