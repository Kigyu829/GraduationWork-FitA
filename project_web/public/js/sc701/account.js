'use strict';

function loadAccountForm(data) {
  setVal('inputEmail', data.email);
}

function bindAccountSave() {
  document.getElementById('btnSaveEmail')?.addEventListener('click', async () => {
    const newEmail  = document.getElementById('inputEmail')?.value.trim();
    const pwConfirm = document.getElementById('inputEmailPwConfirm')?.value;

    if (!newEmail)  { showToast('이메일을 입력해주세요.', 'error'); return; }
    if (!pwConfirm) { showToast('현재 비밀번호를 입력해주세요.', 'error'); return; }

    const user = typeof auth !== 'undefined' ? auth.currentUser : null;
    if (!user) { showToast('로그인 상태를 확인해주세요.', 'error'); return; }

    try {
      const cred = firebase.auth.EmailAuthProvider.credential(user.email, pwConfirm);
      await user.reauthenticateWithCredential(cred);
      await user.updateEmail(newEmail);
    } catch (e) {
      const msg = e.code === 'auth/wrong-password' ? '현재 비밀번호가 올바르지 않아요.' : '변경에 실패했어요.';
      showToast(msg, 'error'); return;
    }

    const reg = Storage.getRegistered();
    Storage.setRegistered(newEmail, '', reg.nickname);
    setTextSafe('heroEmail', newEmail);
    document.getElementById('inputEmailPwConfirm').value = '';
    showToast('✅ 이메일이 변경됐어요.', 'success');
  });

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

  document.getElementById('btnSavePw')?.addEventListener('click', async () => {
    const currentPw = document.getElementById('inputCurrentPw')?.value;
    const newPw     = document.getElementById('inputNewPw')?.value;
    const newPwConf = document.getElementById('inputNewPwConfirm')?.value;

    if (!currentPw)                { showToast('현재 비밀번호를 입력해주세요.', 'error'); return; }
    if (!newPw || newPw.length < 8){ showToast('새 비밀번호는 8자 이상이어야 해요.', 'error'); return; }
    if (newPw !== newPwConf)       { showToast('새 비밀번호가 일치하지 않아요.', 'error'); return; }

    const user = typeof auth !== 'undefined' ? auth.currentUser : null;
    if (!user) { showToast('로그인 상태를 확인해주세요.', 'error'); return; }

    try {
      const cred = firebase.auth.EmailAuthProvider.credential(user.email, currentPw);
      await user.reauthenticateWithCredential(cred);
      await user.updatePassword(newPw);
    } catch (e) {
      const msg = e.code === 'auth/wrong-password' ? '현재 비밀번호가 올바르지 않아요.' : '변경에 실패했어요.';
      showToast(msg, 'error'); return;
    }

    ['inputCurrentPw', 'inputNewPw', 'inputNewPwConfirm'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    const wrap = document.getElementById('pwStrengthWrap');
    if (wrap) wrap.style.display = 'none';
    showToast('✅ 비밀번호가 변경됐어요.', 'success');
  });
}
