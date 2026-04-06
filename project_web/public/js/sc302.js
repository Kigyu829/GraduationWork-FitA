/* ============================================================
   sc302.js — AI 플랜 생성 로딩
   의존: common.js

   [흐름]
   sc203 완료 → sc302(AI 서버 호출) → sc301(대시보드)
   AI 서버 (port 5000)에서 식단 + 운동 플랜을 받아 localStorage에 저장
   ============================================================ */

'use strict';

const AI_SERVER = 'http://localhost:5000';

/* ── 날짜 문자열 헬퍼 ── */
function getPlanDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

/* ── 오늘 플랜 존재 여부 확인 ── */
function hasTodayPlan() {
  const userData = Storage.getUser();
  if (!userData.aiMealPlan) return false;

  /* aiPlanDate가 없는 구버전 데이터 → 오늘 날짜로 보정 후 true */
  if (!userData.aiPlanDate) {
    Storage.mergeUser({ aiPlanDate: getPlanDateStr() });
    return true;
  }

  return userData.aiPlanDate === getPlanDateStr();
}

/* ── 이미 받은 경우 표시 UI ── */
function showAlreadyReceivedUI() {
  const card = document.querySelector('.loading-card');
  if (!card) return;

  card.innerHTML = `
    <div class="loading-character">✅</div>
    <div>
      <div class="loading-title">이미 오늘의 플랜이 있어요</div>
      <div class="loading-subtitle">
        오늘 AI 식단 추천을 이미 받으셨어요.<br>
        수정하고 싶은 점은 <strong>AI 상담</strong>을 이용해 주세요.
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:12px;width:100%;max-width:320px;margin-top:8px;">
      <button class="primary-btn" id="goToPlanBtn">오늘의 식단/운동 보기</button>
      <button class="primary-btn" id="goToChatBtn"
        style="background:var(--card,#2a2a3a);color:var(--text,#fff);border:1px solid var(--border,#444);">
        🤖 AI 상담으로 수정하기
      </button>
    </div>
  `;

  document.getElementById('goToPlanBtn')?.addEventListener('click', () => {
    location.href = 'sc311.html';
  });
  document.getElementById('goToChatBtn')?.addEventListener('click', () => {
    location.href = 'sc311.html?openChat=1';
  });
}

/* ── 사이드바 공통 초기화 ── */
window.addEventListener('DOMContentLoaded', () => {
  renderSidebar();
  bindMenuBtns();
  bindLogout();
  bindLogoClick();

  if (hasTodayPlan()) {
    showAlreadyReceivedUI();
  } else {
    startLoadingSequence();
  }
});

function renderSidebar() {
  const data = Storage.getUser();
  const reg  = Storage.getRegistered();

  const nameEl = document.getElementById('userName');
  const infoEl = document.getElementById('userBasicInfo');
  const cwEl   = document.getElementById('currentWeightText');
  const twEl   = document.getElementById('targetWeightText');

  if (nameEl) nameEl.textContent = reg.nickname ? `${reg.nickname}님` : '사용자';
  if (infoEl) {
    const parts = [];
    if (data.gender) parts.push(data.gender);
    if (data.height) parts.push(`키 ${data.height}cm`);
    infoEl.textContent = parts.join(' · ') || '기본 정보 없음';
  }
  if (cwEl) cwEl.textContent = data.weight      ? `${data.weight}kg`      : '-';
  if (twEl) twEl.textContent = data.targetWeight ? `${data.targetWeight}kg` : '-';
}

function bindLogout() {
  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    localStorage.removeItem('healthUserData');
    location.href = 'sc101.html';
  });
}

function bindLogoClick() {
  document.getElementById('sidebarLogo')?.addEventListener('click', () => {
    /* 로그인 후 페이지이므로 로고 클릭 시 대시보드로 이동 */
    location.href = 'sc301.html';
  });
}

/* ── AI 서버 API 호출 ── */
/* 대시보드와 동일한 Mifflin-St Jeor 공식으로 목표 칼로리 계산
   일일 적자 상한: 700 kcal (약 0.65kg/주 — 안전한 감량 속도) */
function calcTargetCalories(userData) {
  const weight       = Number(userData.weight);
  const height       = Number(userData.height);
  const targetWeight = Number(userData.targetWeight);
  const goalWeeks    = Number(userData.goalWeeks);
  const gender       = userData.gender;
  const birth        = userData.birth || '';

  const age = birth
    ? new Date().getFullYear() - Number(birth.slice(0, 4))
    : 25;

  /* BMR (Mifflin-St Jeor) */
  const bmr = gender === '남성'
    ? 10 * weight + 6.25 * height - 5 * age + 5
    : 10 * weight + 6.25 * height - 5 * age - 161;

  /* TDEE */
  const actMap = { '낮음': 1.2, '보통': 1.375, '높음': 1.55 };
  const tdee   = Math.round(bmr * (actMap[userData.activityLevel] || 1.375));

  /* 일일 적자 (최대 700 kcal) */
  const weightToLose  = Math.max(0, weight - targetWeight);
  const totalDays     = Math.max(1, goalWeeks * 7);
  const rawDeficit    = Math.round((weightToLose * 7700) / totalDays);
  const dailyDeficit  = Math.min(rawDeficit, 1000);

  return { tdee, targetCalories: Math.max(1200, tdee - dailyDeficit) };
}

async function fetchMealPlan(userData) {
  const { tdee, targetCalories } = calcTargetCalories(userData);

  const res = await fetch(`${AI_SERVER}/api/meal/recommend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      height:          userData.height,
      weight:          userData.weight,
      bmi:             userData.bmi,
      gender:          userData.gender,
      targetWeight:    userData.targetWeight,
      targetWeeks:     userData.goalWeeks,
      targetCalories,   /* 프론트에서 정확하게 계산한 값 전달 */
    }),
  });
  if (!res.ok) throw new Error(`식단 추천 실패 (${res.status})`);
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json;
}

async function fetchWorkoutPlan(userData) {
  const res = await fetch(`${AI_SERVER}/api/exercise/recommend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      height:       userData.height,
      weight:       userData.weight,
      bmi:          userData.bmi,
      gender:       userData.gender,
      targetWeight: userData.targetWeight,
      targetWeeks:  userData.goalWeeks,
    }),
  });
  if (!res.ok) throw new Error(`운동 추천 실패 (${res.status})`);
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json;
}

/* ── 로딩 시퀀스 ── */
const MESSAGES = [
  '식단 패턴을 분석하고 있어요...',
  'BMI와 활동량을 계산 중이에요...',
  '최적 칼로리를 계산하고 있어요...',
  '운동 강도를 맞춤 설정 중이에요...',
  '식단 조합을 최적화하고 있어요...',
  'AI가 플랜을 생성하고 있어요...',
];

function startLoadingSequence() {
  const msgEl = document.getElementById('loadingMsg');
  const pctEl = document.getElementById('loadingPct');

  /* 메시지 순환 */
  let msgIdx = 0;
  const msgInterval = setInterval(() => {
    if (!msgEl) return;
    msgEl.classList.add('fade');
    setTimeout(() => {
      msgIdx = (msgIdx + 1) % MESSAGES.length;
      msgEl.textContent = MESSAGES[msgIdx];
      msgEl.classList.remove('fade');
    }, 400);
  }, 1800);

  /* 사용자 데이터 로드 후 식단 + 운동 병렬 요청 */
  const userData = Storage.getUser();
  const apiPromise = Promise.allSettled([
    fetchMealPlan(userData),
    fetchWorkoutPlan(userData),
  ]);

  /* 1단계: 신체 분석 (즉시 시작, 1000ms 고정) */
  document.getElementById('step1')?.classList.add('active');
  if (pctEl) pctEl.textContent = '33% 완료';

  setTimeout(() => {
    /* 2단계: 플랜 생성 → AI 서버 응답 대기 */
    document.getElementById('step1')?.classList.replace('active', 'done');
    document.getElementById('step2')?.classList.add('active');
    if (pctEl) pctEl.textContent = '66% 완료';

    apiPromise.then(([mealResult, workoutResult]) => {
      /* 결과 localStorage 저장 */
      if (mealResult.status === 'fulfilled') {
        Storage.mergeUser({
          aiMealPlan:       mealResult.value.data,
          aiTargetCalories: mealResult.value.targetCalories,
          aiPlanDate:       getPlanDateStr(),
        });
      }
      if (workoutResult.status === 'fulfilled') {
        Storage.mergeUser({ aiWorkoutPlan: workoutResult.value.data });
      }

      /* 3단계: 최종 검토 (800ms) */
      document.getElementById('step2')?.classList.replace('active', 'done');
      document.getElementById('step3')?.classList.add('active');
      if (pctEl) pctEl.textContent = '99% 완료';

      setTimeout(() => {
        clearInterval(msgInterval);
        document.getElementById('step3')?.classList.replace('active', 'done');
        if (msgEl) msgEl.textContent = '✅ 플랜이 완성되었어요!';
        if (pctEl) pctEl.textContent = '100% 완료';
        setTimeout(() => { location.href = 'sc301.html'; }, 700);
      }, 800);
    });
  }, 1000);
}
