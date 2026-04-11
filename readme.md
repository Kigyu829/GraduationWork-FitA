# FitAiNess — AI 기반 다이어트 코칭 앱

> 2026 캡스톤 디자인 졸업작품  
> CNN 음식 인식 → 식단 자동 검증 → Gemini AI 재스케줄링의 폐쇄 루프 다이어트 코칭 시스템

---
---

## 시스템 구조

```
사용자 (Android 앱)
    │
    ├─► FitAiNess (Android, Java)
    │       │
    │       ├─► Ai_server (port 5000)   ← Gemini 2.5-flash 식단/운동 추천
    │       └─► Server (port 4000)      ← CNN 음식 인식 (PyTorch → Python spawn)
    │
    └─► project_web (port 3000)         ← 웹 프로토타입 (HTML/CSS/JS)

model_CNN/   ← PyTorch 모델 학습 및 평가 (오프라인)
```

---

## 컴포넌트 소개

| 폴더 | 역할 | 포트 | 기술 |
|------|------|------|------|
| `Server/` | CNN 추론 서버 | 4000 | Node.js (Express 5), Python spawn |
| `Ai_server/` | Gemini AI 추천 서버 | 5000 | Node.js (Express 4), Gemini 2.5-flash |
| `model_CNN/` | CNN 모델 학습/평가 | — | PyTorch, CUDA, Albumentations |
| `project_web/` | 웹 프로토타입 | 3000 | Express 5, 순수 HTML/CSS/JS |
| `FitAiNess/` | Android 앱 | — | Java, Firebase, Navigation Component |

---

## 사전 요구사항

### 공통
- **Node.js** LTS (`node -v`로 확인)
- **Python 3.11** (3.12+ 일부 라이브러리 호환 문제)
- **NVIDIA GPU + CUDA** (CNN 추론/학습용, CPU도 동작하지만 느림)

### Android 앱
- **Android Studio** Hedgehog 이상
- **Firebase** 프로젝트 생성 및 `google-services.json` 배치 (아래 참고)

---

## 환경변수 설정

### `Ai_server/.env`
```env
GEMINI_API_KEY=your_google_ai_studio_api_key
PORT=5000
```
> Google AI Studio(https://aistudio.google.com)에서 API 키 발급  
> 무료 한도: gemini-2.5-flash 기준 20 RPD (개발 중 소진 시 새 계정으로 재발급)

### `Server/.env`
```env
PORT=4000
DB_HOST=localhost
DB_PORT=3306
DB_NAME=graduation_db
DB_USER=root
DB_PASSWORD=본인_MySQL_비밀번호
JWT_SECRET=랜덤문자열_아무거나
PYTHON_PATH=python
```

---

## 실행 방법

### 1. CNN 서버 (`Server/`)

```bash
cd Server
npm install

# Python 의존성 설치 (최초 1회)
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu126
pip install -r ../model_CNN/requirements.txt

# 모델 가중치 배치 (별도 다운로드 필요 — 아래 참고)
# Server/model/weights/food_scouter_v1.pth

npm run dev   # nodemon, port 4000
```

### 2. AI 서버 (`Ai_server/`)

```bash
cd Ai_server
npm install
# .env 파일에 GEMINI_API_KEY 입력 후
npm run dev   # nodemon, port 5000
```

### 3. 웹 프로토타입 (`project_web/`)

```bash
cd project_web
npm install
npm run dev   # port 3000
# 테스트 계정: test1@test.com / test1TEST
```

### 4. Android 앱 (`FitAiNess/`)

1. `FitAiNess/app/src/main/` 에 `google-services.json` 배치 (Firebase Console에서 다운로드)
2. Android Studio에서 `FitAiNess/` 폴더 오픈
3. 에뮬레이터 사용 시 서버 IP는 `10.0.2.2` (기본값 적용됨)
4. 실기기 사용 시 아래 두 파일의 IP를 PC 실제 IP로 변경

```java
// GeminiHelper.java
private static final String AI_SERVER = "http://192.168.0.xxx:5000";

// DinerFragment.java
private static final String CNN_SERVER = "http://192.168.0.xxx:4000";
```

---

## 모델 가중치 다운로드

CNN 모델 가중치 파일(`food_scouter_v1.pth`)은 용량 문제로 git에 포함되지 않습니다.

**배치 위치:**
```
Server/model/weights/food_scouter_v1.pth
```

> 직접 학습하려면 아래 **CNN 모델 학습** 섹션을 참고하세요.

---

## CNN 모델 학습 (선택)

### 데이터셋 준비

1. [AI Hub 한국 음식 이미지](https://aihub.or.kr/aihubdata/data/view.do?dataSetSn=79) 다운로드 신청
2. 승인 후 zip 파일 압축 해제 → `model_CNN/data/raw/` 에 배치

```
model_CNN/data/raw/
├── 구이/
│   └── 갈비구이/   ← 이미지 파일들
├── 국/
├── 김치/
└── ...  (총 150종)
```

### 학습 실행

```bash
cd model_CNN

# PyTorch 설치 (본인 CUDA 버전에 맞게 — nvidia-smi로 확인)
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu126
pip install -r requirements.txt

# 데이터 전처리
python src/preprocess.py

# 모델 학습
python src/train.py       # v1 (SE Block)
# python src/train_v2.py  # v2 (ResBlock + CBAM, 성능 개선)

# 모델 평가
python src/evaluate.py
```

학습 완료 시 `model_CNN/weights/food_scouter_v1.pth` 저장  
→ `Server/model/weights/`에 복사하면 CNN 서버에서 사용 가능

### 모델 아키텍처

**v1 — FoodScouterCNN (SE Block)**
```
Input (3×224×224)
→ ConvBlock×5 + SE Block + MaxPool  →  7×7×512
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

적용 기법: Label Smoothing, Mixup/CutMix, Cosine Annealing LR, WeightedRandomSampler, Stochastic Depth

---

## 주요 API 엔드포인트

### CNN 서버 (port 4000)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/analyze` | 이미지 업로드 → 음식 분류 (field: `image`) |
| GET | `/api/health` | 서버 상태 확인 |
| GET | `/api/model/info` | 모델 정보 |

### AI 서버 (port 5000)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/meal/recommend` | 식단 추천 |
| POST | `/api/meal/adjust` | 식단 재조정 |
| POST | `/api/exercise/recommend` | 운동 추천 |
| POST | `/api/exercise/adjust` | 운동 재조정 |
| POST | `/api/chat` | AI 채팅 상담 |
| POST | `/api/goal/calories` | 일일 목표 칼로리 계산 |
| POST | `/api/plan/reschedule` | 식단+운동 일괄 재스케줄링 |

---

## Android 앱 화면 구성

```
스플래시 → 로그인/회원가입 → 신체정보 입력 (온보딩)
    │
    └─ 홈 (오늘의 식단 카드, AI 기능 카드)
         ├─ 식단 추천 (MealFragment)
         ├─ 운동 추천 (WorkoutFragment)
         ├─ AI 상담 (ChatFragment)
         └─ 식단 기록 (DinerFragment) ← CNN 음식 인식
```

**데이터 흐름:**
```
Firebase (성별/키/몸무게)
    + GoalPrefs (목표 체중/기간)
        → AI 서버에 맞춤 요청
        → meal_sp / workout_sp (SharedPreferences) 저장
        → 홈 화면 자동 표시
```

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| CNN 모델 | PyTorch (SE Block, CBAM), Albumentations |
| 음식 분류 | 한국 음식 150종, AI Hub 데이터 약 15만 장 |
| AI 추천 | Google Gemini 2.5-flash |
| 백엔드 | Node.js, Express, Python spawn |
| 데이터베이스 | Firebase Firestore (앱), MySQL (웹) |
| Android | Java, Navigation Component, Firebase Auth |
| 웹 프로토타입 | 순수 HTML/CSS/JS + Express |

---

## 참고 자료

- [AI Hub 한국 음식 이미지 데이터셋](https://aihub.or.kr/aihubdata/data/view.do?dataSetSn=79)
- [PyTorch 설치 가이드](https://pytorch.org/get-started/locally/)
- [Google AI Studio (Gemini API)](https://aistudio.google.com)
- [Firebase 콘솔](https://console.firebase.google.com)
epth (v2, 정규화)
Residual Connection (v2, 학습 안정화)


참고

AI Hub 한국 음식 이미지: https://aihub.or.kr/aihubdata/data/view.do?dataSetSn=79
PyTorch 설치: https://pytorch.org/get-started/locally/
Node.js 다운로드: https://nodejs.org/en/download
