'use strict';

/* ════════════════════════════════
   sc311/routine.js
   운동 루틴 저장 / 불러오기 / 토스트
   의존: workout.js (renderWorkoutItems, initWorkoutCheck, updateWorkoutSummary,
                     workoutState, clearAdjustState)
        render.js  (applyIcons)
        common.js  (getCurrentUid, Storage, db)
   ════════════════════════════════ */

/* ── 루틴 스토리지 키 ── */
function routineStorageKey() {
  const uid = getCurrentUid() || 'anon';
  return `savedRoutines_${uid}`;
}

function getSavedRoutines() {
  try { return JSON.parse(localStorage.getItem(routineStorageKey())) || []; }
  catch { return []; }
}

/* 새 기기 로그인 시 Firestore에서 루틴 복원 */
async function restoreRoutinesFromFirestore() {
  const uid = getCurrentUid();
  if (!uid || typeof db === 'undefined') return;
  if (localStorage.getItem(routineStorageKey())) return; /* 이미 로컬 데이터 있으면 스킵 */
  try {
    const doc = await db.collection('users').doc(uid).get();
    if (doc.exists && Array.isArray(doc.data().savedRoutines)) {
      localStorage.setItem(routineStorageKey(), JSON.stringify(doc.data().savedRoutines));
    }
  } catch (e) {
    console.warn('[sc311] 루틴 Firestore 복원 실패:', e.message);
  }
}

function initRoutineButtons() {
  const bar     = document.getElementById('routineActionBar');
  const saveBtn = document.getElementById('routineSaveBtn');
  const loadBtn = document.getElementById('routineLoadBtn');
  if (!bar) return;

  /* 운동 플랜이 있을 때만 버튼 표시 */
  const data = Storage.getUser();
  if (data.aiWorkoutPlan) bar.style.display = 'flex';

  saveBtn?.addEventListener('click', saveWorkoutRoutine);
  loadBtn?.addEventListener('click', showRoutineModal);
}

function saveWorkoutRoutine() {
  const data = Storage.getUser();
  const plan = data.aiWorkoutPlan;
  if (!plan) { showToast('저장할 운동 플랜이 없어요'); return; }

  const today        = new Date();
  const defaultLabel = `${today.getMonth()+1}/${today.getDate()} 루틴`;
  showRoutineNameModal(defaultLabel, (label) => {
    const saved = getSavedRoutines();
    saved.unshift({ label, plan, savedAt: Date.now() });
    if (saved.length > 5) saved.pop();
    localStorage.setItem(routineStorageKey(), JSON.stringify(saved));

    /* Firestore 동기화 (크로스 디바이스 루틴 유지) */
    const uid = getCurrentUid();
    if (uid && typeof db !== 'undefined') {
      db.collection('users').doc(uid)
        .set({ savedRoutines: saved }, { merge: true })
        .catch(console.error);
    }

    showToast('루틴이 저장됐어요! 📂');
  });
}

function showRoutineNameModal(defaultLabel, onConfirm) {
  const overlay = document.createElement('div');
  overlay.className = 'routine-modal-overlay';
  overlay.innerHTML = `
    <div class="routine-modal" style="padding-bottom:24px;">
      <div class="routine-modal-header">
        <span class="routine-modal-title">💾 루틴 이름 지정</span>
        <button class="routine-modal-close" id="routineNameClose">✕</button>
      </div>
      <input id="routineNameInput" class="routine-name-input"
        type="text" maxlength="20" value="${defaultLabel}" placeholder="루틴 이름 입력" />
      <button class="routine-name-save-btn" id="routineNameSave">저장</button>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('show')));

  const input = overlay.querySelector('#routineNameInput');
  setTimeout(() => { input.focus(); input.select(); }, 280);

  const close = () => {
    overlay.classList.remove('show');
    setTimeout(() => overlay.remove(), 260);
  };

  overlay.querySelector('#routineNameClose').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  const doSave = () => {
    const label = input.value.trim() || defaultLabel;
    close();
    onConfirm(label);
  };
  overlay.querySelector('#routineNameSave').addEventListener('click', doSave);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') doSave(); });
}

function showRoutineModal() {
  const saved = getSavedRoutines();

  const overlay = document.createElement('div');
  overlay.className = 'routine-modal-overlay';
  overlay.innerHTML = `
    <div class="routine-modal">
      <div class="routine-modal-header">
        <span class="routine-modal-title">📂 저장된 루틴</span>
        <button class="routine-modal-close" id="routineModalClose">✕</button>
      </div>
      ${saved.length === 0
        ? '<div class="routine-empty">저장된 루틴이 없어요.<br>"이 루틴 저장" 버튼으로 저장해보세요.</div>'
        : saved.map((r, i) => `
          <div class="routine-item">
            <div class="routine-item-info">
              <div class="routine-item-name">${r.label}</div>
              <div class="routine-item-date">${new Date(r.savedAt).toLocaleDateString('ko-KR')}</div>
            </div>
            <button class="routine-item-load-btn" data-idx="${i}">불러오기</button>
          </div>`).join('')
      }
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('show')));

  const close = () => {
    overlay.classList.remove('show');
    setTimeout(() => overlay.remove(), 260);
  };
  overlay.querySelector('#routineModalClose')?.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  overlay.querySelectorAll('.routine-item-load-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx     = parseInt(btn.dataset.idx, 10);
      const routine = saved[idx];
      if (!routine) return;
      close();
      /* 저장된 루틴을 현재 AI 플랜으로 적용 */
      clearAdjustState('workouts');
      Storage.mergeUser({ aiWorkoutPlan: routine.plan });
      renderWorkoutItems(routine.plan);
      applyIcons();
      initWorkoutCheck();
      updateWorkoutSummary();
      showToast(`"${routine.label}" 루틴을 불러왔어요!`);
    });
  });
}

/* ── 토스트 알림 ── */
function showToast(msg) {
  let el = document.getElementById('sc311Toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'sc311Toast';
    el.style.cssText = [
      'position:fixed','bottom:80px','left:50%','transform:translateX(-50%)',
      'background:rgba(0,0,0,0.78)','color:#fff','font-size:13px','font-weight:700',
      'padding:10px 20px','border-radius:24px','z-index:9999',
      'pointer-events:none','white-space:nowrap','transition:opacity 0.3s',
    ].join(';');
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = '1';
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.style.opacity = '0'; }, 2200);
}
