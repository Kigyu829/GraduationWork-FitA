'use strict';

function showAlreadyPlanCard() {
  document.getElementById('loadingCard')?.style.setProperty('display', 'none');
  const card = document.getElementById('alreadyPlanCard');
  if (card) card.style.display = '';

  document.getElementById('btnBackToDash')?.addEventListener('click', () => {
    location.href = 'sc301.html';
  });

  document.getElementById('btnOpenAiChat')?.addEventListener('click', () => {
    location.href = 'sc311.html?openChat=1';
  });
}
