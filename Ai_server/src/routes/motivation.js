const { Router } = require('express');
const { callGemini } = require('../config');

const router = Router();

// ──────────────────────────────────────────
// POST /api/motivation — 동기부여 메시지
// Body: { userInfo, missedCount, missedReasons }
//   userInfo: "성별 남성, 키 175cm ..." (문자열, 선택)
//   missedCount: 미이행 횟수 (기본값 0)
//   missedReasons: "치팅 1회, 식단 불일치 2회" (문자열, 선택)
// Response: { success, message }
// ──────────────────────────────────────────
router.post('/', async (req, res) => {
    const { userInfo, missedCount = 0, missedReasons = '' } = req.body;

    const prompt =
        "당신은 따뜻한 다이어트 코칭 AI입니다.\n" +
        (userInfo ? "사용자 정보: " + userInfo + "\n\n" : "") +
        "사용자가 최근 " + missedCount + "회 식단/운동을 미이행했습니다.\n" +
        "미이행 사유: " + (missedReasons || "알 수 없음") + "\n\n" +
        "사용자가 포기하지 않도록 따뜻하고 현실적인 격려 메시지를 작성해주세요.\n" +
        "- 3~4문장\n" +
        "- 자책하지 않도록 배려\n" +
        "- 구체적인 작은 실천 제안 포함\n" +
        "- 답변만 출력 (JSON 불필요)";

    try {
        console.log(`  미이행 ${missedCount}회 / 사유: "${missedReasons}" | Gemini 요청 중...`);
        const message = await callGemini(prompt);
        console.log(`  응답: "${message.slice(0, 60)}..."`);
        res.json({ success: true, message });
    } catch (err) {
        console.error('  [오류] 동기부여 메시지 실패:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
