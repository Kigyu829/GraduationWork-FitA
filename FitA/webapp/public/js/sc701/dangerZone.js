'use strict';

/* ════════════════════════════════
   sc701/dangerZone.js
   데이터 초기화 / 회원 탈퇴
   의존: utils.js  (showToast)
        common.js (Storage, getCurrentUid, auth, firebase, db, showCustomConfirm)
   ════════════════════════════════ */

function bindDangerZone() {
  document.getElementById('btnResetData')?.addEventListener('click', () => {
    showCustomConfirm({
      icon: '⚠️',
      title: '건강 데이터 초기화',
      desc: '모든 건강 데이터(신체정보, 목표, 기록)가 삭제됩니다.<br>계속하시겠습니까?',
      okText: '초기화',
      cancelText: '취소',
      danger: true,
      onOk: () => {
        Storage.setUser({});
        showToast('✅ 건강 데이터가 초기화됐어요.', 'success');
        setTimeout(() => { location.href = 'sc202.html'; }, 1200);
      }
    });
  });

  (document.getElementById('btnDeleteAccount') || document.getElementById('withdrawBtn'))?.addEventListener('click', () => {
    showCustomConfirm({
      icon: '⚠️',
      title: '정말 탈퇴하시겠어요?',
      desc: `계정을 탈퇴하면 모든 정보가 삭제되며 복구할 수 없습니다.<br><br>
             <input id="_deletePwInput" type="password" placeholder="현재 비밀번호 입력"
               style="width:100%;padding:10px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);
                      background:rgba(255,255,255,0.07);color:#fff;font-size:14px;box-sizing:border-box;">`,
      okText: '탈퇴하기',
      cancelText: '취소',
      danger: true,
      onOk: async () => {
        const currentPw = document.getElementById('_deletePwInput')?.value;
        if (!currentPw) { showToast('비밀번호를 입력해주세요.', 'error'); return; }

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

        Storage.clearAll();
        location.href = 'sc101.html';
      }
    });
  });
}
