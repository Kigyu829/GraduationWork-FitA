// sc301.js — 메인 대시보드 (Gemini AI + 체중 트래커 + 물 섭취 + 스트릭)

/* ═══════════════════════════════════════════
   유틸리티
═══════════════════════════════════════════ */
function $(id) { return document.getElementById(id); }
function set(id, val) { const el = $(id); if (el) el.textContent = val; }

function showToast(msg, color) {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.style.borderColor = color || 'var(--border2)';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

/* ═══════════════════════════════════════════
   헤더 날짜
═══════════════════════════════════════════ */
(function setHeaderDate() {
  const el = $("headerDate");
  if (!el) return;
  const now  = new Date();
  const days = ["일","월","화","수","목","금","토"];
  el.textContent = `${now.getFullYear()}.${String(now.getMonth()+1).padStart(2,"0")}.${String(now.getDate()).padStart(2,"0")} (${days[now.getDay()]})`;
})();

/* ═══════════════════════════════════════════
   로컬스토리지 헬퍼
═══════════════════════════════════════════ */
const Store = {
  get:  (k)    => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set:  (k, v) => localStorage.setItem(k, JSON.stringify(v)),
  user: ()     => Store.get("healthUserData") || {},
};

/* ═══════════════════════════════════════════
   대시보드 기본 정보 렌더
═══════════════════════════════════════════ */
function renderDashboard() {
  const d = Store.user();
  if (!d || !d.weight) return;

  const currentWeight = Number(d.weight);
  const targetWeight  = Number(d.targetWeight);
  const startWeight   = Number(d.initialWeight) || (currentWeight + 5);

  let progress = 0, remain = 0;
  if (currentWeight && targetWeight && startWeight > targetWeight) {
    const totalLoss   = startWeight - targetWeight;
    const currentLoss = startWeight - currentWeight;
    progress = Math.max(0, Math.min(100, Math.round((currentLoss / totalLoss) * 100)));
    remain   = Math.max(0, currentWeight - targetWeight);
  }

  // 진행률 링
  const degree = progress * 3.6;
  const ring = $("progressRing");
  if (ring) ring.style.background =
    `conic-gradient(#66D0BC ${degree}deg, #1a2e3a ${degree}deg)`;

  set("progress",        `${progress}%`);
  set("progressBadge",   `${progress}%`);
  set("userName",         d.name        || "내 정보");
  set("userBasicInfo",    `${d.gender||"-"} · 키 ${d.height||"-"}cm · BMI ${d.bmi||"-"}`);
  set("currentWeightText",`${d.weight||"-"}kg`);
  set("targetWeightText", `${d.targetWeight||"-"}kg`);
  set("currentWeight",    `${d.weight||"-"}kg`);
  set("targetWeight",     `${d.targetWeight||"-"}kg`);
  set("remainingWeight",  `${remain.toFixed(1)}kg`);
  set("goalPeriodText",    d.goalPeriod || "-");
  set("currentWeightTextMirror", `${d.weight||"-"}kg`);

  renderBMI(d);
}

/* ═══════════════════════════════════════════
   BMI 게이지
═══════════════════════════════════════════ */
function renderBMI(d) {
  const bmi = Number(d.bmi);
  if (!bmi) return;

  set("bmiDisplay", bmi.toFixed(1));

  // 게이지 각도: BMI 10~35 → -90°~90° (반원)
  const clamp = Math.max(10, Math.min(35, bmi));
  const angle = ((clamp - 10) / 25) * 180 - 90;
  const needle = $("bmiNeedle");
  if (needle) needle.style.transform = `translateX(-50%) rotate(${angle}deg)`;

  let label = "정상", color = "var(--teal)";
  if (bmi < 18.5)     { label = "저체중"; color = "var(--blue)"; }
  else if (bmi < 23)  { label = "정상";   color = "var(--teal)"; }
  else if (bmi < 25)  { label = "과체중"; color = "var(--gold)"; }
  else                { label = "비만";   color = "var(--red)";  }

  const badge = $("bmiStatusBadge");
  if (badge) { badge.textContent = label; badge.style.color = color; }

  // BMR (Harris-Benedict)
  const w = Number(d.weight), h = Number(d.height);
  const age = d.birthYear ? new Date().getFullYear() - Number(d.birthYear) : 25;
  let bmr = 0;
  if (w && h) {
    if (d.gender === "남성") bmr = Math.round(88.362 + 13.397*w + 4.799*h - 5.677*age);
    else                     bmr = Math.round(447.593 + 9.247*w + 3.098*h - 4.330*age);
  }

  // TDEE (활동 계수)
  const activityMap = { "낮음": 1.2, "보통": 1.375, "높음": 1.55 };
  const multiplier  = activityMap[d.activityLevel] || 1.375;
  const tdee = bmr ? Math.round(bmr * multiplier) : 0;

  set("bmrValue",  bmr  ? `${bmr.toLocaleString()} kcal` : "-");
  set("tdeeValue", tdee ? `${tdee.toLocaleString()} kcal` : "-");
}

/* ═══════════════════════════════════════════
   체중 기록 & 진행률 업데이트
═══════════════════════════════════════════ */
function initWeightInput() {
  const btn   = $("saveWeightBtn");
  const input = $("todayWeightInput");
  if (!btn || !input) return;

  // 오늘 기록된 체중 미리 채우기
  const log = Store.get("weightLog") || {};
  const todayKey = getTodayKey();
  if (log[todayKey]) input.value = log[todayKey];

  btn.addEventListener("click", () => {
    const val = parseFloat(input.value);
    if (!val || val < 20 || val > 300) {
      showToast("올바른 체중을 입력해주세요", "var(--red)");
      return;
    }

    // 유저 데이터 업데이트
    const d = Store.user();
    d.weight = val;
    Store.set("healthUserData", d);

    // 체중 로그 저장
    const log = Store.get("weightLog") || {};
    log[todayKey] = val;
    Store.set("weightLog", log);

    renderDashboard();
    renderStreak();
    renderWeightChart();
    showToast(`✅ ${val}kg 기록 완료!`, "var(--teal)");
  });
}

/* ═══════════════════════════════════════════
   물 섭취 트래커
═══════════════════════════════════════════ */
function initWaterTracker() {
  const GOAL = 8;
  const todayKey = "water_" + getTodayKey();

  function getCount() { return Store.get(todayKey) || 0; }
  function setCount(n) { Store.set(todayKey, n); }

  function renderCups(count) {
    const container = $("waterCups");
    if (!container) return;
    container.innerHTML = "";
    for (let i = 0; i < GOAL; i++) {
      const cup = document.createElement("div");
      cup.className = "water-cup" + (i < count ? " filled" : "");
      cup.textContent = i < count ? "💧" : "○";
      container.appendChild(cup);
    }
    set("waterBadge", `${count} / ${GOAL}잔`);
    const ml = count * 250;
    set("waterTip", `오늘 섭취: ${ml}ml / 목표 2,000ml`);
  }

  renderCups(getCount());

  const addBtn   = $("addWaterBtn");
  const resetBtn = $("resetWaterBtn");

  if (addBtn) addBtn.addEventListener("click", () => {
    let c = getCount();
    if (c >= GOAL) { showToast("오늘 목표를 달성했어요! 🎉", "var(--teal)"); return; }
    c++;
    setCount(c);
    renderCups(c);
    if (c === GOAL) showToast("💧 오늘 물 목표 달성!", "var(--blue)");
    else showToast(`물 ${c}잔 마셨어요`);
  });

  if (resetBtn) resetBtn.addEventListener("click", () => {
    setCount(0); renderCups(0);
    showToast("초기화했어요");
  });
}

/* ═══════════════════════════════════════════
   연속 기록 스트릭
═══════════════════════════════════════════ */
function getTodayKey() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-${String(n.getDate()).padStart(2,"0")}`;
}

function renderStreak() {
  const log    = Store.get("weightLog") || {};
  const today  = new Date();
  let streak   = 0;
  let checkDay = new Date(today);

  // 오늘부터 거슬러 올라가며 연속 체크
  for (let i = 0; i < 365; i++) {
    const k = `${checkDay.getFullYear()}-${String(checkDay.getMonth()+1).padStart(2,"0")}-${String(checkDay.getDate()).padStart(2,"0")}`;
    if (log[k]) { streak++; checkDay.setDate(checkDay.getDate() - 1); }
    else break;
  }

  set("streakCount", streak);

  // 최근 7일 표시
  const weekEl = $("streakWeek");
  if (!weekEl) return;
  weekEl.innerHTML = "";
  const dayLabels = ["일","월","화","수","목","금","토"];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    const div = document.createElement("div");
    div.className = "streak-day";
    div.textContent = dayLabels[d.getDay()];
    if (log[k])   div.classList.add("done");
    if (i === 0)  div.classList.add("today-day");
    weekEl.appendChild(div);
  }

  const info = $("streakInfo");
  if (info) {
    if (streak === 0) info.textContent = "체중을 매일 기록하면 스트릭이 쌓여요!";
    else if (streak < 3) info.textContent = `${streak}일 연속 기록 중! 계속 해봐요 💪`;
    else info.textContent = `${streak}일 연속 기록! 대단해요 🔥`;
  }
}

/* ═══════════════════════════════════════════
   Gemini API — AI 추천
═══════════════════════════════════════════ */
const GEMINI_API_KEY   = ""; // ← 여기에 Gemini API 키를 입력하세요
const GEMINI_CACHE_KEY = "geminiDailyCache";

async function callGemini(apiKey, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 600 }
    })
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

function parseAiList(text) {
  // 줄마다 파싱: "아침:", "유산소:" 등
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const items = [];
  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0 && colonIdx < 10) {
      const label = line.slice(0, colonIdx).replace(/^[*\-•\d.]+\s*/, "").trim();
      const body  = line.slice(colonIdx + 1).trim().replace(/\*\*/g, "");
      if (label && body) items.push({ label, body });
    } else {
      const clean = line.replace(/^[*\-•\d.]+\s*/, "").replace(/\*\*/g, "").trim();
      if (clean && items.length > 0) items[items.length-1].body += " " + clean;
    }
  }
  return items.slice(0, 5);
}

function renderAiItems(containerId, items, fallbackMsg) {
  const el = $(containerId);
  if (!el) return;

  if (!items || items.length === 0) {
    el.innerHTML = `<div class="ai-error"><span>😅</span><span>${fallbackMsg}</span><button class="ai-retry-btn" onclick="loadAiRecommendations(true)">다시 시도</button></div>`;
    return;
  }

  el.innerHTML = "";
  el.className = "ai-content";
  items.forEach(({ label, body }) => {
    const div = document.createElement("div");
    div.className = "ai-item";
    div.innerHTML = `<span class="ai-item-label">${label}</span><span class="ai-item-text">${body}</span>`;
    el.appendChild(div);
  });
}

function setLoadingState() {
  ["mealContent","workoutContent"].forEach(id => {
    const el = $(id);
    if (el) {
      el.className = "ai-loading";
      el.innerHTML = `<div class="spinner"></div><span>AI가 맞춤 추천을 준비 중...</span>`;
    }
  });
}

let _aiLoading = false;

async function loadAiRecommendations(forceRefresh = false) {
  if (_aiLoading) return;

  const apiKey = GEMINI_API_KEY;
  if (!apiKey) {
    ["mealContent","workoutContent"].forEach(id => {
      const el = $(id);
      if (el) {
        el.className = "ai-content";
        el.innerHTML = `<div class="ai-error"><span>🔑</span><span>sc301.js 상단의 GEMINI_API_KEY를 입력해주세요</span></div>`;
      }
    });
    return;
  }

  // 오늘 캐시가 있으면 API 호출 없이 바로 렌더
  const today = getTodayKey();
  const cache = Store.get(GEMINI_CACHE_KEY) || {};
  if (!forceRefresh && cache.date === today && cache.meal && cache.workout) {
    renderAiItems("mealContent",    cache.meal,    "식단 데이터를 불러올 수 없어요");
    renderAiItems("workoutContent", cache.workout, "운동 데이터를 불러올 수 없어요");
    return;
  }

  _aiLoading = true;
  setLoadingState();

  const d          = Store.user();
  const activity   = d.activityLevel || "보통";
  const targetW    = d.targetWeight  || "목표 체중";
  const currentW   = d.weight        || "현재 체중";
  const goalPeriod = d.goalPeriod    || "12주";
  const gender     = d.gender        || "미설정";
  const bmi        = d.bmi           || "미설정";

  const mealPrompt = `당신은 영양사입니다. 아래 사용자 정보를 바탕으로 오늘의 식단을 추천해주세요.
사용자 정보:
- 성별: ${gender}
- 현재 체중: ${currentW}kg, 목표 체중: ${targetW}kg
- 활동량: ${activity}
- BMI: ${bmi}
- 목표 기간: ${goalPeriod}

아침, 점심, 저녁, 간식 4가지 항목으로 간결하게 추천해주세요.
형식: "아침: [내용]" 한 줄씩. 100자 이내로 핵심만.`;

  const workoutPrompt = `당신은 개인 트레이너입니다. 아래 사용자 정보를 바탕으로 오늘의 운동을 추천해주세요.
사용자 정보:
- 현재 체중: ${currentW}kg, 목표 체중: ${targetW}kg
- 활동량: ${activity}
- BMI: ${bmi}

유산소, 근력, 스트레칭 3가지 항목으로 간결하게 추천해주세요.
형식: "유산소: [내용]" 한 줄씩. 각 항목 50자 이내.`;

  try {
    // Promise.all 대신 순차 호출로 429 방지
    const mealText    = await callGemini(apiKey, mealPrompt);
    const workoutText = await callGemini(apiKey, workoutPrompt);

    const mealItems    = parseAiList(mealText);
    const workoutItems = parseAiList(workoutText);

    // 오늘 날짜로 캐시 저장 → 이후 재방문 시 API 호출 없음
    Store.set(GEMINI_CACHE_KEY, { date: today, meal: mealItems, workout: workoutItems });

    renderAiItems("mealContent",    mealItems,    "식단 추천을 불러오지 못했어요");
    renderAiItems("workoutContent", workoutItems, "운동 추천을 불러오지 못했어요");

  } catch (err) {
    console.error("Gemini API error:", err);
    const msg = err.message.includes("429")
      ? "요청 한도 초과 (429)<br><small>잠시 후 다시 시도해주세요</small>"
      : `오류: ${err.message}`;
    ["mealContent","workoutContent"].forEach(id => {
      const el = $(id);
      if (el) el.innerHTML = `<div class="ai-error"><span>⚠️</span><span>${msg}</span><button class="ai-retry-btn" onclick="loadAiRecommendations(true)">다시 시도</button></div>`;
    });
  } finally {
    _aiLoading = false;
  }
}

/* ═══════════════════════════════════════════
   API 키 모달
═══════════════════════════════════════════ */
function initApiModal() {
  loadAiRecommendations();
}

/* ═══════════════════════════════════════════
   달력
═══════════════════════════════════════════ */
const calendarTitle    = $("calendarTitle");
const calendarDaysEl   = $("calendarDays");
const prevMonthBtn     = $("prevMonthBtn");
const nextMonthBtn     = $("nextMonthBtn");
const selectedDateText = $("selectedDateText");
const schedulePopup    = $("schedulePopup");
const popupDateLabel   = $("popupDateLabel");
const scheduleInput    = $("scheduleInput");
const saveScheduleBtn  = $("saveScheduleBtn");
const scheduleListEl   = $("scheduleList");
const closePopupBtn    = $("closePopupBtn");
const calendarBox      = document.querySelector(".calendar-box");

let currentDate    = new Date();
let selectedDateKey = "";

const todayKey = getTodayKey();

function getScheduleData()      { return Store.get("calendarSchedules") || {}; }
function saveScheduleData(data) { Store.set("calendarSchedules", data); }

function formatDisplayDate(k) {
  const [y, m, d] = k.split("-");
  return `${y}.${m}.${d}`;
}

function renderScheduleList(dateKey) {
  if (!scheduleListEl) return;
  const items = (getScheduleData()[dateKey]) || [];
  scheduleListEl.innerHTML = "";
  if (items.length === 0) {
    const li = document.createElement("li");
    li.textContent = "등록된 일정이 없습니다.";
    li.style.color = "var(--text-mute)";
    li.style.justifyContent = "center";
    scheduleListEl.appendChild(li);
    return;
  }
  items.forEach((item, idx) => {
    const li    = document.createElement("li");
    const span  = document.createElement("span");
    span.textContent = item;
    span.style.flex = "1";
    span.style.overflow = "hidden";
    span.style.textOverflow = "ellipsis";
    span.style.whiteSpace = "nowrap";
    const delBtn = document.createElement("button");
    delBtn.className = "schedule-delete-btn";
    delBtn.textContent = "×";
    delBtn.addEventListener("click", () => {
      const data = getScheduleData();
      data[dateKey].splice(idx, 1);
      if (data[dateKey].length === 0) delete data[dateKey];
      saveScheduleData(data);
      renderScheduleList(dateKey);
      renderCalendar();
    });
    li.appendChild(span);
    li.appendChild(delBtn);
    scheduleListEl.appendChild(li);
  });
}

function openSchedulePopup(dateKey, btn) {
  selectedDateKey = dateKey;
  if (popupDateLabel) popupDateLabel.textContent = formatDisplayDate(dateKey);
  if (selectedDateText) selectedDateText.textContent = formatDisplayDate(dateKey);
  if (scheduleInput)  scheduleInput.value = "";
  renderScheduleList(dateKey);

  if (!calendarBox || !schedulePopup || !btn) {
    schedulePopup?.classList.add("show"); return;
  }

  const boxRect = calendarBox.getBoundingClientRect();
  const btnRect = btn.getBoundingClientRect();
  const pw = 200, ph = 200;
  let left = btnRect.left - boxRect.left;
  let top  = btnRect.bottom - boxRect.top + 6;
  if (left + pw > boxRect.width - 8) left = boxRect.width - pw - 8;
  if (left < 8) left = 8;
  if (top + ph > boxRect.height - 8) top = btnRect.top - boxRect.top - ph - 8;
  if (top < 8) top = 8;
  schedulePopup.style.left = `${left}px`;
  schedulePopup.style.top  = `${top}px`;
  schedulePopup.classList.add("show");
}

function renderCalendar() {
  if (!calendarTitle || !calendarDaysEl) return;
  const year  = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthNames = ["January","February","March","April","May","June",
                      "July","August","September","October","November","December"];
  calendarTitle.textContent = `${monthNames[month]} ${year}`;
  calendarDaysEl.innerHTML  = "";

  const firstDay = new Date(year, month, 1);
  const lastDate = new Date(year, month + 1, 0).getDate();
  let startDay   = firstDay.getDay();
  startDay       = startDay === 0 ? 6 : startDay - 1;

  const schedules = getScheduleData();

  for (let i = 0; i < startDay; i++) {
    const empty = document.createElement("button");
    empty.className = "calendar-day empty";
    calendarDaysEl.appendChild(empty);
  }

  for (let day = 1; day <= lastDate; day++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "calendar-day";
    btn.textContent = day;
    const dateKey = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    if (dateKey === todayKey)        btn.classList.add("today");
    if (dateKey === selectedDateKey) btn.classList.add("active");
    if (schedules[dateKey]?.length)  btn.classList.add("has-schedule");
    btn.addEventListener("click", function () {
      openSchedulePopup(dateKey, btn);
      renderCalendar();
    });
    calendarDaysEl.appendChild(btn);
  }
}

if (prevMonthBtn) prevMonthBtn.addEventListener("click", () => { currentDate.setMonth(currentDate.getMonth()-1); renderCalendar(); });
if (nextMonthBtn) nextMonthBtn.addEventListener("click", () => { currentDate.setMonth(currentDate.getMonth()+1); renderCalendar(); });

if (saveScheduleBtn) saveScheduleBtn.addEventListener("click", () => {
  const text = scheduleInput?.value.trim();
  if (!text || !selectedDateKey) return;
  const s = getScheduleData();
  if (!s[selectedDateKey]) s[selectedDateKey] = [];
  s[selectedDateKey].push(text);
  saveScheduleData(s);
  if (scheduleInput) scheduleInput.value = "";
  renderScheduleList(selectedDateKey);
  renderCalendar();
});

if (scheduleInput) scheduleInput.addEventListener("keydown", e => {
  if (e.key === "Enter") saveScheduleBtn?.click();
});

if (closePopupBtn) closePopupBtn.addEventListener("click", () => {
  schedulePopup?.classList.remove("show");
});

selectedDateKey = todayKey;
if (selectedDateText) selectedDateText.textContent = formatDisplayDate(todayKey);

/* ═══════════════════════════════════════════
   메뉴 버튼
═══════════════════════════════════════════ */
document.querySelectorAll(".menu-btn[data-href]").forEach(btn => {
  btn.addEventListener("click", () => window.location.href = btn.dataset.href);
});

/* ═══════════════════════════════════════════
   로그아웃
═══════════════════════════════════════════ */
const logoutBtn = $("logoutBtn");
if (logoutBtn) logoutBtn.addEventListener("click", () => {
  if (confirm("로그아웃 하시겠습니까?")) {
    localStorage.removeItem("healthUserData");
    localStorage.removeItem("calendarSchedules");
    window.location.href = "sc101.html";
  }
});

/* ═══════════════════════════════════════════
   체중 변화 차트 (Canvas)
═══════════════════════════════════════════ */
function renderWeightChart() {
  const canvas   = document.getElementById("weightChart");
  const emptyMsg = document.getElementById("chartEmpty");
  if (!canvas) return;

  const log = Store.get("weightLog") || {};
  const today = new Date();

  // 최근 7일 날짜키 & 값 수집
  const labels = [], values = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    const dayLabel = `${d.getMonth()+1}/${d.getDate()}`;
    labels.push(dayLabel);
    values.push(log[k] || null);
  }

  const hasData = values.some(v => v !== null);
  if (emptyMsg) emptyMsg.style.display = hasData ? "none" : "flex";
  if (!hasData) return;

  const ctx    = canvas.getContext("2d");
  const W      = canvas.offsetWidth  || canvas.parentElement.offsetWidth  || 200;
  const H      = canvas.offsetHeight || canvas.parentElement.offsetHeight || 100;
  canvas.width  = W;
  canvas.height = H;

  const pad = { top: 16, right: 12, bottom: 28, left: 36 };
  const chartW = W - pad.left - pad.right;
  const chartH = H - pad.top  - pad.bottom;

  // Y축 범위
  const filled = values.filter(v => v !== null);
  const minV = Math.min(...filled) - 2;
  const maxV = Math.max(...filled) + 2;

  function xPos(i)   { return pad.left + (i / (labels.length - 1)) * chartW; }
  function yPos(val) { return pad.top  + (1 - (val - minV) / (maxV - minV)) * chartH; }

  ctx.clearRect(0, 0, W, H);

  // 그리드 선
  ctx.strokeStyle = "rgba(36,56,64,0.8)";
  ctx.lineWidth   = 1;
  for (let g = 0; g <= 4; g++) {
    const y = pad.top + (g / 4) * chartH;
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + chartW, y); ctx.stroke();
    const val = maxV - (g / 4) * (maxV - minV);
    ctx.fillStyle = "rgba(77,107,122,0.9)";
    ctx.font = "9px 'Nanum Gothic', sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(val.toFixed(1), pad.left - 4, y + 3);
  }

  // X축 레이블
  ctx.fillStyle = "rgba(77,107,122,0.9)";
  ctx.font = "9px 'Nanum Gothic', sans-serif";
  ctx.textAlign = "center";
  labels.forEach((lbl, i) => {
    ctx.fillText(lbl, xPos(i), H - 6);
  });

  // 그라디언트 영역
  const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + chartH);
  grad.addColorStop(0,   "rgba(102,208,188,0.3)");
  grad.addColorStop(1,   "rgba(102,208,188,0)");

  // 첫 유효 포인트 찾기
  let firstIdx = values.findIndex(v => v !== null);
  if (firstIdx < 0) return;

  ctx.beginPath();
  ctx.moveTo(xPos(firstIdx), yPos(values[firstIdx]));
  for (let i = firstIdx + 1; i < values.length; i++) {
    if (values[i] !== null) ctx.lineTo(xPos(i), yPos(values[i]));
    else {
      // 빈 구간은 건너뜀
      let next = values.slice(i+1).findIndex(v => v !== null);
      if (next >= 0) { i += next; ctx.moveTo(xPos(i), yPos(values[i])); }
    }
  }
  // 영역 닫기
  const lastIdx = values.map((v,i) => v !== null ? i : -1).filter(i => i >= 0).pop();
  ctx.lineTo(xPos(lastIdx), pad.top + chartH);
  ctx.lineTo(xPos(firstIdx), pad.top + chartH);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // 라인
  ctx.beginPath();
  let started = false;
  values.forEach((v, i) => {
    if (v === null) { started = false; return; }
    if (!started) { ctx.moveTo(xPos(i), yPos(v)); started = true; }
    else          { ctx.lineTo(xPos(i), yPos(v)); }
  });
  ctx.strokeStyle = "#66D0BC";
  ctx.lineWidth   = 2;
  ctx.lineJoin    = "round";
  ctx.stroke();

  // 점
  values.forEach((v, i) => {
    if (v === null) return;
    ctx.beginPath();
    ctx.arc(xPos(i), yPos(v), 3, 0, Math.PI * 2);
    ctx.fillStyle   = "#66D0BC";
    ctx.strokeStyle = "#09131a";
    ctx.lineWidth   = 1.5;
    ctx.fill();
    ctx.stroke();
    // 값 표시
    ctx.fillStyle  = "#FFFFFF";
    ctx.font       = "9px 'Nanum Gothic', sans-serif";
    ctx.textAlign  = "center";
    ctx.fillText(v + "kg", xPos(i), yPos(v) - 7);
  });
}

/* ═══════════════════════════════════════════
   초기화
═══════════════════════════════════════════ */
renderDashboard();
initWeightInput();
initWaterTracker();
renderStreak();
renderCalendar();
renderWeightChart();
initApiModal();

/* ═══════════════════════════════════════════
   내 정보 수정 카드
═══════════════════════════════════════════ */
function initProfileEdit() {
  const fields = ['Name','Gender','Height','Weight','TargetWeight','BirthYear','Activity','GoalPeriod'];
  const keyMap = {
    Name: 'name', Gender: 'gender', Height: 'height', Weight: 'weight',
    TargetWeight: 'targetWeight', BirthYear: 'birthYear',
    Activity: 'activityLevel', GoalPeriod: 'goalPeriod'
  };

  // 저장된 데이터 불러와 미리 채우기
  function populateFields() {
    const d = Store.user();
    fields.forEach(f => {
      const el = $('edit' + f);
      if (el) el.value = d[keyMap[f]] || '';
    });
  }

  populateFields();

  // 저장
  const saveBtn = $('saveProfileBtn');
  if (saveBtn) saveBtn.addEventListener('click', () => {
    const d = Store.user();
    fields.forEach(f => {
      const el = $('edit' + f);
      if (!el) return;
      const val = el.value.trim();
      if (val) d[keyMap[f]] = val;
    });

    // BMI 재계산
    const w = Number(d.weight), h = Number(d.height);
    if (w && h) d.bmi = (w / ((h / 100) ** 2)).toFixed(1);

    Store.set('healthUserData', d);
    renderDashboard();
    renderWeightChart();
    showToast('✅ 내 정보가 저장되었습니다!', 'var(--teal)');
  });

  // 취소 — 원래 값으로 복원
  const cancelBtn = $('cancelProfileBtn');
  if (cancelBtn) cancelBtn.addEventListener('click', () => {
    populateFields();
    showToast('변경사항이 취소되었습니다', 'var(--border2)');
  });
}

/* ═══════════════════════════════════════════
   푸터 모달
═══════════════════════════════════════════ */
const FOOTER_CONTENT = {
  terms: {
    title: '이용약관',
    html: `
      <h3>제1조 (목적)</h3>
      <p>이 약관은 HealthDash(이하 "서비스")가 제공하는 건강 관리 서비스의 이용 조건 및 절차, 회사와 이용자의 권리·의무 및 책임 사항을 규정함을 목적으로 합니다.</p>
      <h3>제2조 (서비스 이용)</h3>
      <p>이용자는 본 약관에 동의하고 서비스에 회원 가입함으로써 서비스를 이용할 수 있습니다. 서비스는 건강 정보 제공 목적이며, 의료적 진단을 대체하지 않습니다.</p>
      <h3>제3조 (개인정보 보호)</h3>
      <p>서비스는 이용자의 개인정보를 소중히 여기며, 관련 법령에 따라 안전하게 관리합니다. 자세한 내용은 개인정보처리방침을 참고해주세요.</p>
      <h3>제4조 (서비스 변경 및 중단)</h3>
      <p>서비스는 운영상 필요한 경우 서비스의 내용을 변경하거나 중단할 수 있으며, 사전에 공지합니다.</p>
      <h3>제5조 (면책사항)</h3>
      <p>서비스가 제공하는 건강 정보 및 AI 추천은 참고용이며, 전문 의료인의 진단이나 처방을 대체하지 않습니다.</p>
    `
  },
  privacy: {
    title: '개인정보처리방침',
    html: `
      <h3>수집하는 개인정보</h3>
      <p>서비스는 회원가입 및 서비스 이용 과정에서 이름, 성별, 생년, 키, 체중, 목표 체중 등의 건강 정보를 수집합니다.</p>
      <h3>개인정보 이용 목적</h3>
      <p>수집된 정보는 맞춤형 식단·운동 추천, 건강 지표 계산, 목표 달성 진행률 표시 등 서비스 제공 목적으로만 사용됩니다.</p>
      <h3>개인정보 보관 기간</h3>
      <p>회원 탈퇴 시까지 보관하며, 탈퇴 후 즉시 파기합니다. 단, 관련 법령에 따라 일정 기간 보관이 필요한 경우 해당 기간 동안 보관합니다.</p>
      <h3>제3자 제공</h3>
      <p>이용자의 동의 없이 개인정보를 제3자에게 제공하지 않습니다. 단, 법령에 의한 요청이 있는 경우 예외로 합니다.</p>
      <h3>데이터 보안</h3>
      <p>건강 데이터는 이용자의 기기 내 로컬 스토리지에 저장되며, 서버로 전송되지 않습니다.</p>
    `
  },
  notice: {
    title: '공지사항',
    html: `
      <div class="notice-item">
        <div class="notice-date">2025.04.15</div>
        <div class="notice-title">🎉 HealthDash v2.0 출시 안내</div>
        <p style="margin-top:6px;font-size:13px;">AI 식단 추천 기능이 대폭 개선되었습니다. Gemini AI를 활용한 맞춤형 추천을 경험해보세요.</p>
      </div>
      <div class="notice-item">
        <div class="notice-date">2025.03.20</div>
        <div class="notice-title">🔧 체중 변화 차트 기능 개선</div>
        <p style="margin-top:6px;font-size:13px;">최근 7일 체중 추이를 더 직관적으로 확인할 수 있도록 차트가 개선되었습니다.</p>
      </div>
      <div class="notice-item">
        <div class="notice-date">2025.02.10</div>
        <div class="notice-title">📅 달력 일정 관리 기능 추가</div>
        <p style="margin-top:6px;font-size:13px;">대시보드에서 바로 일정을 등록하고 관리할 수 있는 기능이 추가되었습니다.</p>
      </div>
      <div class="notice-item">
        <div class="notice-date">2025.01.01</div>
        <div class="notice-title">🚀 HealthDash 서비스 오픈</div>
        <p style="margin-top:6px;font-size:13px;">HealthDash가 정식 오픈했습니다. 건강한 새해를 HealthDash와 함께 시작하세요!</p>
      </div>
    `
  },
  contact: {
    title: '문의하기',
    html: `
      <p>서비스 이용 중 불편한 점이나 개선 사항이 있으시면 아래 양식으로 문의해주세요.</p>
      <div class="contact-form">
        <input type="text" id="contactName" placeholder="이름" />
        <input type="email" id="contactEmail" placeholder="이메일 주소" />
        <textarea id="contactMessage" placeholder="문의 내용을 입력해주세요..."></textarea>
        <button class="contact-submit" onclick="submitContact()">문의 보내기</button>
      </div>
    `
  }
};

function openFooterModal(type) {
  const data = FOOTER_CONTENT[type];
  if (!data) return;
  const overlay = $('footerModalOverlay');
  const title   = $('footerModalTitle');
  const body    = $('footerModalBody');
  if (!overlay || !title || !body) return;
  title.textContent = data.title;
  body.innerHTML    = data.html;
  overlay.classList.add('show');
}

function closeFooterModal() {
  const overlay = $('footerModalOverlay');
  if (overlay) overlay.classList.remove('show');
}

function submitContact() {
  const name  = document.getElementById('contactName')?.value.trim();
  const email = document.getElementById('contactEmail')?.value.trim();
  const msg   = document.getElementById('contactMessage')?.value.trim();
  if (!name || !email || !msg) {
    showToast('모든 항목을 입력해주세요', 'var(--red)'); return;
  }
  closeFooterModal();
  showToast('✅ 문의가 접수되었습니다. 감사합니다!', 'var(--teal)');
}

function initFooterModals() {
  const map = {
    footerTerms:   'terms',
    footerPrivacy: 'privacy',
    footerNotice:  'notice',
    footerContact: 'contact'
  };
  Object.entries(map).forEach(([id, type]) => {
    const el = $(id);
    if (el) el.addEventListener('click', e => { e.preventDefault(); openFooterModal(type); });
  });

  const closeBtn = $('footerModalClose');
  if (closeBtn) closeBtn.addEventListener('click', closeFooterModal);

  const overlay = $('footerModalOverlay');
  if (overlay) overlay.addEventListener('click', e => {
    if (e.target === overlay) closeFooterModal();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeFooterModal();
  });
}

/* ═══════════════════════════════════════════
   추가 초기화 실행
═══════════════════════════════════════════ */
initProfileEdit();
initFooterModals();
