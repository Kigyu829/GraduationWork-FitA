'use strict';

/* ════════════════════════════════
   sc701/profile.js
   사이드바/배너 렌더링, 프로필 사진 업로드, 닉네임 수정, 좌측 네비 전환
   의존: utils.js  (setVal, setTextSafe, fetchUser, buildLocalData, showToast)
        common.js (getCurrentUid, Storage, db, storage, calculateBMI, getBMIStatus)
   ════════════════════════════════ */

/* ════════════════════════════════
   앱 사이드바 렌더
   ════════════════════════════════ */
function renderSidebar(data) {
  const nameEl   = document.getElementById('userName');
  const infoEl   = document.getElementById('userBasicInfo');
  const cwEl     = document.getElementById('currentWeightText');
  const twEl     = document.getElementById('targetWeightText');
  const avatarEl = document.getElementById('profileAvatar') || document.getElementById('sidebarAvatar');

  if (nameEl) nameEl.textContent = data.nickname ? `${data.nickname}님` : '사용자';
  if (infoEl) {
    const parts = [];
    if (data.gender) parts.push(data.gender);
    if (data.height) parts.push(`키 ${data.height}cm`);
    infoEl.textContent = parts.join(' · ') || '기본 정보 없음';
  }
  if (cwEl) cwEl.textContent = data.weight       ? `${data.weight}kg`       : '-';
  if (twEl) twEl.textContent = data.targetWeight  ? `${data.targetWeight}kg` : '-';

  const _uid0 = getCurrentUid();
  const saved = localStorage.getItem(_uid0 ? `profileAvatar_${_uid0}` : 'profileAvatar') || Storage.getUser().avatarUrl || null;
  if (saved && avatarEl) avatarEl.innerHTML = `<img src="${saved}" alt="프로필" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;" />`;
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

  const _uid1 = getCurrentUid();
  const saved      = localStorage.getItem(_uid1 ? `profileAvatar_${_uid1}` : 'profileAvatar') || Storage.getUser().avatarUrl || null;
  const heroAvatar = document.getElementById('heroAvatar');
  if (saved && heroAvatar) heroAvatar.innerHTML = `<img src="${saved}" alt="프로필" />`;
}

/* ════════════════════════════════
   프로필 사진 업로드
   ════════════════════════════════ */
function bindAvatarUpload() {
  const fileInput = document.getElementById('avatarInput') || document.getElementById('avatarFileInput');
  if (!fileInput) return;

  fileInput.addEventListener('change', function () {
    const file = this.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function (e) {
      const dataUrl = e.target.result;
      const _uid2 = getCurrentUid();
      localStorage.setItem(_uid2 ? `profileAvatar_${_uid2}` : 'profileAvatar', dataUrl);

      const imgTag = `<img src="${dataUrl}" alt="프로필" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;" />`;
      const el1 = document.getElementById('heroAvatar') || document.getElementById('profileAvatar');
      const el2 = document.getElementById('sidebarAvatar');
      if (el1) el1.innerHTML = imgTag;
      if (el2) el2.innerHTML = imgTag;

      showToast('✅ 프로필 사진이 변경됐어요.', 'success');

      /* Firebase Storage 업로드 → Firestore에 URL 저장 */
      const uid = getCurrentUid();
      if (uid && typeof storage !== 'undefined') {
        try {
          const ref = storage.ref(`avatarImages/${uid}/profile.jpg`);
          await ref.putString(dataUrl, 'data_url');
          const downloadUrl = await ref.getDownloadURL();
          Storage.mergeUser({ avatarUrl: downloadUrl });
        } catch (err) {
          console.error('아바타 Storage 업로드 실패:', err);
        }
      }
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

    const reg = Storage.getRegistered();
    Storage.setRegistered(reg.email, '', nickname);

    /* Firestore users/{uid}.nickname 갱신 */
    const uid = getCurrentUid();
    if (uid && typeof db !== 'undefined') {
      db.collection('users').doc(uid).update({ nickname }).catch(console.error);
    }

    setTextSafe('userName',    `${nickname}님`);
    setTextSafe('heroName',    nickname);
    setTextSafe('mpNickname',  nickname);
    const nf = document.getElementById('nicknameForm');
    if (nf) nf.style.display = 'none';
    showToast('✅ 닉네임이 변경됐어요.', 'success');
  });
}
