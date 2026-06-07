'use strict';

/* ============================================================
   sc311/aiChat.js — AI 채팅 사이드패널 (socket.io 스트리밍)
                      식단/운동 재조정 핸들러 포함
   의존: utils.js, render.js, meal.js, workout.js
   ============================================================ */

/* ── 채팅 히스토리 localStorage ── */
const _sc311ChatKey = () => `sc311Chat_${getCurrentUid() || 'guest'}`;
let chatHistory = (() => {
  try { return JSON.parse(localStorage.getItem(_sc311ChatKey())) || []; } catch { return []; }
})();

function saveChatHistory() {
  if (chatHistory.length > 30) chatHistory.splice(0, chatHistory.length - 30);
  try { localStorage.setItem(_sc311ChatKey(), JSON.stringify(chatHistory)); } catch {}
}

/* ── Socket.io 연결 ── */
let _aiSocket = null;
function getAiSocket() {
  if (!_aiSocket) {
    _aiSocket = io({ transports: ['websocket', 'polling'] });
    _aiSocket.on('connect',       () => console.log('[Socket] AI 서버 연결됨'));
    _aiSocket.on('connect_error', () => console.warn('[Socket] AI 서버 연결 실패'));
  }
  return _aiSocket;
}

/* ── 스트리밍 버블 생성 ── */
function createStreamBubble() {
  const messages = document.getElementById('chatMessages');
  const now  = new Date();
  const time = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  const div  = document.createElement('div');
  div.className = 'chat-msg ai';
  div.innerHTML = `
    <div class="chat-avatar">🤖</div>
    <div>
      <div class="chat-bubble"></div>
      <div class="chat-time">AI 상담사 · ${time}</div>
    </div>
  `;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
  return div;
}

/* ── 채팅 UI 초기화 ── */
function initAiChat() {
  const toggleBtn = document.getElementById('aiChatToggleBtn');
  const panel     = document.getElementById('aiChatPanel');
  const closeBtn  = document.getElementById('chatCloseBtn');
  const sendBtn   = document.getElementById('chatSendBtn');
  const input     = document.getElementById('chatInput');

  /* 사이드메뉴 AI상담 버튼도 우측 패널 열기 */
  const sideMenuAiBtn = document.getElementById('menuAiChat');
  if (sideMenuAiBtn) {
    sideMenuAiBtn.addEventListener('click', (e) => {
      e.stopImmediatePropagation();
      const isOpen = panel?.classList.toggle('open');
      toggleBtn?.classList.toggle('active', isOpen);
    });
  }

  toggleBtn?.addEventListener('click', () => {
    const isOpen = panel.classList.toggle('open');
    toggleBtn.classList.toggle('active', isOpen);
  });

  if (new URLSearchParams(location.search).get('openChat') === '1') {
    panel?.classList.add('open');
    toggleBtn?.classList.add('active');
  }

  closeBtn?.addEventListener('click', () => {
    panel.classList.remove('open');
    toggleBtn.classList.remove('active');
  });

  function sendMessage() {
    const text = input.value.trim();
    if (!text || sendBtn.disabled) return;

    appendMessage('user', text, nowTime());
    chatHistory.push({ role: 'user', text, time: nowTime() });
    saveChatHistory();
    input.value = '';
    autoResizeTextarea(input);
    sendBtn.disabled = true;

    const userData    = Storage.getUser();
    const userInfoStr = [
      userData.gender       ? `성별 ${userData.gender}`         : '',
      userData.height       ? `키 ${userData.height}cm`         : '',
      userData.weight       ? `체중 ${userData.weight}kg`       : '',
      userData.targetWeight ? `목표 ${userData.targetWeight}kg` : '',
      userData.goalWeeks    ? `기간 ${userData.goalWeeks}주`    : '',
    ].filter(Boolean).join(', ');

    const recentHistory = chatHistory.slice(-6)
      .map(h => `${h.role === 'user' ? '사용자' : 'AI'}: ${h.text}`)
      .join('\n');

    const socket    = getAiSocket();
    const streamDiv = createStreamBubble();
    const bubble    = streamDiv.querySelector('.chat-bubble');

    function onToken(token) {
      bubble.textContent += token;
      document.getElementById('chatMessages').scrollTop = 999999;
    }
    function cleanup() {
      socket.off('chat_token', onToken);
      socket.off('chat_done',  onDone);
      socket.off('chat_error', onError);
    }
    function onDone({ reply, action, reason }) {
      cleanup();
      const finalReply = reply || bubble.textContent || '죄송해요, 응답을 받지 못했어요.';
      bubble.textContent = finalReply;
      chatHistory.push({ role: 'ai', text: finalReply, time: nowTime() });
      saveChatHistory();
      sendBtn.disabled = false;
      if (action === 'meal_adjust' && reason)          handleMealAdjust(reason);
      else if (action === 'exercise_adjust' && reason) handleExerciseAdjust(reason);
    }
    function onError(errMsg) {
      cleanup();
      bubble.textContent = `오류가 발생했어요: ${errMsg}`;
      sendBtn.disabled = false;
    }

    cleanup();
    socket.on('chat_token', onToken);
    socket.on('chat_done',  onDone);
    socket.on('chat_error', onError);

    socket.emit('chat_message', {
      message:       text,
      userInfo:      userInfoStr,
      mealPlan:      userData.aiMealPlan    || null,
      workoutPlan:   userData.aiWorkoutPlan || null,
      recentHistory,
    });
  }

  sendBtn?.addEventListener('click', sendMessage);
  input?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  input?.addEventListener('input', () => autoResizeTextarea(input));

  /* 저장된 채팅 기록 복원 */
  if (chatHistory.length > 0) {
    chatHistory.forEach(msg => appendMessage(msg.role, msg.text, msg.time));
    const chatMsgs = document.getElementById('chatMessages');
    if (chatMsgs) chatMsgs.scrollTop = chatMsgs.scrollHeight;
  }
}

function appendMessage(role, text, savedTime) {
  const messages = document.getElementById('chatMessages');
  if (!messages) return;

  const time = savedTime || nowTime();

  const div = document.createElement('div');
  div.className = `chat-msg ${role}`;

  const avatar = document.createElement('div');
  avatar.className = 'chat-avatar';
  avatar.textContent = role === 'ai' ? '🤖' : '👤';

  const inner = document.createElement('div');

  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble';
  bubble.textContent = text;  /* XSS 방지 */

  const timeEl = document.createElement('div');
  timeEl.className = 'chat-time';
  timeEl.textContent = `${role === 'ai' ? 'AI 상담사' : '나'} · ${time}`;

  inner.appendChild(bubble);
  inner.appendChild(timeEl);
  div.appendChild(avatar);
  div.appendChild(inner);
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function appendTyping() {
  const messages = document.getElementById('chatMessages');
  const wrap = document.createElement('div');
  wrap.className = 'chat-msg ai';
  wrap.innerHTML = `
    <div class="chat-avatar">🤖</div>
    <div class="typing-indicator">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>
  `;
  messages.appendChild(wrap);
  messages.scrollTop = messages.scrollHeight;
  return wrap;
}

/* ════════════════════════════════
   식단 재조정
   ════════════════════════════════ */
async function handleMealAdjust(reason) {
  const userData       = Storage.getUser();
  const currentPlan    = userData.aiMealPlan;
  const targetCalories = calcTargetCalories(userData);
  if (!currentPlan) return;

  const accumulated = [...(userData.mealAdjustReasons || []), reason];

  const typingEl = appendTyping();
  try {
    const res = await fetch(`${AI_SERVER}/api/meal/adjust`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPlan, reasons: accumulated, targetCalories }),
    });
    if (!res.ok) throw new Error(`서버 오류 (${res.status})`);
    const json = await res.json();
    if (!json.success) throw new Error(json.message);

    clearAdjustState('meals');
    Storage.mergeUser({ aiMealPlan: json.data, mealAdjustReasons: accumulated });
    {
      const today = new Date();
      const todayKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
      const planKey  = lsKey('plan', todayKey);
      let plan = {};
      try { plan = JSON.parse(localStorage.getItem(planKey) || '{}'); } catch {}
      plan.mealPlan = json.data;
      localStorage.setItem(planKey, JSON.stringify(plan));
      syncDayToFirestore(todayKey);
    }
    renderMealItems(json.data);
    applyIcons();
    initMealVerify();
    initMealSkip();
    updateMealSummary(0, 0);

    typingEl.remove();
    appendMessage('ai', `✅ "${reason}" 사유로 식단을 수정했어요! 식단 탭에서 확인해보세요.`);
  } catch (err) {
    typingEl.remove();
    appendMessage('ai', `식단 수정 중 오류가 발생했어요: ${err.message}`);
  }
}

/* ════════════════════════════════
   운동 재조정
   ════════════════════════════════ */
async function handleExerciseAdjust(reason) {
  const userData    = Storage.getUser();
  const currentPlan = userData.aiWorkoutPlan;
  const targetWeeks = userData.goalWeeks;
  if (!currentPlan) return;

  const accumulated = [...(userData.workoutAdjustReasons || []), reason];

  const typingEl = appendTyping();
  try {
    const res = await fetch(`${AI_SERVER}/api/exercise/adjust`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPlan, reasons: accumulated, targetWeeks, bmi: userData.bmi, activityLevel: userData.activityLevel }),
    });
    if (!res.ok) throw new Error(`서버 오류 (${res.status})`);
    const json = await res.json();
    if (!json.success) throw new Error(json.message);

    clearAdjustState('workouts');
    Storage.mergeUser({ aiWorkoutPlan: json.data, workoutAdjustReasons: accumulated });
    {
      const today = new Date();
      const todayKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
      const planKey  = lsKey('plan', todayKey);
      let plan = {};
      try { plan = JSON.parse(localStorage.getItem(planKey) || '{}'); } catch {}
      plan.workoutPlan = json.data;
      localStorage.setItem(planKey, JSON.stringify(plan));
      syncDayToFirestore(todayKey);
    }
    renderWorkoutItems(json.data);
    applyIcons();
    initWorkoutCheck();
    updateWorkoutSummary();

    typingEl.remove();
    appendMessage('ai', `✅ "${reason}" 사유로 운동 플랜을 수정했어요! 운동 탭에서 확인해보세요.`);
  } catch (err) {
    typingEl.remove();
    appendMessage('ai', `운동 수정 중 오류가 발생했어요: ${err.message}`);
  }
}
