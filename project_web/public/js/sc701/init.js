'use strict';

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

window.addEventListener('DOMContentLoaded', async () => {
  const reg = Storage.getRegistered();
  if (!reg.email) {
    location.href = 'sc201_1.html';
    return;
  }

  const userData = await fetchUser();
  if (!userData) return;

  renderSidebar(userData);
  renderBanner(userData);

  if (typeof auth !== 'undefined') {
    const unsub = auth.onAuthStateChanged(user => {
      unsub();
      if (user) sessionStorage.setItem('_fitUid', user.uid);
      renderWeightGraph();
    });
  } else {
    renderWeightGraph();
  }

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
  initCommonOverlays();
  bindMenuBtns();
  bindLogout();
  bindLogoClick();
});
