# FitAiNess — AI 기반 다이어트 코칭 앱

> 2026 캡스톤 디자인 졸업작품  
> CNN 음식 인식 → 식단 자동 검증 → Gemini AI 재스케줄링의 **폐쇄 루프 다이어트 코칭 시스템**

---

## 시스템 구조

```
사용자
  │
  ├─► FitAIness (Android, Java WebView)
  │       └─► http://[서버IP]:3000/fita/
  │
  └─► 브라우저 → http://localhost:3000
                  │
         project_web (포트 3000)
         정적 파일 서빙 + 리버스 프록시
                  │
                  ├─► /api/*     → Ai_server  (포트 5000) — Gemini 2.5-flash
                  ├─► /cnn/*     → Server     (포트 4000) — CNN 음식 인식
                  ├─► /socket.io → Ai_server  (포트 5000) — Socket.io WebSocket
                  └─► /fita/     → FitA/webapp/            — 모바일 PWA

model_CNN/  ← PyTorch 모델 학습 · 평가 (오프라인, 서비스와 무관)
```

---

## 컴포넌트

| 폴더 | 역할 | 포트 | 기술 |
|------|------|------|------|
| `project_web/` | 웹 서버 + 리버스 프록시 게이트웨이 | 3000 | Node.js, Express 5 |
| `FitA/webapp/` | 모바일 웹앱 UI (PWA) | — | HTML/CSS/JS, Firebase SDK |
| `Ai_server/` | AI 추천 · 채팅 · 재스케줄링 서버 | 5000 | Node.js, Gemini 2.5-flash, Socket.io |
| `Server/` | CNN 음식 인식 서버 | 4000 | Node.js, Python spawn, PyTorch |
| `model_CNN/` | CNN 모델 학습 · 평가 스크립트 | — | PyTorch, CUDA, Albumentations |
| `FitAIness/` | Android 앱 (WebView 래퍼) | — | Java 2파일, WebView |

---

## 사전 요구사항

| 항목 | 권장 버전 | 비고 |
|------|-----------|------|
| Node.js | v24.x (개발: v24.14.0) | v18 LTS 이상이면 동작 |
| npm | v11.x | Node.js와 함께 설치 |
| Python | 3.11.x | 3.12+는 일부 라이브러리 호환 문제 |
| CUDA | 12.6 권장 | CPU 동작 가능하나 속도 느림 |
| Android Studio | Hedgehog 이상 | 앱 빌드 시만 필요 |

**주요 라이브러리:**

| 라이브러리 | 버전 |
|------------|------|
| Express (project_web, Server) | 5.x |
| Express (Ai_server) | 4.x |
| Socket.io | 4.8.x |
| @google/generative-ai | 0.21.x |
| swagger-ui-express | 5.x |
| http-proxy-middleware | 3.0.x |
| torch / torchvision | 2.1+ / 0.16+ |

---

## 환경변수 설정

### `Ai_server/.env`

```env
# Gemini API 키 (쉼표로 여러 개 입력 → 429 초과 시 자동으로 다음 키 사용)
GEMINI_API_KEY=키1,키2,키3

# AI 채팅 모델
GEMINI_CHAT_MODEL=gemini-2.5-flash

# CNN 서버 주소
CNN_SERVER_URL=http://localhost:4000

# AI 서버 포트
PORT=5000
```

> [Google AI Studio](https://aistudio.google.com)에서 API 키 무료 발급 가능

---

## 실행 방법

### 한 번에 실행 (Windows)

```bat
start_all.bat
```

4개 창이 자동으로 열립니다: AI 서버(5000) · CNN 서버(4000) · 웹 서버(3000) · Cloudflare Tunnel

### 수동 실행

**1. CNN 서버 (`Server/`)**

```bash
cd Server
npm install

# Python 의존성 (최초 1회)
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu126
pip install -r ../model_CNN/requirements.txt

node server.js   # → http://localhost:4000
```

**2. AI 서버 (`Ai_server/`)**

```bash
cd Ai_server
npm install
# Ai_server/.env 에 GEMINI_API_KEY 입력 후

node server.js   # → http://localhost:5000
                 # → http://localhost:5000/api-docs  (Swagger UI)
```

**3. 웹 서버 (`project_web/`)**

```bash
cd project_web
npm install
node server.js   # → http://localhost:3000
```

브라우저에서 `http://localhost:3000` 접속

---

## API 문서 (Swagger UI)

AI 서버 실행 후 브라우저에서 접속:

```
http://localhost:5000/api-docs
```

전체 API 엔드포인트의 **요청/응답 스펙 확인** 및 **브라우저에서 직접 테스트** 가능.

---

## API 엔드포인트 요약

### AI 서버 (포트 5000)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/meal/recommend` | 식단 추천 (규칙 기반 + 선택적 Gemini) |
| POST | `/api/meal/adjust` | 식단 재조정 (Gemini NLU) |
| POST | `/api/exercise/recommend` | 운동 추천 |
| POST | `/api/exercise/adjust` | 운동 재조정 (Gemini NLU) |
| POST | `/api/chat` | AI 상담 채팅 (HTTP, Android WebView용) |
| POST | `/api/goal/calories` | 일일 목표 칼로리 계산 (Mifflin-St Jeor) |
| POST | `/api/motivation` | 동기부여 메시지 |
| POST | `/api/plan/replan` | 식단 + 운동 일괄 재스케줄링 |
| WS | `chat_message` | AI 채팅 스트리밍 (Socket.io, 브라우저용) |
| GET | `/api/health` | 서버 상태 확인 |
| GET | `/api-docs` | **Swagger UI** |

### CNN 서버 (포트 4000)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/analyze` | 이미지 업로드 → 음식 분류 (field: `image`) |
| GET | `/api/health` | 서버 상태 확인 |
| GET | `/api/model/info` | 모델 정보 조회 |

---

## 앱 화면 구성

```
로그인 / 회원가입 (Firebase Auth)
    │
    └─► 온보딩: 신체정보 → 목표 설정 → AI 플랜 생성 로딩
              │
              대시보드 (sc301)
                  ├─ 오늘의 식단 / 운동 (sc311)
                  │       ├─ CNN 식단 인증 (hc402 → hc403)
                  │       ├─ AI 채팅 재조정 (Socket.io 스트리밍)
                  │       └─ 운동 루틴 저장 / 불러오기
                  ├─ 기록 히스토리 (sc602) — Firestore 크로스디바이스 복원
                  └─ 프로필 / 설정 (sc701) — 체중 그래프 · 아바타
```

**데이터 흐름:**

```
Firebase Auth (로그인)
    → Firestore users/{uid}          (신체정보, AI 플랜, 조정 사유)
    → localStorage                   (캐시, 즉시 읽기용)
    ↔ Firestore daily/{YYYY-MM-DD}  (식단 인증, 운동 기록, 체중)
```

---

## 외부 접속 (실기기 / 데모)

```bat
cloudflared.exe tunnel --url http://localhost:3000
```

터미널에 표시되는 `https://xxxx.trycloudflare.com` URL을  
`FitAIness/app/src/main/java/.../AppConfig.java` 의 `BASE_URL`에 입력 후 재빌드.

---

## Android 앱 (`FitAIness/`)

WebView 래퍼 앱 — Java 파일 2개(`AppConfig.java`, `MainActivity.java`)만 존재.

1. Firebase Console에서 `google-services.json` 다운로드 → `FitAIness/app/` 에 배치
2. Android Studio에서 `FitAIness/` 폴더 열기
3. `AppConfig.java` 에서 서버 URL 설정

```java
// 에뮬레이터
static final String BASE_URL = "http://10.0.2.2:3000";

// 실기기 (같은 Wi-Fi)
static final String BASE_URL = "http://192.168.0.xxx:3000";

// 외부 데모 (Cloudflare Tunnel)
static final String BASE_URL = "https://xxxx.trycloudflare.com";
```

---

## 다른 PC로 이전 시 필수 파일

git clone으로 소스코드는 복원되지만, `.gitignore`에 의해 제외된 파일은 직접 옮겨야 합니다.

| 파일 | 경로 | 비고 |
|------|------|------|
| `.env` | `Ai_server/.env` | Gemini API 키 필수 |
| `food_scouter_v2.pth` | `model_CNN/weights/` | CNN 음식 인식 모델 |
| `food_detector_v1.pth` | `Server/weights/` | 음식 감지 모델 |
| `sam_vit_b.pth` | `Server/weights/` | SAM 세그멘테이션 (~375MB) |
| `cloudflared.exe` | 루트 | Cloudflare 터널 실행파일 |
| `google-services.json` | `FitAIness/app/` | Firebase 콘솔에서 재다운로드 가능 |

> `local.properties`는 Android Studio가 자동 생성하므로 불필요  
> `checkpoint_epoch*.pth`는 학습 재개 안 할 경우 불필요

---

## CNN 모델 학습 (선택)

### 데이터셋 준비

1. [AI Hub 한국 음식 이미지](https://aihub.or.kr/aihubdata/data/view.do?dataSetSn=79) 다운로드 신청
2. 승인 후 압축 해제 → `model_CNN/data/raw/` 에 배치

```
model_CNN/data/raw/
├── 구이/
│   └── 갈비구이/
├── 국/
└── ...  (총 150종)
```

### 학습 실행

```bash
cd model_CNN
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu126
pip install -r requirements.txt

python src/preprocess.py        # 데이터 전처리
python src/train.py             # v1 학습 (SE Block)
# v2 코드는 model_CNN/src/v2_backup/ 에 보관 (현재 학습 파이프라인 미포함)
python src/evaluate.py          # 평가 및 혼동 행렬 출력
```

완료 후 `model_CNN/weights/food_scouter_v*.pth` 저장  
→ `Server/weights/` 에 복사하면 CNN 서버에서 사용 가능

### 모델 아키텍처

**v1 — FoodScouterCNN (SE Block)**
```
Input (3×256×256)
→ ConvBlock×5 + SE Block + MaxPool  →  8×8×512
→ Global Average Pooling
→ FC(512→256) → Dropout → FC(256→150)
```

**v2 — FoodScouterCNNv2 (ResBlock + CBAM)**
```
Input (3×256×256)
→ Stem (7×7 Conv, stride=2)
→ Stage 1~4: ResBlock + CBAM 어텐션
→ Global Average Pooling
→ FC(512→256→150)
```

적용 기법(v1): Label Smoothing(ε=0.1), Mixup(α=0.2), Cutout, Cosine Annealing LR, WeightedRandomSampler(*)
(*) 데이터셋이 클래스당 약 1,000장으로 이미 균형(표준편차 1.75)이라 실질적 효과는 제한적
CutMix / Stochastic Depth는 v2_backup에만 존재, 현재 배포 파이프라인 미적용

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| CNN 모델 | PyTorch (SE Block, CBAM), Albumentations |
| 음식 영역 분할 | SAM (Segment Anything, ViT-B) |
| 운동 자세 분석 | MediaPipe Pose |
| 음식 분류 | 한국 음식 150종, AI Hub 데이터 약 15만 장 |
| AI 추천 | Google Gemini 2.5-flash |
| 백엔드 | Node.js, Express, Python spawn, Socket.io |
| API 문서 | Swagger UI (OpenAPI 3.0) |
| 데이터베이스 | Firebase Firestore + Firebase Storage |
| Android | Java, WebView (하이브리드 앱) |
| 웹 클라이언트 | 순수 HTML/CSS/JS, Firebase SDK (CDN) |
| 외부 접속 | Cloudflare Tunnel |

---

## 참고 자료

- [AI Hub 한국 음식 이미지 데이터셋](https://aihub.or.kr/aihubdata/data/view.do?dataSetSn=79)
- [Google AI Studio (Gemini API)](https://aistudio.google.com)
- [Firebase 콘솔](https://console.firebase.google.com)
- [Swagger UI](https://swagger.io/tools/swagger-ui/)
- [PyTorch 설치 가이드](https://pytorch.org/get-started/locally/)
