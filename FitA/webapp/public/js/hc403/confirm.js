'use strict';

function showCustomConfirm(opts) {
  document.getElementById('customConfirmModal')?.remove();

  const modal = document.createElement('div');
  modal.id        = 'customConfirmModal';
  modal.className = 'custom-confirm-overlay';
  modal.innerHTML = `
    <div class="custom-confirm-box">
      <div class="custom-confirm-icon">${opts.icon || '⚠️'}</div>
      <div class="custom-confirm-title">${opts.title}</div>
      <div class="custom-confirm-desc">${opts.desc}</div>
      <div class="custom-confirm-actions">
        <button class="custom-confirm-cancel" id="ccCancel">${opts.cancelText || '취소'}</button>
        <button class="custom-confirm-ok ${opts.confirmClass === 'danger' ? 'danger' : ''}" id="ccOk">${opts.confirmText || '확인'}</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  requestAnimationFrame(() => requestAnimationFrame(() => modal.classList.add('show')));

  const close = () => {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 260);
  };

  modal.querySelector('#ccCancel').addEventListener('click', close);
  modal.querySelector('#ccOk').addEventListener('click', () => {
    close();
    opts.onConfirm?.();
  });
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
}
