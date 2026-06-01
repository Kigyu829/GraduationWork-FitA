/* ================================================================
   seed_demo.js — 3주 데모 데이터 생성기
   사용법: 앱에 로그인한 상태에서 브라우저 콘솔에 전체 붙여넣기
   조건: 키 178, 몸무게 68, 남성, 8주 5kg 감량 목표
================================================================ */
(async function seedDemoData() {

  /* ── 현재 로그인 사용자 확인 ─────────────────────────────── */
  const user = firebase.auth().currentUser;
  if (!user) { alert('먼저 로그인 후 실행하세요.'); return; }
  const uid = user.uid;

  const lsKey  = (type, date) => `${type}_${uid}_${date}`;
  const userKey = `user_${uid}`;
  const regKey  = `reg_${uid}`;

  function toDateStr(daysAgo) {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0'),
    ].join('-');
  }

  /* ── 식단 템플릿 ─────────────────────────────────────────── */
  const MEAL_TEMPLATES = [

    /* 0: 기본 한식 (~1,592 kcal) */
    {
      mealPlan: {
        breakfast: { menu: ['잡곡밥', '계란말이', '배추김치'], calories: 492, protein: 26, carbs: 58, fat: 14 },
        lunch:     { menu: ['제육볶음', '잡곡밥', '콩나물무침'], calories: 623, protein: 43, carbs: 69, fat: 22 },
        dinner:    { menu: ['된장찌개', '잡곡밥', '시금치나물'], calories: 477, protein: 24, carbs: 61, fat: 11 },
        total_calories: 1592,
        tip: '단백질과 탄수화물이 균형 잡힌 하루 식단이에요.',
      },
      meals: {
        breakfast: { verified: true, kcal: 492, food: '잡곡밥', reason: 'matched' },
        lunch:     { verified: true, kcal: 623, food: '제육볶음', reason: 'matched' },
        dinner:    { verified: true, kcal: 477, food: '된장찌개', reason: 'matched' },
      },
    },

    /* 1: 닭고기 중심 (~1,608 kcal) */
    {
      mealPlan: {
        breakfast: { menu: ['잡곡밥', '계란후라이', '미역국'], calories: 468, protein: 22, carbs: 56, fat: 13 },
        lunch:     { menu: ['닭볶음탕', '잡곡밥'], calories: 672, protein: 52, carbs: 63, fat: 23 },
        dinner:    { menu: ['순두부찌개', '잡곡밥', '고사리나물'], calories: 468, protein: 23, carbs: 60, fat: 11 },
        total_calories: 1608,
        tip: '닭고기로 단백질을 충분히 챙겼어요. 운동 회복에 좋아요.',
      },
      meals: {
        breakfast: { verified: true, kcal: 468, food: '잡곡밥', reason: 'matched' },
        lunch:     { verified: true, kcal: 672, food: '닭볶음탕', reason: 'matched' },
        dinner:    { verified: true, kcal: 468, food: '순두부찌개', reason: 'matched' },
      },
    },

    /* 2: 불고기 중심 (~1,590 kcal) */
    {
      mealPlan: {
        breakfast: { menu: ['잡곡밥', '계란찜', '나박김치'], calories: 452, protein: 24, carbs: 53, fat: 12 },
        lunch:     { menu: ['불고기', '잡곡밥', '깍두기'], calories: 663, protein: 48, carbs: 71, fat: 23 },
        dinner:    { menu: ['두부조림', '잡곡밥', '배추김치'], calories: 475, protein: 19, carbs: 62, fat: 13 },
        total_calories: 1590,
        tip: '불고기의 단백질로 근육 회복을 도와요.',
      },
      meals: {
        breakfast: { verified: true, kcal: 452, food: '잡곡밥', reason: 'matched' },
        lunch:     { verified: true, kcal: 663, food: '불고기', reason: 'matched' },
        dinner:    { verified: true, kcal: 475, food: '두부조림', reason: 'matched' },
      },
    },

    /* 3: 치팅 날 (점심 짜장면으로 치팅) */
    {
      mealPlan: {
        breakfast: { menu: ['잡곡밥', '계란후라이', '배추김치'], calories: 430, protein: 21, carbs: 55, fat: 12 },
        lunch:     { menu: ['닭볶음탕', '잡곡밥'], calories: 672, protein: 52, carbs: 63, fat: 23 },
        dinner:    { menu: ['된장찌개', '잡곡밥', '애호박볶음'], calories: 490, protein: 25, carbs: 63, fat: 12 },
        total_calories: 1592,
        tip: '가끔 치팅은 괜찮아요. 내일 다시 시작해요!',
      },
      meals: {
        breakfast: { verified: true, kcal: 430, food: '잡곡밥',  reason: 'matched'  },
        lunch:     { verified: true, kcal: 550, food: '짜장면',  reason: 'cheating' },
        dinner:    { verified: true, kcal: 490, food: '된장찌개', reason: 'matched'  },
      },
    },
  ];

  /* ── 운동 템플릿 ─────────────────────────────────────────── */
  const WORKOUT_TEMPLATES = [

    /* 0: 하체 + 상체 (~303 kcal) */
    {
      plan: {
        warmup:   [{ name: '제자리 걷기', duration: '5', calories: 25 },
                   { name: '팔 벌려 뛰기', duration: '3', calories: 30 }],
        main:     [{ name: '스쿼트',   sets: 3, reps: 15, calories: 80 },
                   { name: '런지',     sets: 3, reps: 12, calories: 60 },
                   { name: '푸시업',   sets: 3, reps: 12, calories: 50 },
                   { name: '크런치',   sets: 3, reps: 20, calories: 40 }],
        cooldown: [{ name: '햄스트링 스트레칭', duration: '3', calories: 10 },
                   { name: '고양이-소 스트레칭', duration: '2', calories: 8 }],
        total_calories: 303, total_duration: 28,
        tip: '하체 근력 향상에 효과적인 루틴이에요.',
      },
      workouts: {
        '제자리 걷기':      { done: true, kcal: 25 },
        '팔 벌려 뛰기':    { done: true, kcal: 30 },
        '스쿼트':          { done: true, kcal: 80 },
        '런지':            { done: true, kcal: 60 },
        '푸시업':          { done: true, kcal: 50 },
        '크런치':          { done: true, kcal: 40 },
        '햄스트링 스트레칭': { done: true, kcal: 10 },
        '고양이-소 스트레칭': { done: true, kcal: 8 },
      },
    },

    /* 1: 코어 중심 (~258 kcal) */
    {
      plan: {
        warmup:   [{ name: '가벼운 조깅', duration: '5', calories: 40 },
                   { name: '다리 스윙',   duration: '3', calories: 20 }],
        main:     [{ name: '힙브릿지',       sets: 3, reps: 15, calories: 45 },
                   { name: '플랭크',         sets: 3, reps: 1,  calories: 30 },
                   { name: '마운틴 클라이머', sets: 3, reps: 20, calories: 70 },
                   { name: '버드독',         sets: 3, reps: 12, calories: 35 }],
        cooldown: [{ name: '척추 스트레칭', duration: '3', calories: 10 },
                   { name: '피라미드 자세', duration: '2', calories: 8 }],
        total_calories: 258, total_duration: 26,
        tip: '코어를 강화하면 자세 교정에도 도움이 돼요.',
      },
      workouts: {
        '가벼운 조깅':    { done: true, kcal: 40 },
        '다리 스윙':      { done: true, kcal: 20 },
        '힙브릿지':       { done: true, kcal: 45 },
        '플랭크':         { done: true, kcal: 30 },
        '마운틴 클라이머': { done: true, kcal: 70 },
        '버드독':         { done: true, kcal: 35 },
        '척추 스트레칭':  { done: true, kcal: 10 },
        '피라미드 자세':  { done: true, kcal: 8  },
      },
    },
  ];

  /* ── 21일 스케줄 ──────────────────────────────────────────
     [daysAgo, meal✓, workout✓, mealTpl, workoutTpl]
     null = 해당 인증 없음 (쉬는 날 등)
  ─────────────────────────────────────────────────────────── */
  const SCHEDULE = [
    // Week 1: 시작 단계
    [21, true,  true,  0, 0],
    [20, true,  true,  1, 1],
    [19, true,  false, 2, null],  // 운동 휴식
    [18, true,  true,  0, 0],
    [17, false, true,  null, 1],  // 식단 미인증
    [16, true,  true,  1, 0],
    [15, true,  false, 2, null],  // 운동 휴식
    // Week 2: 적응 단계
    [14, true,  true,  0, 0],
    [13, true,  true,  3, 1],    // 치팅 날
    [12, true,  true,  1, 0],
    [11, true,  false, 2, null],  // 운동 휴식
    [10, true,  true,  0, 1],
    [9,  true,  true,  1, 0],
    [8,  false, false, null, null], // 완전 휴식
    // Week 3: 습관 형성
    [7,  true,  true,  2, 1],
    [6,  true,  true,  0, 0],
    [5,  true,  true,  3, 1],    // 치팅 날
    [4,  true,  true,  1, 0],
    [3,  true,  false, 2, null],  // 운동 휴식
    [2,  true,  true,  0, 1],
    [1,  true,  true,  1, 0],
  ];

  /* ── 사용자 데이터 ────────────────────────────────────────── */
  const existingUser = JSON.parse(localStorage.getItem(userKey) || '{}');
  const userData = Object.assign({}, existingUser, {
    height: 178, weight: 68, gender: '남성',
    bmi: 21.5, targetWeight: 63, goalWeeks: 8,
    activityLevel: '보통', birth: '2001-03-15',
    aiMealPlan:    MEAL_TEMPLATES[1].mealPlan,
    aiWorkoutPlan: WORKOUT_TEMPLATES[0].plan,
    planDate: toDateStr(0),
  });

  localStorage.setItem(userKey, JSON.stringify(userData));
  localStorage.setItem(regKey,  toDateStr(21));

  /* Firestore 사용자 업데이트 */
  await db.collection('users').doc(uid).set({
    userData,
    createdAt: firebase.firestore.Timestamp.fromDate(
      new Date(Date.now() - 21 * 24 * 60 * 60 * 1000)
    ),
  }, { merge: true });

  console.log('👤 사용자 데이터 저장 완료');

  /* ── 21일 일별 데이터 생성 ───────────────────────────────── */
  let done = 0;
  for (const [daysAgo, mealDone, workoutDone, mealIdx, workoutIdx] of SCHEDULE) {
    const date = toDateStr(daysAgo);

    const check  = { meal: mealDone, workout: workoutDone };
    const sc311  = { meals: {}, workouts: {} };
    const plan   = {};

    if (mealIdx !== null) {
      sc311.meals  = MEAL_TEMPLATES[mealIdx].meals;
      plan.mealPlan = MEAL_TEMPLATES[mealIdx].mealPlan;
    }
    if (workoutIdx !== null) {
      sc311.workouts  = WORKOUT_TEMPLATES[workoutIdx].workouts;
      plan.workoutPlan = WORKOUT_TEMPLATES[workoutIdx].plan;
    }

    /* localStorage */
    localStorage.setItem(lsKey('check', date), JSON.stringify(check));
    localStorage.setItem(lsKey('sc311', date), JSON.stringify(sc311));
    if (Object.keys(plan).length) {
      localStorage.setItem(lsKey('plan', date), JSON.stringify(plan));
    }

    /* Firestore */
    const firestoreData = { check };
    if (mealIdx !== null || workoutIdx !== null) {
      firestoreData.sc311 = sc311;
      if (Object.keys(plan).length) firestoreData.plan = plan;
    }
    await db.collection('users').doc(uid)
      .collection('daily').doc(date)
      .set(firestoreData, { merge: true });

    done++;
    console.log(`📅 [${done}/21] ${date} 저장 완료`);
  }

  /* ── 체중 변화 데이터 (21일) ────────────────────────────── */
  const WEIGHT_LOG = {
    21: 68.0, 20: 67.8, 19: 67.9, 18: 67.6, 17: 67.5,
    16: 67.7, 15: 67.4, 14: 67.2, 13: 67.5, 12: 67.1,
    11: 66.9, 10: 67.0,  9: 66.8,  8: 66.9,  7: 66.6,
     6: 66.4,  5: 66.7,  4: 66.3,  3: 66.1,  2: 66.0,
     1: 65.8,  0: 65.6,  // 오늘 (sc300 리다이렉트 방지)
  };
  for (const [daysAgo, weight] of Object.entries(WEIGHT_LOG)) {
    const date = toDateStr(parseInt(daysAgo));
    localStorage.setItem(`todayWeight_check_${uid}_${date}`, weight);
    await db.collection('users').doc(uid).collection('daily').doc(date)
      .set({ weight }, { merge: true });
  }
  console.log('⚖️ 체중 기록 저장 완료');

  console.log('✅ 데모 데이터 생성 완료!');
  alert('✅ 3주 데모 데이터 생성 완료!\n페이지를 새로고침(F5)하세요.');
})();
