/**
 * 한국 음식 150종 데이터베이스
 * kcal: 1인분 기준 근사 칼로리
 * gram: 1인분 기준 중량(g) — 국물 포함 기준
 * meals: 해당 끼니 ['breakfast','lunch','dinner']
 * type: 'main'(주식) | 'soup'(국/찌개) | 'side'(반찬) | 'drink'(음료)
 */
const FOODS = [
  // ── 밥류 (main) ──────────────────────────────
  { name: '비빔밥',      kcal: 550, gram: 400, meals: ['lunch','dinner'],              type: 'main' },
  { name: '김치볶음밥',  kcal: 520, gram: 350, meals: ['lunch','dinner'],              type: 'main' },
  { name: '새우볶음밥',  kcal: 480, gram: 350, meals: ['lunch','dinner'],              type: 'main' },
  { name: '알밥',        kcal: 500, gram: 350, meals: ['lunch','dinner'],              type: 'main' },
  { name: '잡곡밥',      kcal: 300, gram: 210, meals: ['breakfast','lunch','dinner'],  type: 'main' },
  { name: '주먹밥',      kcal: 280, gram: 160, meals: ['breakfast','lunch'],           type: 'main' },

  // ── 면류 (main) ──────────────────────────────
  { name: '라면',        kcal: 500, gram: 550, meals: ['lunch','dinner'],              type: 'main' },
  { name: '짜장면',      kcal: 600, gram: 400, meals: ['lunch','dinner'],              type: 'main' },
  { name: '짬뽕',        kcal: 550, gram: 600, meals: ['lunch','dinner'],              type: 'main' },
  { name: '물냉면',      kcal: 450, gram: 450, meals: ['lunch','dinner'],              type: 'main' },
  { name: '비빔냉면',    kcal: 500, gram: 350, meals: ['lunch','dinner'],              type: 'main' },
  { name: '막국수',      kcal: 420, gram: 380, meals: ['lunch','dinner'],              type: 'main' },
  { name: '잔치국수',    kcal: 380, gram: 400, meals: ['breakfast','lunch'],           type: 'main' },
  { name: '열무국수',    kcal: 380, gram: 380, meals: ['lunch','dinner'],              type: 'main' },
  { name: '쫄면',        kcal: 450, gram: 350, meals: ['lunch','dinner'],              type: 'main' },
  { name: '수제비',      kcal: 400, gram: 450, meals: ['lunch','dinner'],              type: 'main' },
  { name: '칼국수',      kcal: 430, gram: 500, meals: ['lunch','dinner'],              type: 'main' },
  { name: '콩국수',      kcal: 380, gram: 500, meals: ['lunch','dinner'],              type: 'main' },
  { name: '라볶이',      kcal: 520, gram: 380, meals: ['lunch','dinner'],              type: 'main' },

  // ── 국/찌개 (soup) ───────────────────────────
  { name: '김치찌개',    kcal: 180, gram: 300, meals: ['breakfast','lunch','dinner'],  type: 'soup' },
  { name: '된장찌개',    kcal: 160, gram: 300, meals: ['breakfast','lunch','dinner'],  type: 'soup' },
  { name: '순두부찌개',  kcal: 180, gram: 350, meals: ['breakfast','lunch','dinner'],  type: 'soup' },
  { name: '동태찌개',    kcal: 150, gram: 350, meals: ['breakfast','lunch','dinner'],  type: 'soup' },
  { name: '육개장',      kcal: 200, gram: 350, meals: ['breakfast','lunch','dinner'],  type: 'soup' },
  { name: '미역국',      kcal:  80, gram: 300, meals: ['breakfast','lunch','dinner'],  type: 'soup' },
  { name: '북엇국',      kcal:  90, gram: 300, meals: ['breakfast','lunch','dinner'],  type: 'soup' },
  { name: '무국',        kcal:  70, gram: 300, meals: ['breakfast','lunch','dinner'],  type: 'soup' },
  { name: '계란국',      kcal:  80, gram: 300, meals: ['breakfast','lunch','dinner'],  type: 'soup' },
  { name: '시래기국',    kcal:  90, gram: 300, meals: ['breakfast','lunch','dinner'],  type: 'soup' },
  { name: '콩나물국',    kcal:  60, gram: 300, meals: ['breakfast','lunch','dinner'],  type: 'soup' },
  { name: '매운탕',      kcal: 180, gram: 400, meals: ['lunch','dinner'],              type: 'soup' },
  { name: '닭계장',      kcal: 200, gram: 350, meals: ['lunch','dinner'],              type: 'soup' },
  { name: '추어탕',      kcal: 200, gram: 350, meals: ['lunch','dinner'],              type: 'soup' },

  // ── 국물 있는 주요리 (main) ──────────────────
  { name: '갈비탕',      kcal: 380, gram: 600, meals: ['lunch','dinner'],              type: 'main' },
  { name: '감자탕',      kcal: 420, gram: 500, meals: ['lunch','dinner'],              type: 'main' },
  { name: '곰탕/설렁탕', kcal: 350, gram: 600, meals: ['lunch','dinner'],             type: 'main' },
  { name: '삼계탕',      kcal: 580, gram: 700, meals: ['lunch','dinner'],              type: 'main' },
  { name: '떡국/만두국', kcal: 400, gram: 500, meals: ['breakfast','lunch','dinner'],  type: 'main' },

  // ── 구이 (main/side) ─────────────────────────
  { name: '삼겹살',      kcal: 600, gram: 200, meals: ['lunch','dinner'],              type: 'main' },
  { name: '갈비구이',    kcal: 550, gram: 200, meals: ['lunch','dinner'],              type: 'main' },
  { name: '갈비찜',      kcal: 500, gram: 250, meals: ['lunch','dinner'],              type: 'main' },
  { name: '불고기',      kcal: 380, gram: 200, meals: ['lunch','dinner'],              type: 'main' },
  { name: '닭갈비',      kcal: 420, gram: 250, meals: ['lunch','dinner'],              type: 'main' },
  { name: '장어구이',    kcal: 350, gram: 150, meals: ['lunch','dinner'],              type: 'main' },
  { name: '곱창구이',    kcal: 380, gram: 200, meals: ['dinner'],                      type: 'main' },
  { name: '고등어구이',  kcal: 250, gram: 150, meals: ['breakfast','lunch','dinner'],  type: 'side' },
  { name: '갈치구이',    kcal: 230, gram: 140, meals: ['breakfast','lunch','dinner'],  type: 'side' },
  { name: '조기구이',    kcal: 180, gram: 120, meals: ['breakfast','lunch','dinner'],  type: 'side' },
  { name: '황태구이',    kcal: 160, gram:  80, meals: ['breakfast','lunch','dinner'],  type: 'side' },
  { name: '조개구이',    kcal: 200, gram: 200, meals: ['lunch','dinner'],              type: 'side' },
  { name: '더덕구이',    kcal: 120, gram: 100, meals: ['lunch','dinner'],              type: 'side' },

  // ── 볶음 (side/main) ─────────────────────────
  { name: '제육볶음',        kcal: 350, gram: 200, meals: ['lunch','dinner'],              type: 'side' },
  { name: '닭볶음탕',        kcal: 400, gram: 300, meals: ['lunch','dinner'],              type: 'main' },
  { name: '찜닭',            kcal: 420, gram: 350, meals: ['lunch','dinner'],              type: 'main' },
  { name: '오징어채볶음',    kcal: 200, gram:  80, meals: ['breakfast','lunch','dinner'],  type: 'side' },
  { name: '어묵볶음',        kcal: 180, gram: 100, meals: ['breakfast','lunch','dinner'],  type: 'side' },
  { name: '멸치볶음',        kcal: 120, gram:  50, meals: ['breakfast','lunch','dinner'],  type: 'side' },
  { name: '건새우볶음',      kcal: 100, gram:  40, meals: ['breakfast','lunch','dinner'],  type: 'side' },
  { name: '고추장진미채볶음',kcal: 150, gram:  70, meals: ['breakfast','lunch','dinner'],  type: 'side' },
  { name: '감자채볶음',      kcal: 130, gram:  80, meals: ['breakfast','lunch','dinner'],  type: 'side' },
  { name: '미역줄기볶음',    kcal:  80, gram:  80, meals: ['breakfast','lunch','dinner'],  type: 'side' },
  { name: '애호박볶음',      kcal:  90, gram: 100, meals: ['breakfast','lunch','dinner'],  type: 'side' },
  { name: '소세지볶음',      kcal: 200, gram: 100, meals: ['breakfast','lunch','dinner'],  type: 'side' },
  { name: '주꾸미볶음',      kcal: 220, gram: 150, meals: ['lunch','dinner'],              type: 'side' },
  { name: '가지볶음',        kcal:  90, gram: 100, meals: ['breakfast','lunch','dinner'],  type: 'side' },
  { name: '두부김치',        kcal: 250, gram: 200, meals: ['lunch','dinner'],              type: 'side' },

  // ── 조림 (side) ──────────────────────────────
  { name: '고등어조림',  kcal: 220, gram: 150, meals: ['breakfast','lunch','dinner'],  type: 'side' },
  { name: '갈치조림',    kcal: 210, gram: 140, meals: ['breakfast','lunch','dinner'],  type: 'side' },
  { name: '꽁치조림',    kcal: 200, gram: 150, meals: ['breakfast','lunch','dinner'],  type: 'side' },
  { name: '코다리조림',  kcal: 190, gram: 150, meals: ['breakfast','lunch','dinner'],  type: 'side' },
  { name: '두부조림',    kcal: 180, gram: 150, meals: ['breakfast','lunch','dinner'],  type: 'side' },
  { name: '감자조림',    kcal: 150, gram: 100, meals: ['breakfast','lunch','dinner'],  type: 'side' },
  { name: '장조림',      kcal: 160, gram:  80, meals: ['breakfast','lunch','dinner'],  type: 'side' },
  { name: '메추리알장조림', kcal: 150, gram: 80, meals: ['breakfast','lunch','dinner'], type: 'side' },
  { name: '연근조림',    kcal: 130, gram:  80, meals: ['breakfast','lunch','dinner'],  type: 'side' },
  { name: '우엉조림',    kcal: 120, gram:  70, meals: ['breakfast','lunch','dinner'],  type: 'side' },
  { name: '땅콩조림',    kcal: 180, gram:  50, meals: ['breakfast','lunch','dinner'],  type: 'side' },
  { name: '콩자반',      kcal: 130, gram:  50, meals: ['breakfast','lunch','dinner'],  type: 'side' },

  // ── 나물/무침 (side) ─────────────────────────
  { name: '시금치나물',  kcal:  70, gram:  80, meals: ['breakfast','lunch','dinner'],  type: 'side' },
  { name: '고사리나물',  kcal:  80, gram:  80, meals: ['breakfast','lunch','dinner'],  type: 'side' },
  { name: '숙주나물',    kcal:  50, gram:  80, meals: ['breakfast','lunch','dinner'],  type: 'side' },
  { name: '콩나물무침',  kcal:  60, gram:  80, meals: ['breakfast','lunch','dinner'],  type: 'side' },
  { name: '도라지무침',  kcal:  80, gram:  80, meals: ['breakfast','lunch','dinner'],  type: 'side' },
  { name: '꽈리고추무침',kcal:  60, gram:  70, meals: ['breakfast','lunch','dinner'],  type: 'side' },
  { name: '무생채',      kcal:  50, gram:  80, meals: ['breakfast','lunch','dinner'],  type: 'side' },

  // ── 김치류 (side) ────────────────────────────
  { name: '배추김치',    kcal:  40, gram:  70, meals: ['breakfast','lunch','dinner'],  type: 'side' },
  { name: '깍두기',      kcal:  35, gram:  70, meals: ['breakfast','lunch','dinner'],  type: 'side' },
  { name: '백김치',      kcal:  30, gram:  70, meals: ['breakfast','lunch','dinner'],  type: 'side' },
  { name: '갓김치',      kcal:  40, gram:  70, meals: ['breakfast','lunch','dinner'],  type: 'side' },
  { name: '부추김치',    kcal:  45, gram:  70, meals: ['breakfast','lunch','dinner'],  type: 'side' },
  { name: '열무김치',    kcal:  30, gram:  70, meals: ['breakfast','lunch','dinner'],  type: 'side' },
  { name: '오이소박이',  kcal:  30, gram:  60, meals: ['breakfast','lunch','dinner'],  type: 'side' },
  { name: '총각김치',    kcal:  40, gram:  70, meals: ['breakfast','lunch','dinner'],  type: 'side' },
  { name: '파김치',      kcal:  45, gram:  60, meals: ['breakfast','lunch','dinner'],  type: 'side' },
  { name: '나박김치',    kcal:  25, gram: 100, meals: ['breakfast','lunch','dinner'],  type: 'side' },
  { name: '깻잎장아찌',  kcal:  55, gram:  50, meals: ['breakfast','lunch','dinner'],  type: 'side' },

  // ── 전/튀김 (side/main) ──────────────────────
  { name: '파전',        kcal: 280, gram: 200, meals: ['breakfast','lunch','dinner'],  type: 'side' },
  { name: '김치전',      kcal: 250, gram: 180, meals: ['breakfast','lunch','dinner'],  type: 'side' },
  { name: '감자전',      kcal: 200, gram: 150, meals: ['breakfast','lunch','dinner'],  type: 'side' },
  { name: '호박전',      kcal: 180, gram: 150, meals: ['breakfast','lunch','dinner'],  type: 'side' },
  { name: '생선전',      kcal: 200, gram: 150, meals: ['breakfast','lunch','dinner'],  type: 'side' },
  { name: '동그랑땡',    kcal: 180, gram: 100, meals: ['breakfast','lunch','dinner'],  type: 'side' },
  { name: '계란말이',    kcal: 150, gram: 100, meals: ['breakfast','lunch','dinner'],  type: 'side' },
  { name: '계란후라이',  kcal:  90, gram:  60, meals: ['breakfast','lunch','dinner'],  type: 'side' },
  { name: '계란찜',      kcal: 100, gram: 120, meals: ['breakfast','lunch','dinner'],  type: 'side' },
  { name: '고추튀김',    kcal: 150, gram: 100, meals: ['lunch','dinner'],              type: 'side' },
  { name: '새우튀김',    kcal: 280, gram: 130, meals: ['lunch','dinner'],              type: 'side' },
  { name: '오징어튀김',  kcal: 300, gram: 150, meals: ['lunch','dinner'],              type: 'side' },
  { name: '후라이드치킨',kcal: 550, gram: 300, meals: ['lunch','dinner'],              type: 'main' },
  { name: '양념치킨',    kcal: 580, gram: 320, meals: ['lunch','dinner'],              type: 'main' },

  // ── 죽/간편 (breakfast) ──────────────────────
  { name: '전복죽',      kcal: 280, gram: 350, meals: ['breakfast','lunch'],           type: 'main' },
  { name: '호박죽',      kcal: 230, gram: 350, meals: ['breakfast','lunch'],           type: 'main' },
  { name: '누룽지',      kcal: 200, gram: 200, meals: ['breakfast'],                   type: 'main' },

  // ── 분식/간편 (main) ─────────────────────────
  { name: '김밥',        kcal: 380, gram: 320, meals: ['breakfast','lunch','dinner'],  type: 'main' },
  { name: '만두',        kcal: 350, gram: 280, meals: ['breakfast','lunch','dinner'],  type: 'main' },
  { name: '떡볶이',      kcal: 380, gram: 300, meals: ['lunch','dinner'],              type: 'main' },
  { name: '유부초밥',    kcal: 320, gram: 250, meals: ['breakfast','lunch'],           type: 'main' },
  { name: '떡갈비',      kcal: 350, gram: 150, meals: ['lunch','dinner'],              type: 'side' },
  { name: '떡꼬치',      kcal: 200, gram: 100, meals: ['lunch','dinner'],              type: 'side' },
  { name: '순대',        kcal: 300, gram: 200, meals: ['lunch','dinner'],              type: 'side' },

  // ── 보쌈/족발/수육 (main) ────────────────────
  { name: '보쌈',        kcal: 380, gram: 250, meals: ['lunch','dinner'],              type: 'main' },
  { name: '족발',        kcal: 420, gram: 300, meals: ['lunch','dinner'],              type: 'main' },
  { name: '수육',        kcal: 350, gram: 200, meals: ['lunch','dinner'],              type: 'main' },
  { name: '편육',        kcal: 320, gram: 200, meals: ['lunch','dinner'],              type: 'main' },
  { name: '김치찜',      kcal: 300, gram: 300, meals: ['lunch','dinner'],              type: 'main' },

  // ── 해물/기타 (main/side) ────────────────────
  { name: '해물찜',      kcal: 280, gram: 400, meals: ['lunch','dinner'],              type: 'main' },
  { name: '꼬막찜',      kcal: 150, gram: 200, meals: ['lunch','dinner'],              type: 'side' },
  { name: '곱창전골',    kcal: 400, gram: 400, meals: ['dinner'],                      type: 'main' },
  { name: '잡채',        kcal: 280, gram: 200, meals: ['lunch','dinner'],              type: 'side' },
  { name: '산낙지',      kcal: 100, gram: 150, meals: ['lunch','dinner'],              type: 'side' },
  { name: '멍게',        kcal:  60, gram: 100, meals: ['lunch','dinner'],              type: 'side' },
  { name: '물회',        kcal: 250, gram: 350, meals: ['lunch','dinner'],              type: 'main' },
  { name: '과메기',      kcal: 350, gram: 100, meals: ['lunch','dinner'],              type: 'side' },
  { name: '간장게장',    kcal: 180, gram: 150, meals: ['lunch','dinner'],              type: 'side' },
  { name: '양념게장',    kcal: 200, gram: 150, meals: ['lunch','dinner'],              type: 'side' },
  { name: '젓갈',        kcal:  80, gram:  30, meals: ['breakfast','lunch','dinner'],  type: 'side' },
  { name: '도토리묵',    kcal: 100, gram: 200, meals: ['breakfast','lunch','dinner'],  type: 'side' },
  { name: '육회',        kcal: 180, gram: 150, meals: ['dinner'],                      type: 'side' },
  { name: '회무침',      kcal: 200, gram: 200, meals: ['dinner'],                      type: 'side' },
  { name: '홍어무침',    kcal: 150, gram: 150, meals: ['dinner'],                      type: 'side' },
  { name: '훈제오리',    kcal: 350, gram: 200, meals: ['lunch','dinner'],              type: 'main' },
  { name: '피자',        kcal: 600, gram: 200, meals: ['lunch','dinner'],              type: 'main' },

  // ── 음료/디저트 (drink) ──────────────────────
  { name: '수정과',      kcal: 120, gram: 200, meals: ['breakfast','lunch','dinner'],  type: 'drink' },
  { name: '식혜',        kcal: 110, gram: 200, meals: ['breakfast','lunch','dinner'],  type: 'drink' },
  { name: '경단',        kcal: 180, gram: 100, meals: ['breakfast'],                   type: 'side'  },
  { name: '송편',        kcal: 160, gram: 120, meals: ['breakfast'],                   type: 'side'  },
  { name: '꿀떡',        kcal: 150, gram: 100, meals: ['breakfast'],                   type: 'side'  },
  { name: '약과',        kcal: 200, gram: 100, meals: ['breakfast'],                   type: 'side'  },
  { name: '약식',        kcal: 250, gram: 150, meals: ['breakfast'],                   type: 'main'  },
  { name: '한과',        kcal: 180, gram: 100, meals: ['breakfast'],                   type: 'side'  },
];

module.exports = { FOODS };
