/* ============================================================
   notifications.js — 식사 시간 알림
   의존: 브라우저 Notification API, service-worker 등록

   [동작]
   - 앱 로드 시 알림 권한 요청 (1회)
   - 오늘 남은 식사 시간(아침 8시, 점심 12시, 저녁 19시)에
     setTimeout으로 알림 예약
   - 이미 인증 완료된 끼니는 알림 스킵
   ============================================================ */
'use strict';

(function initNotifications() {
  if (!('Notification' in window) || !navigator.serviceWorker) return;

  const MEAL_SCHEDULE = [
    { meal: 'breakfast', hour: 8,  min: 0,  label: '🌅 아침 식사 시간이에요!', body: '오늘 아침 식단을 인증해보세요.' },
    { meal: 'lunch',     hour: 12, min: 0,  label: '☀️ 점심 식사 시간이에요!', body: '오늘 점심 식단을 인증해보세요.' },
    { meal: 'dinner',    hour: 19, min: 0,  label: '🌙 저녁 식사 시간이에요!', body: '오늘 저녁 식단을 인증해보세요.' },
  ];

  /* 권한 요청 — 이미 결정된 경우 재요청하지 않음 */
  function requestPermission() {
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }

  /* 오늘 끼니 인증 여부 확인 */
  function isMealVerified(meal) {
    try {
      const uid     = (typeof getCurrentUid === 'function') ? getCurrentUid() : 'anon';
      const d       = new Date();
      const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const key     = `sc311_${uid}_${dateStr}`;
      const state   = JSON.parse(localStorage.getItem(key)) || {};
      return !!(state.meals && state.meals[meal] && state.meals[meal].verified);
    } catch { return false; }
  }

  /* 오늘 알림 이미 표시했는지 확인 */
  function wasNotifiedToday(meal) {
    const d       = new Date();
    const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    return localStorage.getItem(`notified_${meal}_${dateStr}`) === '1';
  }

  function markNotified(meal) {
    const d       = new Date();
    const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    localStorage.setItem(`notified_${meal}_${dateStr}`, '1');
  }

  /* 알림 표시 */
  function showMealNotification(schedule) {
    if (Notification.permission !== 'granted') return;
    if (isMealVerified(schedule.meal))          return;
    if (wasNotifiedToday(schedule.meal))        return;

    markNotified(schedule.meal);

    navigator.serviceWorker.ready.then(reg => {
      reg.showNotification(schedule.label, {
        body:    schedule.body,
        icon:    '../img/FitALogo.png',
        badge:   '../img/FitALogo.png',
        tag:     `fita-meal-${schedule.meal}`,
        renotify: false,
        data:    { url: '/public/pages/sc311.html' },
      });
    }).catch(() => {
      /* 서비스 워커 없을 때 Notification 직접 사용 */
      new Notification(schedule.label, {
        body: schedule.body,
        icon: '../img/FitALogo.png',
        tag:  `fita-meal-${schedule.meal}`,
      });
    });
  }

  /* 알림 예약 — 오늘 해당 시간까지 남은 ms 계산 */
  function scheduleMealAlerts() {
    if (Notification.permission !== 'granted') return;

    const now  = new Date();
    MEAL_SCHEDULE.forEach(schedule => {
      const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), schedule.hour, schedule.min, 0);
      const delay  = target - now;
      if (delay <= 0) return;           /* 이미 지난 시간 */
      setTimeout(() => showMealNotification(schedule), delay);
    });
  }

  /* 초기화 */
  requestPermission();

  if (Notification.permission === 'granted') {
    scheduleMealAlerts();
  } else if (Notification.permission === 'default') {
    /* 권한 허용 후 바로 예약 */
    Notification.requestPermission().then(perm => {
      if (perm === 'granted') scheduleMealAlerts();
    }).catch(() => {});
  }
})();
