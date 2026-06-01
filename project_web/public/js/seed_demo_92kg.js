/* ================================================================
   seed_demo_92kg.js — 20일 데모 데이터 생성기
   사용법: 앱에 로그인한 상태에서 브라우저 콘솔에 전체 붙여넣기
   조건: 키 187, 몸무게 92, 남성, 16주 7kg 감량 목표 (목표 85kg)
   TDEE ≈ 2,700 kcal → 목표 섭취 ≈ 2,200 kcal (약 500 kcal 적자)
================================================================ */
firebase.auth().onAuthStateChanged(async function seedDemoData(user) {
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

  /* ── 식단 템플릿 (~2,200 kcal / 고체중 감량 목표) ──────────
     단백질 목표: 체중 × 1.6 = 147g 이상
  ─────────────────────────────────────────────────────────── */
  const MEAL_TEMPLATES = [

    /* 0: 기본 한식 고단백 (~2,198 kcal) */
    {
      mealPlan: {
        breakfast: { menu: ['잡곡밥', '계란후라이 2개', '된장국', '배추김치'], calories: 548, protein: 32, carbs: 65, fat: 16 },
        lunch:     { menu: ['제육볶음', '잡곡밥', '두부조림', '콩나물무침'], calories: 895, protein: 58, carbs: 92, fat: 28 },
        dinner:    { menu: ['닭가슴살 구이', '잡곡밥', '미역국', '시금치나물'], calories: 755, protein: 54, carbs: 78, fat: 14 },
        total_calories: 2198,
        tip: '단백질을 충분히 섭취해 근육 유지하며 지방만 태워요.',
      },
      meals: {
        breakfast: { verified: true, kcal: 548, food: '잡곡밥+계란', reason: 'matched' },
        lunch:     { verified: true, kcal: 895, food: '제육볶음', reason: 'matched' },
        dinner:    { verified: true, kcal: 755, food: '닭가슴살', reason: 'matched' },
      },
    },

    /* 1: 닭고기·해산물 중심 (~2,180 kcal) */
    {
      mealPlan: {
        breakfast: { menu: ['잡곡밥', '계란찜', '미역국', '나박김치'], calories: 522, protein: 30, carbs: 62, fat: 13 },
        lunch:     { menu: ['닭볶음탕', '잡곡밥', '깍두기', '브로콜리 무침'], calories: 920, protein: 65, carbs: 88, fat: 26 },
        dinner:    { menu: ['고등어구이', '잡곡밥', '된장찌개', '숙주나물'], calories: 738, protein: 48, carbs: 80, fat: 18 },
        total_calories: 2180,
        tip: '오메가3 풍부한 고등어로 지방 분해를 도와요.',
      },
      meals: {
        breakfast: { verified: true, kcal: 522, food: '잡곡밥+계란찜', reason: 'matched' },
        lunch:     { verified: true, kcal: 920, food: '닭볶음탕', reason: 'matched' },
        dinner:    { verified: true, kcal: 738, food: '고등어구이', reason: 'matched' },
      },
    },

    /* 2: 저탄 고단백 (~2,160 kcal) */
    {
      mealPlan: {
        breakfast: { menu: ['현미밥', '삶은 계란 2개', '야채 샐러드', '닭가슴살'], calories: 510, protein: 42, carbs: 45, fat: 12 },
        lunch:     { menu: ['불고기', '현미밥', '두부김치', '무생채'], calories: 890, protein: 62, carbs: 85, fat: 25 },
        dinner:    { menu: ['삼치구이', '현미밥', '순두부찌개', '애호박볶음'], calories: 760, protein: 50, carbs: 76, fat: 19 },
        total_calories: 2160,
        tip: '탄수화물을 현미로 교체해 혈당 스파이크를 줄여요.',
      },
      meals: {
        breakfast: { verified: true, kcal: 510, food: '현미밥+계란', reason: 'matched' },
        lunch:     { verified: true, kcal: 890, food: '불고기', reason: 'matched' },
        dinner:    { verified: true, kcal: 760, food: '삼치구이', reason: 'matched' },
      },
    },

    /* 3: 치팅 날 (점심 외식, ~2,430 kcal) */
    {
      mealPlan: {
        breakfast: { menu: ['잡곡밥', '계란후라이 2개', '미역국', '배추김치'], calories: 548, protein: 32, carbs: 65, fat: 16 },
        lunch:     { menu: ['제육볶음', '잡곡밥', '두부조림', '콩나물무침'], calories: 895, protein: 58, carbs: 92, fat: 28 },
        dinner:    { menu: ['닭가슴살 구이', '잡곡밥', '미역국', '시금치나물'], calories: 755, protein: 54, carbs: 78, fat: 14 },
        total_calories: 2198,
        tip: '오늘 조금 넘었어도 괜찮아요. 내일 다시 식단 지켜요!',
      },
      meals: {
        breakfast: { verified: true, kcal: 548, food: '잡곡밥',  reason: 'matched'  },
        lunch:     { verified: true, kcal: 980, food: '삼겹살',  reason: 'cheating' },
        dinner:    { verified: true, kcal: 755, food: '닭가슴살', reason: 'matched'  },
      },
    },
  ];

  /* ── 운동 템플릿 (고체중 → 칼로리 소모 높음) ───────────────── */
  const WORKOUT_TEMPLATES = [

    /* 0: 전신 근력 + 유산소 (~412 kcal) */
    {
      plan: {
        warmup:   [{ name: '제자리 걷기', duration: '5', calories: 35 },
                   { name: '팔 벌려 뛰기', duration: '3', calories: 42 }],
        main:     [{ name: '스쿼트',   sets: 4, reps: 15, calories: 105 },
                   { name: '런지',     sets: 3, reps: 12, calories: 78 },
                   { name: '푸시업',   sets: 3, reps: 12, calories: 65 },
                   { name: '크런치',   sets: 3, reps: 20, calories: 52 }],
        cooldown: [{ name: '햄스트링 스트레칭', duration: '3', calories: 15 },
                   { name: '고양이-소 스트레칭', duration: '2', calories: 10 },
                   { name: '흉추 스트레칭', duration: '2', calories: 10 }],
        total_calories: 412, total_duration: 35,
        tip: '하체 대근육 위주 운동으로 칼로리 소모를 극대화해요.',
      },
      workouts: {
        '제자리 걷기':      { done: true, kcal: 35 },
        '팔 벌려 뛰기':    { done: true, kcal: 42 },
        '스쿼트':          { done: true, kcal: 105 },
        '런지':            { done: true, kcal: 78 },
        '푸시업':          { done: true, kcal: 65 },
        '크런치':          { done: true, kcal: 52 },
        '햄스트링 스트레칭': { done: true, kcal: 15 },
        '고양이-소 스트레칭': { done: true, kcal: 10 },
        '흉추 스트레칭':   { done: true, kcal: 10 },
      },
    },

    /* 1: 코어 + 유산소 중심 (~388 kcal) */
    {
      plan: {
        warmup:   [{ name: '가벼운 조깅', duration: '5', calories: 58 },
                   { name: '다리 스윙',   duration: '3', calories: 28 }],
        main:     [{ name: '힙브릿지',       sets: 3, reps: 15, calories: 55 },
                   { name: '플랭크',         sets: 3, reps: 1,  calories: 40 },
                   { name: '마운틴 클라이머', sets: 3, reps: 20, calories: 95 },
                   { name: '버피테스트',     sets: 3, reps: 10, calories: 90 }],
        cooldown: [{ name: '척추 스트레칭', duration: '3', calories: 12 },
                   { name: '피라미드 자세', duration: '2', calories: 10 }],
        total_calories: 388, total_duration: 32,
        tip: '버피로 심박수를 올려 지방 연소를 극대화해요.',
      },
      workouts: {
        '가벼운 조깅':    { done: true, kcal: 58 },
        '다리 스윙':      { done: true, kcal: 28 },
        '힙브릿지':       { done: true, kcal: 55 },
        '플랭크':         { done: true, kcal: 40 },
        '마운틴 클라이머': { done: true, kcal: 95 },
        '버피테스트':     { done: true, kcal: 90 },
        '척추 스트레칭':  { done: true, kcal: 12 },
        '피라미드 자세':  { done: true, kcal: 10 },
      },
    },
  ];

  /* ── 20일 스케줄 ──────────────────────────────────────────
     [daysAgo, meal✓, workout✓, mealTpl, workoutTpl]
     null = 해당 인증 없음 (쉬는 날 등)
  ─────────────────────────────────────────────────────────── */
  const SCHEDULE = [
    // Week 1: 시작 단계
    [20, true,  true,  0, 0],
    [19, true,  true,  1, 1],
    [18, true,  false, 2, null],  // 운동 휴식
    [17, true,  true,  0, 0],
    [16, false, true,  null, 1],  // 식단 미인증
    [15, true,  true,  1, 0],
    [14, true,  false, 2, null],  // 운동 휴식
    // Week 2: 적응 단계
    [13, true,  true,  0, 0],
    [12, true,  true,  3, 1],    // 치팅 날
    [11, true,  true,  1, 0],
    [10, true,  false, 2, null],  // 운동 휴식
    [9,  true,  true,  0, 1],
    [8,  true,  true,  1, 0],
    [7,  false, false, null, null], // 완전 휴식
    // Week 3: 습관 형성
    [6,  true,  true,  2, 1],
    [5,  true,  true,  0, 0],
    [4,  true,  true,  3, 1],    // 치팅 날
    [3,  true,  true,  1, 0],
    [2,  true,  false, 2, null],  // 운동 휴식
    [1,  true,  true,  0, 1],
  ];

  /* ── 사용자 데이터 ────────────────────────────────────────── */
  const existingUser = JSON.parse(localStorage.getItem(userKey) || '{}');
  const userData = Object.assign({}, existingUser, {
    height: 187, weight: 92, gender: '남성',
    bmi: 26.3, targetWeight: 85, goalWeeks: 16,
    activityLevel: '보통', birth: '1999-05-10',
    aiMealPlan:    MEAL_TEMPLATES[0].mealPlan,
    aiWorkoutPlan: WORKOUT_TEMPLATES[0].plan,
    planDate: toDateStr(0),
  });

  localStorage.setItem(userKey, JSON.stringify(userData));
  localStorage.setItem(regKey,  toDateStr(20));

  /* Firestore 사용자 업데이트 */
  await db.collection('users').doc(uid).set({
    userData,
    createdAt: firebase.firestore.Timestamp.fromDate(
      new Date(Date.now() - 20 * 24 * 60 * 60 * 1000)
    ),
  }, { merge: true });

  console.log('👤 사용자 데이터 저장 완료');

  /* ── 20일 일별 데이터 생성 ───────────────────────────────── */
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
    console.log(`📅 [${done}/20] ${date} 저장 완료`);
  }

  /* ── 체중 변화 데이터 (20일, 점진적 감량) ──────────────────
     시작: 92.0 → 20일 후: ~91.1 (약 0.9kg 감량 + 자연 변동)
  ─────────────────────────────────────────────────────────── */
  const WEIGHT_LOG = {
    20: 92.0, 19: 91.8, 18: 91.9, 17: 91.7, 16: 91.6,
    15: 91.8, 14: 91.5, 13: 91.4, 12: 91.6, 11: 91.3,
    10: 91.2, 9:  91.4,  8: 91.1,  7: 91.2,  6: 91.0,
     5: 90.9,  4: 91.1,  3: 90.8,  2: 90.7,  1: 90.9,
     0: 90.6,  // 오늘 (sc300 리다이렉트 방지)
  };
  for (const [daysAgo, weight] of Object.entries(WEIGHT_LOG)) {
    const date = toDateStr(parseInt(daysAgo));
    localStorage.setItem(`todayWeight_check_${uid}_${date}`, weight);
    await db.collection('users').doc(uid).collection('daily').doc(date)
      .set({ weight }, { merge: true });
  }
  console.log('⚖️ 체중 기록 저장 완료');

  console.log('✅ 데모 데이터 생성 완료!');
  alert('✅ 20일 데모 데이터 생성 완료!\n페이지를 새로고침(F5)하세요.');
});
