/* ============================================================
   sc701.js — 마이페이지
   의존: common.js

   [인증 체크]
   Storage.getRegistered().email 유무로 판단 (기존 프로젝트 방식 동일)

   [네비게이션]
   탭 대신 좌측 nav-item 클릭으로 섹션 전환

   [저장 방식]
   fetch → 서버(/profile/*)  +  localStorage 항상 동기화 (폴백 보장)
   ============================================================ */

'use strict';

/* ════════════════════════════════
   DOMContentLoaded
   ════════════════════════════════ */
window.addEventListener('DOMContentLoaded', async () => {
  const reg = Storage.getRegistered();  /* common.js */
  if (!reg.email) {
    location.href = 'sc201_1.html';
    return;
  }

  const userData = await fetchUser();
  if (!userData) return;

  renderSidebar(userData);
  renderBanner(userData);
  loadProfileForm(userData);
  loadBodyForm(userData);
  loadGoalForm(userData);
  loadAccountForm(userData);

  bindNavItems();
  bindAvatarUpload();
  bindProfileSave();
  bindBodySave();
  bindGoalSave(userData);
  bindAccountSave();
  bindDangerZone();
  bindCancelBtns();
  initCommonOverlays();  /* AI상담 오버레이 + 히스토리 sc602 이동 */
  bindMenuBtns();   /* common.js */
  bindLogout();
  bindLogoClick();
});

/* ════════════════════════════════
   서버 유저 데이터 로드 (폴백: localStorage)
   ════════════════════════════════ */
async function fetchUser() {
  try {
    const userId = localStorage.getItem('userId');
    const reg    = Storage.getRegistered();
    const url    = userId
      ? `/user/${userId}`
      : `/user/byEmail?email=${encodeURIComponent(reg.email)}`;

    const res  = await fetch(url);
    if (!res.ok) throw new Error(`서버 오류 (${res.status})`);
    const data = await res.json();
    if (data && data.id) localStorage.setItem('userId', data.id);
    return data;
  } catch (err) {
    console.warn('서버 로드 실패, localStorage 사용:', err.message);
    return buildLocalData();
  }
}

function buildLocalData() {
  const reg  = Storage.getRegistered();
  const data = Storage.getUser();
  return { email: reg.email, nickname: reg.nickname, password: reg.password, ...data };
}

async function apiPost(endpoint, body) {
  const userId = localStorage.getItem('userId');
  const reg    = Storage.getRegistered();
  const res    = await fetch(endpoint, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ userId, email: reg.email, ...body }),
  });
  if (!res.ok) throw new Error(`서버 오류 (${res.status})`);
  return res.json();
}

/* ════════════════════════════════
   앱 사이드바 렌더
   ════════════════════════════════ */
function renderSidebar(data) {
  const nameEl   = document.getElementById('userName');
  const infoEl   = document.getElementById('userBasicInfo');
  const cwEl     = document.getElementById('currentWeightText');
  const twEl     = document.getElementById('targetWeightText');
  const avatarEl = document.getElementById('sidebarAvatar');

  if (nameEl) nameEl.textContent = data.nickname ? `${data.nickname}님` : '사용자';
  if (infoEl) {
    const parts = [];
    if (data.gender) parts.push(data.gender);
    if (data.height) parts.push(`키 ${data.height}cm`);
    infoEl.textContent = parts.join(' · ') || '기본 정보 없음';
  }
  if (cwEl) cwEl.textContent = data.weight       ? `${data.weight}kg`       : '-';
  if (twEl) twEl.textContent = data.targetWeight  ? `${data.targetWeight}kg` : '-';

  const saved = localStorage.getItem('profileAvatar');
  if (saved && avatarEl) avatarEl.innerHTML = `<img src="${saved}" alt="프로필" />`;
}

/* ════════════════════════════════
   웰컴 배너 렌더
   ════════════════════════════════ */
function renderBanner(data) {
  setTextSafe('heroName',        data.nickname || '사용자');
  setTextSafe('heroEmail',       data.email    || '이메일 미설정');
  setTextSafe('heroBadgeGender', data.gender   || '—');

  const ageBadge = document.getElementById('heroBadgeAge');
  if (ageBadge && data.birth) {
    const age = new Date().getFullYear() - Number(data.birth.slice(0, 4));
    ageBadge.textContent = `${age}세`;
  }

  const bmiBadge = document.getElementById('heroBadgeBMI');
  if (bmiBadge) {
    const bmi = data.bmi || calculateBMI(data.height, data.weight);
    bmiBadge.textContent = bmi ? `BMI ${bmi}` : 'BMI —';
  }

  setTextSafe('bannerCurrentWeight', data.weight       ? `${data.weight}kg`       : '—');
  setTextSafe('bannerTargetWeight',  data.targetWeight  ? `${data.targetWeight}kg` : '—');
  setTextSafe('bannerTargetLoss',    data.targetLoss    ? `${data.targetLoss}kg`   : '—');

  const saved      = localStorage.getItem('profileAvatar');
  const heroAvatar = document.getElementById('heroAvatar');
  if (saved && heroAvatar) heroAvatar.innerHTML = `<img src="${saved}" alt="프로필" />`;
}

/* ════════════════════════════════
   프로필 사진 업로드
   ════════════════════════════════ */
function bindAvatarUpload() {
  const fileInput = document.getElementById('avatarFileInput');
  if (!fileInput) return;

  fileInput.addEventListener('change', function () {
    const file = this.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
      const dataUrl = e.target.result;
      localStorage.setItem('profileAvatar', dataUrl);

      const imgTag = `<img src="${dataUrl}" alt="프로필" />`;
      const el1 = document.getElementById('heroAvatar');
      const el2 = document.getElementById('sidebarAvatar');
      if (el1) el1.innerHTML = imgTag;
      if (el2) el2.innerHTML = imgTag;

      showToast('✅ 프로필 사진이 변경됐어요.', 'success');
    };
    reader.readAsDataURL(file);
  });
}

/* ════════════════════════════════
   좌측 네비 전환
   ════════════════════════════════ */
function bindNavItems() {
  const navItems = document.querySelectorAll('.nav-item');
  const sections = document.querySelectorAll('.form-section');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(n  => n.classList.remove('active'));
      sections.forEach(s  => s.classList.remove('active'));

      item.classList.add('active');
      const target = document.getElementById(item.dataset.section);
      if (target) target.classList.add('active');
    });
  });
}

/* ── 취소 버튼: 폼 값 복원 ── */
function bindCancelBtns() {
  document.querySelectorAll('.btn-cancel').forEach(btn => {
    btn.addEventListener('click', async () => {
      const fresh = await fetchUser();
      if (!fresh) return;
      loadProfileForm(fresh);
      loadBodyForm(fresh);
      loadGoalForm(fresh);
      loadAccountForm(fresh);
    });
  });
}

/* ════════════════════════════════
   섹션1: 프로필(닉네임) 수정
   ════════════════════════════════ */
function loadProfileForm(data) {
  setVal('inputNickname', data.nickname);
}

function bindProfileSave() {
  document.getElementById('btnSaveNickname')?.addEventListener('click', async () => {
    const nickname = document.getElementById('inputNickname')?.value.trim();
    if (!nickname) { showToast('닉네임을 입력해주세요.', 'error'); return; }

    try { await apiPost('/profile/update', { nickname }); } catch { /* 폴백 */ }

    const reg = Storage.getRegistered();
    Storage.setRegistered(reg.email, reg.password, nickname);

    setTextSafe('userName',  `${nickname}님`);
    setTextSafe('heroName',  nickname);
    showToast('✅ 닉네임이 변경됐어요.', 'success');
  });
}

/* ════════════════════════════════
   섹션2: 신체 정보 수정
   ════════════════════════════════ */
function loadBodyForm(data) {
  setVal('inputGender', data.gender);
  setVal('inputBirth',  data.birth);
  setVal('inputHeight', data.height);
  setVal('inputWeight', data.weight);
  updateBmiMini();

  ['inputHeight', 'inputWeight'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', updateBmiMini);
  });
}

function updateBmiMini() {
  const height  = document.getElementById('inputHeight')?.value;
  const weight  = document.getElementById('inputWeight')?.value;
  const row     = document.getElementById('bmiMiniRow');
  const valEl   = document.getElementById('bmiMiniValue');
  const stEl    = document.getElementById('bmiMiniStatus');

  if (!row) return;
  if (!height || !weight) { row.style.display = 'none'; return; }

  const bmi    = calculateBMI(height, weight);
  const status = getBMIStatus(bmi);

  row.style.display = 'grid';
  if (valEl) { valEl.textContent = bmi; valEl.style.color = status.color; }
  if (stEl)  stEl.textContent = status.label;
}

function bindBodySave() {
  document.getElementById('btnSaveBody')?.addEventListener('click', async () => {
    const height = document.getElementById('inputHeight')?.value;
    const weight = document.getElementById('inputWeight')?.value;
    const gender = document.getElementById('inputGender')?.value;
    const birth  = document.getElementById('inputBirth')?.value;

    if (!height || !weight) { showToast('키와 체중은 필수 입력이에요.', 'error'); return; }

    const bmi = calculateBMI(height, weight);
    try { await apiPost('/profile/update', { height, weight, gender, birth }); } catch { /* 폴백 */ }

    Storage.mergeUser({ height, weight, gender, birth, bmi });

    const fresh = buildLocalData();
    renderSidebar(fresh);
    renderBanner(fresh);
    showToast('✅ 신체 정보가 저장됐어요.', 'success');
  });
}

/* ════════════════════════════════
   섹션3: 목표 재설정
   ════════════════════════════════ */
function loadGoalForm(data) {
  setTextSafe('statInitialWeight', data.initialWeight ? `${data.initialWeight}kg` : '—');
  setTextSafe('statTargetWeight',  data.targetWeight  ? `${data.targetWeight}kg`  : '—');
  setTextSafe('statTargetLoss',    data.targetLoss    ? `${data.targetLoss}kg`    : '—');
  setTextSafe('statGoalPeriod',    data.goalPeriod    || '—');
  setTextSafe('statActivityLevel', data.activityLevel || '—');

  setVal('inputActivityLevel', data.activityLevel);
  setVal('inputTargetLoss',    data.targetLoss);

  const standardPeriods = ['4주', '8주', '12주', '16주'];
  if (data.goalPeriod && standardPeriods.includes(data.goalPeriod)) {
    setVal('inputGoalPeriod', data.goalPeriod);
  } else if (data.goalPeriod) {
    setVal('inputGoalPeriod', '기타');
    const cw = document.getElementById('customWeeksWrap');
    if (cw) cw.style.display = 'block';
    setVal('inputCustomWeeks', data.goalWeeks);
  }

  const periodSel  = document.getElementById('inputGoalPeriod');
  const customWrap = document.getElementById('customWeeksWrap');

  periodSel?.addEventListener('change', () => {
    customWrap.style.display = periodSel.value === '기타' ? 'block' : 'none';
    if (periodSel.value !== '기타') {
      const el = document.getElementById('inputCustomWeeks');
      if (el) el.value = '';
    }
    updateGoalPreview(data);
  });

  document.getElementById('inputCustomWeeks')?.addEventListener('input', () => {
    const w    = parseInt(document.getElementById('inputCustomWeeks').value, 10);
    const hint = document.getElementById('customWeeksHint');
    if (hint) {
      hint.textContent = !w || w < 1 ? '1주 이상 입력해주세요.'
                       : w > 52      ? '최대 52주(1년)까지 입력 가능합니다.'
                       : '';
    }
    updateGoalPreview(data);
  });

  ['inputActivityLevel', 'inputTargetLoss'].forEach(id => {
    document.getElementById(id)?.addEventListener('input',  () => updateGoalPreview(data));
    document.getElementById(id)?.addEventListener('change', () => updateGoalPreview(data));
  });
}

function getGoalWeeks() {
  const val = document.getElementById('inputGoalPeriod')?.value;
  if (val === '기타') {
    const w = parseInt(document.getElementById('inputCustomWeeks')?.value, 10);
    return (!w || w < 1) ? null : w;
  }
  return { '4주': 4, '8주': 8, '12주': 12, '16주': 16 }[val] || null;
}

function getGoalPeriodLabel() {
  const val = document.getElementById('inputGoalPeriod')?.value;
  if (val === '기타') { const w = getGoalWeeks(); return w ? `${w}주` : '기타'; }
  return val || '';
}

function updateGoalPreview(data) {
  const currentW    = Number(data?.weight || Storage.getUser().weight || 0);
  const targetLoss  = Number(document.getElementById('inputTargetLoss')?.value || 0);
  const weeks       = getGoalWeeks();
  const activity    = document.getElementById('inputActivityLevel')?.value;
  const periodLabel = getGoalPeriodLabel();

  const previewEl  = document.getElementById('goalPreviewText');
  const warningBox = document.getElementById('goalWarningBox');

  if (targetLoss && weeks && targetLoss / weeks > 1.0) {
    warningBox.style.display = 'block';
    warningBox.textContent   = `⚠️ 주 ${(targetLoss / weeks).toFixed(1)}kg 감량은 권장 범위(주 1kg)를 초과합니다.`;
  } else {
    if (warningBox) warningBox.style.display = 'none';
  }

  if (!previewEl) return;
  if (!currentW || !targetLoss || !weeks || !activity) {
    previewEl.textContent = '목표 감량과 기간을 입력하면 표시됩니다.';
    previewEl.classList.add('muted');
    return;
  }

  const targetWeight = currentW - targetLoss;
  if (targetWeight <= 0) {
    previewEl.textContent = '목표 감량 무게를 다시 확인해주세요.';
    previewEl.classList.add('muted');
    return;
  }

  previewEl.textContent = `${currentW}kg → ${targetWeight}kg | ${periodLabel} 동안 ${targetLoss}kg 감량 (주 ${(targetLoss / weeks).toFixed(1)}kg)`;
  previewEl.classList.remove('muted');
}

function bindGoalSave(userData) {
  document.getElementById('btnSaveGoal')?.addEventListener('click', async () => {
    const currentW    = Number(Storage.getUser().weight || userData?.weight || 0);
    const targetLoss  = Number(document.getElementById('inputTargetLoss')?.value);
    const weeks       = getGoalWeeks();
    const activity    = document.getElementById('inputActivityLevel')?.value;
    const periodLabel = getGoalPeriodLabel();

    if (!targetLoss || !weeks || !activity) { showToast('모든 항목을 입력해주세요.', 'error'); return; }
    if (weeks < 1 || weeks > 52)            { showToast('달성 기간은 1~52주 사이로 입력해주세요.', 'error'); return; }

    const targetWeight = currentW - targetLoss;
    if (targetWeight <= 0) { showToast('목표 감량 무게를 다시 확인해주세요.', 'error'); return; }

    if (targetLoss / weeks > 1.0) {
      const ok = confirm(
        `⚠️ 설정하신 목표가 권장 감량 범위를 초과합니다.\n` +
        `(권장: 주 최대 1kg / 현재: 주 ${(targetLoss / weeks).toFixed(1)}kg)\n\n계속하시겠습니까?`
      );
      if (!ok) return;
    }

    const goalData = { initialWeight: currentW, targetLoss, goalPeriod: periodLabel, goalWeeks: weeks, targetWeight, activityLevel: activity };

    try { await apiPost('/profile/goal', goalData); } catch { /* 폴백 */ }

    Storage.mergeUser(goalData);

    setTextSafe('statInitialWeight', `${currentW}kg`);
    setTextSafe('statTargetWeight',  `${targetWeight}kg`);
    setTextSafe('statTargetLoss',    `${targetLoss}kg`);
    setTextSafe('statGoalPeriod',    periodLabel);
    setTextSafe('statActivityLevel', activity);

    const fresh = buildLocalData();
    renderSidebar(fresh);
    renderBanner(fresh);
    showToast('✅ 목표가 재설정됐어요.', 'success');
  });
}

/* ════════════════════════════════
   섹션4·5: 이메일 + 비밀번호 변경
   ════════════════════════════════ */
function loadAccountForm(data) {
  setVal('inputEmail', data.email);
}

function bindAccountSave() {
  /* 이메일 변경 */
  document.getElementById('btnSaveEmail')?.addEventListener('click', async () => {
    const newEmail  = document.getElementById('inputEmail')?.value.trim();
    const pwConfirm = document.getElementById('inputEmailPwConfirm')?.value;
    const reg       = Storage.getRegistered();

    if (!newEmail)               { showToast('이메일을 입력해주세요.', 'error'); return; }
    if (!pwConfirm)              { showToast('현재 비밀번호를 입력해주세요.', 'error'); return; }
    if (pwConfirm !== reg.password) { showToast('현재 비밀번호가 올바르지 않아요.', 'error'); return; }

    try {
      const json = await apiPost('/profile/email', { newEmail, currentPassword: pwConfirm });
      if (json && !json.success) { showToast(json.message || '변경에 실패했어요.', 'error'); return; }
    } catch { /* 폴백 */ }

    Storage.setRegistered(newEmail, reg.password, reg.nickname);
    setTextSafe('heroEmail', newEmail);
    document.getElementById('inputEmailPwConfirm').value = '';
    showToast('✅ 이메일이 변경됐어요.', 'success');
  });

  /* 비밀번호 강도 표시 */
  document.getElementById('inputNewPw')?.addEventListener('input', function () {
    const pw    = this.value;
    const wrap  = document.getElementById('pwStrengthWrap');
    const fill  = document.getElementById('pwStrengthFill');
    const label = document.getElementById('pwStrengthLabel');

    if (!pw) { if (wrap) wrap.style.display = 'none'; return; }
    if (wrap) wrap.style.display = 'flex';

    const levels = [
      { pct: '25%',  color: 'var(--red,#FF0B55)',   text: '매우 약함' },
      { pct: '50%',  color: '#F5A623',               text: '약함'     },
      { pct: '75%',  color: '#5BA4E6',               text: '보통'     },
      { pct: '100%', color: 'var(--teal,#66D0BC)',   text: '강함'     },
    ];
    const level = levels[Math.min(getPwStrength(pw), 3)];
    if (fill)  { fill.style.width = level.pct; fill.style.background = level.color; }
    if (label) { label.textContent = level.text; label.style.color = level.color; }
  });

  /* 비밀번호 변경 */
  document.getElementById('btnSavePw')?.addEventListener('click', async () => {
    const currentPw = document.getElementById('inputCurrentPw')?.value;
    const newPw     = document.getElementById('inputNewPw')?.value;
    const newPwConf = document.getElementById('inputNewPwConfirm')?.value;
    const reg       = Storage.getRegistered();

    if (!currentPw)                { showToast('현재 비밀번호를 입력해주세요.', 'error'); return; }
    if (currentPw !== reg.password){ showToast('현재 비밀번호가 올바르지 않아요.', 'error'); return; }
    if (!newPw || newPw.length < 8){ showToast('새 비밀번호는 8자 이상이어야 해요.', 'error'); return; }
    if (newPw !== newPwConf)       { showToast('새 비밀번호가 일치하지 않아요.', 'error'); return; }

    try { await apiPost('/profile/password', { currentPassword: currentPw, newPassword: newPw }); } catch { /* 폴백 */ }

    Storage.setRegistered(reg.email, newPw, reg.nickname);
    ['inputCurrentPw', 'inputNewPw', 'inputNewPwConfirm'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    const wrap = document.getElementById('pwStrengthWrap');
    if (wrap) wrap.style.display = 'none';
    showToast('✅ 비밀번호가 변경됐어요.', 'success');
  });
}

function getPwStrength(pw) {
  let score = 0;
  if (pw.length >= 8)                        score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw))                         score++;
  if (/[^A-Za-z0-9]/.test(pw))              score++;
  return Math.max(0, score - 1);
}

/* ════════════════════════════════
   섹션6: 위험 구역
   ════════════════════════════════ */
function bindDangerZone() {
  document.getElementById('btnResetData')?.addEventListener('click', async () => {
    const ok = confirm('⚠️ 모든 건강 데이터(신체정보, 목표, 기록)가 삭제됩니다.\n계속하시겠습니까?');
    if (!ok) return;

    try { await apiPost('/profile/reset', {}); } catch { /* 폴백 */ }
    Storage.setUser({});  /* 건강 데이터 초기화 (계정 유지, Firestore도 업데이트) */
    showToast('✅ 건강 데이터가 초기화됐어요.', 'success');
    setTimeout(() => { location.href = 'sc202.html'; }, 1200);
  });

  document.getElementById('btnDeleteAccount')?.addEventListener('click', async () => {
    const ok = confirm('⚠️ 계정을 탈퇴하면 모든 정보가 삭제되며 복구할 수 없습니다.\n정말 탈퇴하시겠습니까?');
    if (!ok) return;

    const currentPw = prompt('탈퇴를 진행하려면 현재 비밀번호를 입력해주세요.');
    if (!currentPw) return;

    /* Firebase Auth 비밀번호 재인증 후 계정 삭제 */
    const user = typeof auth !== 'undefined' ? auth.currentUser : null;
    if (user) {
      try {
        const cred = firebase.auth.EmailAuthProvider.credential(user.email, currentPw);
        await user.reauthenticateWithCredential(cred);
        /* Firestore 사용자 데이터 삭제 */
        try { await db.collection('users').doc(user.uid).delete(); } catch { /* 폴백 */ }
        await user.delete();
      } catch (e) {
        showToast('비밀번호가 올바르지 않아요.', 'error'); return;
      }
    }

    try { await apiPost('/profile/delete', { currentPassword: currentPw }); } catch { /* 폴백 */ }
    Storage.clearAll();
    location.href = 'sc101.html';
  });
}

/* ════════════════════════════════
   토스트
   ════════════════════════════════ */
let toastTimer = null;
function showToast(msg, type = '') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className   = `toast show${type ? ' ' + type : ''}`;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
}

/* ════════════════════════════════
   유틸
   ════════════════════════════════ */
function setVal(id, value) {
  const el = document.getElementById(id);
  if (el && value !== undefined && value !== null) el.value = value;
}
function setTextSafe(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}