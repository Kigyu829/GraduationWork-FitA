'use strict';

/* ════════════════════════════════
   팝업: 체중 저장 완료
   ════════════════════════════════ */
function showWeightSavedPopup(val) {
  document.getElementById('weightSavedPopup')?.remove();
  document.getElementById('weightPopupOverlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'weightPopupOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);backdrop-filter:blur(4px);z-index:9998;';

  const popup = document.createElement('div');
  popup.id = 'weightSavedPopup';
  popup.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) scale(0.9);background:var(--card);border:1px solid var(--border);border-radius:20px;padding:32px 36px;text-align:center;z-index:9999;box-shadow:0 24px 64px rgba(0,0,0,0.5);display:flex;flex-direction:column;align-items:center;gap:12px;opacity:0;transition:opacity 0.2s ease,transform 0.2s ease;min-width:260px;';
  popup.innerHTML = `<div style="font-size:48px;line-height:1;">⚖️</div><div style="font-size:18px;font-weight:800;color:var(--text);letter-spacing:-0.02em;">체중이 저장됐어요!</div><div style="font-size:14px;color:var(--teal);font-weight:800;">오늘 체중: ${val}kg</div><div style="font-size:12px;color:var(--text-sec);line-height:1.6;">대시보드에 반영됐어요.</div><button onclick="document.getElementById('weightSavedPopup')?.remove();document.getElementById('weightPopupOverlay')?.remove();" style="margin-top:4px;padding:10px 28px;border:none;border-radius:10px;background:var(--teal);color:#09131a;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;">확인</button>`;

  overlay.addEventListener('click', () => { popup.remove(); overlay.remove(); });
  document.body.appendChild(overlay);
  document.body.appendChild(popup);
  requestAnimationFrame(() => { requestAnimationFrame(() => { popup.style.opacity='1'; popup.style.transform='translate(-50%,-50%) scale(1)'; }); });
  setTimeout(() => { popup.remove(); overlay.remove(); }, 3000);
}

/* ════════════════════════════════
   팝업: 목표 달성 축하
   ════════════════════════════════ */
function showGoalAchievedPopup() {
  document.getElementById('goalAchievedPopup')?.remove();
  document.getElementById('goalAchievedOverlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'goalAchievedOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);backdrop-filter:blur(6px);z-index:9998;';

  const data = Storage.getUser();
  const popup = document.createElement('div');
  popup.id = 'goalAchievedPopup';
  popup.style.cssText = `
    position:fixed;top:50%;left:50%;
    transform:translate(-50%,-50%) scale(0.85);
    background:var(--card);border:1px solid var(--border);
    border-radius:24px;padding:40px 36px;
    text-align:center;z-index:9999;
    box-shadow:0 0 0 1px rgba(102,208,188,0.2),0 32px 80px rgba(0,0,0,0.6);
    display:flex;flex-direction:column;align-items:center;gap:14px;
    min-width:300px;max-width:360px;width:90%;
    opacity:0;transition:opacity 0.3s ease,transform 0.3s cubic-bezier(0.34,1.56,0.64,1);
  `;
  popup.innerHTML = `
    <div style="font-size:64px;line-height:1;animation:celebBounce 0.6s ease infinite alternate;">🏆</div>
    <div style="font-size:22px;font-weight:800;color:var(--teal);letter-spacing:-0.03em;">목표 달성!</div>
    <div style="font-size:15px;font-weight:800;color:var(--text);">
      목표 체중 <span style="color:var(--teal);">${data.targetWeight}kg</span>에 도달했어요!
    </div>
    <div style="font-size:13px;color:var(--text-sec);line-height:1.7;">
      꾸준히 노력한 결과예요. 정말 대단해요! 🎉<br>
      새로운 목표 설정 또는 현재 체중을 유지해보세요.
    </div>
    <div style="display:flex;gap:10px;width:100%;margin-top:4px;">
      <button onclick="document.getElementById('goalAchievedPopup')?.remove();document.getElementById('goalAchievedOverlay')?.remove();"
        style="flex:1;padding:12px;border:1px solid var(--border);border-radius:12px;
               background:transparent;color:var(--text-sec);font-size:13px;
               font-family:inherit;font-weight:700;cursor:pointer;">닫기</button>
      <button onclick="location.href='sc701.html';document.getElementById('goalAchievedPopup')?.remove();document.getElementById('goalAchievedOverlay')?.remove();"
        style="flex:1;padding:12px;border:none;border-radius:12px;
               background:var(--teal);color:#09131a;font-size:13px;
               font-family:inherit;font-weight:800;cursor:pointer;">목표 재설정 →</button>
    </div>
  `;

  /* 떨어지는 색종이 */
  const style = document.createElement('style');
  style.textContent = `
    @keyframes celebBounce { from { transform: translateY(0) rotate(-5deg); } to { transform: translateY(-8px) rotate(5deg); } }
    @keyframes confettiFall { 0% { transform: translateY(-20px) rotate(0deg); opacity: 1; } 100% { transform: translateY(100vh) rotate(720deg); opacity: 0; } }
  `;
  document.head.appendChild(style);

  overlay.addEventListener('click', () => { popup.remove(); overlay.remove(); });
  document.body.appendChild(overlay);
  document.body.appendChild(popup);

  const colors = ['var(--teal)','#F5A623','#C779D0','#5BA4E6','#7FD37A'];
  for (let i = 0; i < 28; i++) {
    const c = document.createElement('div');
    const size = 6 + Math.random() * 8;
    c.style.cssText = `position:fixed;left:${Math.random()*100}%;top:-20px;width:${size}px;height:${size}px;background:${colors[Math.floor(Math.random()*colors.length)]};border-radius:${Math.random()>0.5?'50%':'2px'};z-index:10000;pointer-events:none;animation:confettiFall ${2+Math.random()*2}s ease ${Math.random()*1}s forwards;`;
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 4000);
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      popup.style.opacity = '1';
      popup.style.transform = 'translate(-50%,-50%) scale(1)';
    });
  });
}
