const { Router } = require('express');

const router = Router();

const MESSAGES = {
    low: [
        '잘 하고 계세요! 꾸준히 식단과 운동을 이어가고 있군요. 작은 실천이 쌓여 큰 변화를 만들어냅니다. 오늘도 한 걸음씩 나아가 봐요!',
        '훌륭해요! 건강한 습관을 만들어가는 중이에요. 오늘도 계획대로 실천해보세요. 파이팅!',
        '잘 지키고 있어요! 목표에 한 걸음 더 가까워지고 있답니다. 오늘 하루도 건강하게 보내세요.',
    ],
    medium: [
        '조금 힘드셨군요. 하지만 포기하지 않았다는 것 자체가 대단해요! 오늘부터 다시 시작해보세요. 작게라도 실천하는 것이 중요합니다.',
        '완벽한 사람은 없어요. 중요한 건 다시 일어서는 것이에요. 오늘 딱 한 가지만 실천해볼까요? 물 충분히 마시기부터 시작해봐요.',
        '이런 날도 있어요. 지나간 것에 자책하지 말고, 오늘 식사 한 끼만 제대로 챙겨봐요. 그것만으로도 충분해요.',
    ],
    high: [
        '요즘 많이 힘드셨죠? 자책하지 마세요. 지금 이 앱을 켰다는 것 자체가 포기하지 않았다는 증거예요. 오늘은 작은 것 하나만 실천해보세요.',
        '힘든 시간이 있는 것은 자연스러운 일이에요. 지금까지의 노력을 인정하고, 오늘 다시 작은 한 걸음을 내딛어보세요. 응원합니다!',
        '목표까지 가는 길이 생각보다 험할 수 있어요. 그래도 괜찮아요. 오늘 딱 10분이라도 운동해보는 건 어떨까요? 시작이 반이에요.',
    ],
};

// ──────────────────────────────────────────
// POST /api/motivation — 동기부여 메시지
// Body: { userInfo, missedCount, missedReasons }
// Response: { success, message }
// ──────────────────────────────────────────
router.post('/', (req, res) => {
    const { missedCount = 0 } = req.body;

    let level;
    if (missedCount <= 1)      level = 'low';
    else if (missedCount <= 3) level = 'medium';
    else                       level = 'high';

    const pool    = MESSAGES[level];
    const message = pool[Math.floor(Math.random() * pool.length)];

    console.log(`  미이행 ${missedCount}회 → 레벨: ${level}`);
    res.json({ success: true, message });
});

module.exports = router;
