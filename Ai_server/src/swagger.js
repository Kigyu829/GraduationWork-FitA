'use strict';

const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'FitAiNess AI Server',
      version: '1.0.0',
      description: `
AI 기반 다이어트 코칭 API — 식단 추천, 운동 추천, Gemini 채팅, 플랜 재스케줄링 제공.

**채팅 스트리밍**: 브라우저에서는 \`POST /api/chat\` 대신 **Socket.io** WebSocket 연결을 사용합니다.
- 이벤트: \`chat_message\` (전송) → \`chat_token\` (스트리밍) → \`chat_done\` (완료)
      `,
      contact: { name: 'FitAiNess', email: 'doctorgyu9@gmail.com' },
    },
    servers: [
      { url: 'http://localhost:5000', description: 'AI 서버 (직접)' },
      { url: 'http://localhost:3000', description: 'project_web 프록시 경유' },
    ],
    tags: [
      { name: '식단', description: '식단 추천 및 재조정' },
      { name: '운동', description: '운동 추천 및 재조정' },
      { name: '채팅', description: 'Gemini AI 상담 채팅' },
      { name: '목표', description: '칼로리 계산 및 동기부여' },
      { name: '플랜', description: '식단+운동 일괄 재스케줄링' },
      { name: '상태', description: '서버 헬스체크' },
    ],
    components: {
      schemas: {
        UserProfile: {
          type: 'object',
          required: ['height', 'weight', 'targetWeight', 'targetWeeks'],
          properties: {
            height:        { type: 'number', example: 170, description: '키 (cm)' },
            weight:        { type: 'number', example: 75,  description: '현재 체중 (kg)' },
            bmi:           { type: 'number', example: 25.9, description: 'BMI (선택)' },
            gender:        { type: 'string', enum: ['남성', '여성'], example: '남성' },
            targetWeight:  { type: 'number', example: 68,  description: '목표 체중 (kg)' },
            targetWeeks:   { type: 'number', example: 8,   description: '달성 목표 주 수' },
            activityLevel: { type: 'string', enum: ['낮음', '보통', '높음', '매우높음', '선수'], example: '보통' },
            targetCalories:{ type: 'number', example: 1800, description: '목표 칼로리 (선택, 미제공 시 자동 계산)' },
          },
        },
        MealPlan: {
          type: 'object',
          properties: {
            breakfast:     { $ref: '#/components/schemas/MealItem' },
            lunch:         { $ref: '#/components/schemas/MealItem' },
            dinner:        { $ref: '#/components/schemas/MealItem' },
            total_calories:{ type: 'number', example: 1750 },
            tip:           { type: 'string', example: '저녁은 가볍게 드세요.' },
          },
        },
        MealItem: {
          type: 'object',
          properties: {
            menu:          { type: 'array', items: { type: 'string' }, example: ['현미밥', '닭가슴살구이'] },
            calories:      { type: 'number', example: 580 },
            protein:       { type: 'number', example: 35 },
            carbs:         { type: 'number', example: 65 },
            fat:           { type: 'number', example: 12 },
            desc:          { type: 'string', example: '현미밥 · 닭가슴살구이' },
          },
        },
        WorkoutPlan: {
          type: 'object',
          properties: {
            warmup:         { type: 'array', items: { $ref: '#/components/schemas/WorkoutItem' } },
            main:           { type: 'array', items: { $ref: '#/components/schemas/WorkoutItem' } },
            cooldown:       { type: 'array', items: { $ref: '#/components/schemas/WorkoutItem' } },
            total_duration: { type: 'number', example: 45, description: '총 시간 (분)' },
            total_calories: { type: 'number', example: 320, description: '소모 칼로리' },
            tip:            { type: 'string', example: '운동 후 스트레칭을 꼭 해주세요.' },
          },
        },
        WorkoutItem: {
          type: 'object',
          properties: {
            name:     { type: 'string', example: '스쿼트' },
            sets:     { type: 'number', example: 3 },
            reps:     { type: 'number', example: 15 },
            duration: { type: 'string', example: '20분' },
            calories: { type: 'number', example: 80 },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string',  example: '필수 파라미터가 없습니다.' },
          },
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
          },
        },
      },
    },
    paths: {
      '/api/meal/recommend': {
        post: {
          tags: ['식단'],
          summary: '식단 추천',
          description: '사용자 신체 정보를 기반으로 아침/점심/저녁 식단을 추천합니다.\n\n`reasons` 배열이 있으면 Gemini NLU로 선호/기피 반영, 없으면 규칙 기반 추천(빠름).',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UserProfile' },
                example: {
                  height: 170, weight: 75, bmi: 25.9, gender: '남성',
                  targetWeight: 68, targetWeeks: 8, activityLevel: '보통',
                  reasons: ['닭가슴살은 빼줘'],
                },
              },
            },
          },
          responses: {
            200: {
              description: '식단 추천 성공',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/SuccessResponse' },
                      { properties: { data: { $ref: '#/components/schemas/MealPlan' }, targetCalories: { type: 'number' } } },
                    ],
                  },
                },
              },
            },
            400: { description: '필수 파라미터 누락', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
            500: { description: '서버 오류', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
      },
      '/api/meal/adjust': {
        post: {
          tags: ['식단'],
          summary: '식단 재조정 (AI 채팅 후)',
          description: '사용자가 채팅에서 음식 기피/알레르기 등을 요청할 때 Gemini로 식단을 재조정합니다.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['currentPlan', 'reasons', 'targetCalories'],
                  properties: {
                    currentPlan:    { $ref: '#/components/schemas/MealPlan' },
                    reasons:        { type: 'array', items: { type: 'string' }, example: ['닭가슴살 알레르기', '저탄수화물 선호'] },
                    targetCalories: { type: 'number', example: 1800 },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: '재조정 성공', content: { 'application/json': { schema: { allOf: [{ $ref: '#/components/schemas/SuccessResponse' }, { properties: { data: { $ref: '#/components/schemas/MealPlan' } } }] } } } },
            400: { description: '필수 파라미터 누락', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
      },
      '/api/exercise/recommend': {
        post: {
          tags: ['운동'],
          summary: '운동 추천',
          description: 'BMI, 목표 기간, 활동 수준을 기반으로 준비운동/메인/마무리 운동 플랜을 생성합니다.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UserProfile' },
                example: { height: 170, weight: 75, bmi: 25.9, gender: '남성', targetWeight: 68, targetWeeks: 8, activityLevel: '보통' },
              },
            },
          },
          responses: {
            200: { description: '운동 추천 성공', content: { 'application/json': { schema: { allOf: [{ $ref: '#/components/schemas/SuccessResponse' }, { properties: { data: { $ref: '#/components/schemas/WorkoutPlan' } } }] } } } },
            400: { description: '필수 파라미터 누락', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
      },
      '/api/exercise/adjust': {
        post: {
          tags: ['운동'],
          summary: '운동 재조정 (AI 채팅 후)',
          description: '부상/선호 운동 변경 요청을 Gemini로 처리해 운동 플랜을 재조정합니다.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['currentPlan', 'reasons'],
                  properties: {
                    currentPlan:   { $ref: '#/components/schemas/WorkoutPlan' },
                    reasons:       { type: 'array', items: { type: 'string' }, example: ['무릎이 아파요', '스쿼트 빼줘'] },
                    targetWeeks:   { type: 'number', example: 8 },
                    bmi:           { type: 'number', example: 25.9 },
                    activityLevel: { type: 'string', example: '보통' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: '재조정 성공', content: { 'application/json': { schema: { allOf: [{ $ref: '#/components/schemas/SuccessResponse' }, { properties: { data: { $ref: '#/components/schemas/WorkoutPlan' } } }] } } } },
            400: { description: '필수 파라미터 누락', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
      },
      '/api/chat': {
        post: {
          tags: ['채팅'],
          summary: 'AI 상담 채팅 (HTTP)',
          description: 'Gemini + RAG 기반 다이어트 상담. 메시지에 식단/운동 조정 키워드 감지 시 `action` 필드 반환.\n\n> ⚠️ 브라우저에서는 스트리밍 지원 Socket.io를 권장합니다.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['message'],
                  properties: {
                    message:       { type: 'string', example: '닭가슴살 알레르기가 있어요, 다른 단백질로 바꿔주세요.' },
                    userInfo:      { type: 'string', example: '남성 25세 170cm 75kg, 목표 68kg 8주' },
                    mealPlan:      { $ref: '#/components/schemas/MealPlan' },
                    workoutPlan:   { $ref: '#/components/schemas/WorkoutPlan' },
                    recentHistory: { type: 'string', example: '사용자: 오늘 점심 못먹었어요\nAI: 괜찮아요, ...' },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'AI 응답 성공',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      reply:   { type: 'string', example: '닭가슴살 대신 두부를 추천드려요!' },
                      action:  { type: 'string', nullable: true, enum: ['meal_adjust', 'exercise_adjust', null], example: 'meal_adjust' },
                      reason:  { type: 'string', nullable: true, example: '닭가슴살 알레르기가 있어요' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/goal/calories': {
        post: {
          tags: ['목표'],
          summary: '일일 목표 칼로리 계산',
          description: 'Mifflin-St Jeor 공식으로 BMR → TDEE → 목표 칼로리를 계산합니다. Gemini 불필요, 빠른 응답.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['gender', 'height', 'weight', 'targetWeight', 'targetWeeks'],
                  properties: {
                    gender:        { type: 'string', enum: ['남성', '여성'], example: '남성' },
                    birth:         { type: 'string', format: 'date', example: '2000-01-15', description: 'YYYY-MM-DD, 미입력 시 25세 기본' },
                    height:        { type: 'number', example: 170 },
                    weight:        { type: 'number', example: 75 },
                    targetWeight:  { type: 'number', example: 68 },
                    targetWeeks:   { type: 'number', example: 8 },
                    activityLevel: { type: 'string', enum: ['낮음', '보통', '높음', '매우높음', '선수'], example: '보통' },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: '칼로리 계산 성공',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'object',
                        properties: {
                          bmr:          { type: 'number', example: 1750 },
                          tdee:         { type: 'number', example: 2406 },
                          dailyCalories:{ type: 'number', example: 1906 },
                          dailyDeficit: { type: 'number', example: 500 },
                          weeklyLoss:   { type: 'number', example: 0.88 },
                        },
                      },
                      warning: { type: 'string', nullable: true, example: '주당 1.2kg 감량은 무리할 수 있습니다.' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/motivation': {
        post: {
          tags: ['목표'],
          summary: '동기부여 메시지 조회',
          description: '미이행 횟수에 따라 응원 메시지를 반환합니다. (0~1회: 긍정, 2~3회: 격려, 4회+: 위로)',
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    missedCount: { type: 'number', example: 2, description: '최근 미이행 횟수 (기본값: 0)' },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: '메시지 반환 성공',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string', example: '잘 하고 계세요! 꾸준히 식단과 운동을 이어가고 있군요.' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/plan/replan': {
        post: {
          tags: ['플랜'],
          summary: '식단 + 운동 일괄 재스케줄링',
          description: '식단과 운동 플랜을 병렬로 동시에 새로 생성합니다. `reason`이 있으면 Gemini NLU 사용, 없으면 규칙 기반 추천(빠름).',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['height', 'weight', 'targetWeight', 'remainingWeeks'],
                  properties: {
                    height:         { type: 'number', example: 170 },
                    weight:         { type: 'number', example: 75 },
                    bmi:            { type: 'number', example: 25.9 },
                    gender:         { type: 'string', enum: ['남성', '여성'], example: '남성' },
                    birth:          { type: 'string', format: 'date', example: '2000-01-15' },
                    activityLevel:  { type: 'string', example: '보통' },
                    targetWeight:   { type: 'number', example: 68 },
                    remainingWeeks: { type: 'number', example: 6, description: '남은 목표 기간 (주)' },
                    missedCount:    { type: 'number', example: 2 },
                    reason:         { type: 'string', example: '해산물 알레르기, 운동 강도 낮춰주세요', description: '비어있으면 규칙 기반 추천' },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: '재스케줄링 성공',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success:  { type: 'boolean', example: true },
                      data: {
                        type: 'object',
                        properties: {
                          mealPlan:    { $ref: '#/components/schemas/MealPlan' },
                          workoutPlan: { $ref: '#/components/schemas/WorkoutPlan' },
                        },
                      },
                    },
                  },
                },
              },
            },
            400: { description: '필수 파라미터 누락', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
      },
      '/api/health': {
        get: {
          tags: ['상태'],
          summary: '서버 상태 확인',
          description: '서버가 정상 작동 중인지, 사용 모델과 활성 엔드포인트 목록을 반환합니다.',
          responses: {
            200: {
              description: '서버 정상',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status:    { type: 'string', example: 'ok' },
                      server:    { type: 'string', example: 'ai_server' },
                      port:      { type: 'number', example: 5000 },
                      chat_model:{ type: 'string', example: 'gemini-2.5-flash' },
                      timestamp: { type: 'string', format: 'date-time' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  apis: [],
};

module.exports = swaggerJsdoc(options);
