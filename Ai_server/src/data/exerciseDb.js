/**
 * 맨몸 운동 데이터베이스
 * intensity: 'low' | 'medium' | 'high'
 * duration: 분 (warmup/cooldown 용)
 * sets/reps: main 운동 용
 * calories: 해당 운동 소모 칼로리 근사치
 */

const WARMUP = [
    { name: '제자리 걷기',      duration: 3, calories: 15 },
    { name: '팔 돌리기',        duration: 2, calories:  8 },
    { name: '목·어깨 스트레칭', duration: 3, calories: 10 },
    { name: '허리 스트레칭',    duration: 3, calories: 10 },
    { name: '무릎 돌리기',      duration: 2, calories:  8 },
    { name: '발목 돌리기',      duration: 2, calories:  6 },
];

const MAIN = {
    low: [
        { name: '스쿼트',            sets: 3, reps: 10, calories: 50 },
        { name: '런지',              sets: 3, reps: 10, calories: 45 },
        { name: '팔굽혀펴기 (무릎)', sets: 3, reps: 10, calories: 35 },
        { name: '복부 크런치',       sets: 3, reps: 15, calories: 30 },
        { name: '플랭크',            sets: 3, reps: 20, calories: 25 }, // reps = 초
        { name: '사이드 런지',       sets: 3, reps: 12, calories: 40 },
        { name: '힙 브릿지',         sets: 3, reps: 15, calories: 30 },
        { name: '버드독',            sets: 3, reps: 12, calories: 25 },
    ],
    medium: [
        { name: '점프 스쿼트',       sets: 3, reps: 12, calories: 90 },
        { name: '버피 (변형)',        sets: 3, reps:  8, calories: 80 },
        { name: '마운틴 클라이머',   sets: 3, reps: 20, calories: 70 },
        { name: '팔굽혀펴기',        sets: 3, reps: 12, calories: 55 },
        { name: '복부 크런치',       sets: 4, reps: 20, calories: 45 },
        { name: '하이니',            sets: 3, reps: 30, calories: 60 }, // reps = 초
        { name: '스텝업',            sets: 3, reps: 12, calories: 65 },
        { name: '트라이셉 딥',       sets: 3, reps: 15, calories: 50 },
    ],
    high: [
        { name: '버피',              sets: 4, reps: 12, calories: 160 },
        { name: '점프 스쿼트',       sets: 4, reps: 15, calories: 140 },
        { name: '점핑잭',            sets: 3, reps: 60, calories:  90 }, // reps = 초
        { name: '마운틴 클라이머',   sets: 4, reps: 30, calories: 100 },
        { name: '스파이더맨 플랭크', sets: 3, reps: 20, calories:  80 },
        { name: '파워 런지',         sets: 4, reps: 12, calories: 120 },
        { name: '크로스 크런치',     sets: 4, reps: 20, calories:  60 },
    ],
};

const COOLDOWN = [
    { name: '햄스트링 스트레칭', duration: 3, calories: 8 },
    { name: '고양이 자세',       duration: 3, calories: 6 },
    { name: '어깨·가슴 스트레칭',duration: 2, calories: 5 },
    { name: '복근 스트레칭',     duration: 2, calories: 5 },
    { name: '비둘기 자세',       duration: 3, calories: 7 },
];

const EXERCISE_TIPS = {
    low:    '무리하지 말고 정확한 자세로 천천히 운동하세요. 꾸준함이 가장 중요합니다.',
    medium: '충분한 수분을 섭취하고, 세트 사이 1분씩 휴식하세요. 점진적으로 강도를 높여보세요.',
    high:   '고강도 운동 전 워밍업을 충분히 하세요. 심박수가 너무 높으면 잠시 멈추고 회복하세요.',
};

module.exports = { WARMUP, MAIN, COOLDOWN, EXERCISE_TIPS };
