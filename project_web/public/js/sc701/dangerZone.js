'use strict';

function bindDangerZone() {
  document.getElementById('btnResetData')?.addEventListener('click', async () => {
    const ok = confirm('⚠️ 모든 건강 데이터(신체정보, 목표, 기록)가 삭제됩니다.\n계속하시겠습니까?');
    if (!ok) return;

    try { await apiPost('/profile/reset', {}); } catch { /* 폴백 */ }
    Storage.setUser({});
    showToast('✅ 건강 데이터가 초기화됐어요.', 'success');
    setTimeout(() => { location.href = 'sc202.html'; }, 1200);
  });

  document.getElementById('btnDeleteAccount')?.addEventListener('click', async () => {
    const ok = confirm('⚠️ 계정을 탈퇴하면 모든 정보가 삭제되며 복구할 수 없습니다.\n정말 탈퇴하시겠습니까?');
    if (!ok) return;

    const currentPw = prompt('탈퇴를 진행하려면 현재 비밀번호를 입력해주세요.');
    if (!currentPw) return;

    const user = typeof auth !== 'undefined' ? auth.currentUser : null;
    if (user) {
      try {
        const cred = firebase.auth.EmailAuthProvider.credential(user.email, currentPw);
        await user.reauthenticateWithCredential(cred);
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
