# 졸업작품 프로젝트 (v_2026.03.24)
AI 기반 다이어트 코칭 앱. CNN 음식 인식 → 식단 자동 검증 → AI 재스케줄링까지의 폐쇄 루프 시스템.

 프로젝트 구조
Graduation_Work/
├── Server/          # Node.js 백엔드 API 서버
├── Android/         # 안드로이드 클라이언트 (Kotlin)
└── model_CNN/       # PyTorch 음식 분류 CNN 모델

 사전 준비
필수 설치

Node.js (LTS 버전)

https://nodejs.org/en/download 에서 Windows Installer 다운로드
설치 시 "Add to PATH" 체크 확인


Python 3.11

https://www.python.org/downloads/release/python-3119/ 에서 다운로드
Python 3.12 이상은 일부 라이브러리 호환 문제 있음


MySQL

https://dev.mysql.com/downloads/installer/ 에서 다운로드
설치 후 diet_coach 데이터베이스 생성


NVIDIA GPU 드라이버 + CUDA Toolkit

https://developer.nvidia.com/cuda-downloads
nvidia-smi 명령어로 CUDA 버전 확인



설치 확인
아래 명령어로 확인:
node -v          # v24.x.x
npm -v           # 11.x.x
python --version # Python 3.11.x
pip --version    # pip 24.x.x
nvidia-smi       # CUDA 버전 확인


 1단계: CNN 모델 학습 (model_CNN/)
1-1. 라이브러리 설치
cd /model_CNN

# PyTorch 설치 (본인 CUDA 버전에 맞게, nvidia-smi로 확인)
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu126

# 나머지 패키지 설치
pip install -r requirements.txt
1-2. AI Hub 데이터셋 다운로드

AI Hub 회원가입 및 로그인
"한국 음식 이미지" 검색 → 다운로드 신청
활용 목적: "졸업작품 - 음식 이미지 분류 CNN 모델 개발"
승인 후 데이터 다운로드 (150종, 약 15만 장)

1-3. 데이터 배치
다운로드한 zip 파일들 (구이.zip, 국.zip, 김치.zip...) 전부 압축 해제 후
model_CNN/data/raw/ 폴더 안에 넣기
model_CNN/data/raw/
├── 구이/
│   └── 구이/
│       ├── 갈비구이/
│       │   ├── img001.jpg
│       │   └── ...
│       └── 삼겹살/
├── 국/
├── 김치/
├── 면/
└── ... (총 15개 대분류 폴더)

이미지 파일의 바로 상위 폴더명이 클래스명

1-4. 데이터 전처리
python src/preprocess.py
완료 시 출력

클래스 수, Train/Val/Test 이미지 수
data/processed/ 폴더에 자동 생성

train/, val/, test/ (분할된 이미지)
labels.json (클래스 매핑)
labels_detail.json (한글 포함 상세 매핑)


1-5. 모델 학습
python src/train.py

100 에포크 기본 실행
에포크마다 Train/Val 정확도 출력
최고 성능 모델 자동 저장: weights/food_scouter_v1.pth
10 에포크마다 체크포인트 저장: weights/checkpoint_epoch_N.pth


# 추후 모델 재평가 시 실행
출력 수치 설명
항목의미Train Loss학습 데이터 손실값 (낮을수록 좋음)
Train Acc학습 데이터 정확도 Val Loss검증 데이터 손실값 (실제 성능 지표) Val Acc검증 데이터 정확도 (실제 성능 지표) lr현재 학습률 최고 모델 저장 !Val Acc 최고 갱신 시 모델 저장됨
정확도 개선이 필요한 경우
방법 A - config.py 수정 후 재학습:
pythonBATCH_SIZE = 16        # 32 → 16
NUM_EPOCHS = 150       # 100 → 150
LEARNING_RATE = 0.0005 # 0.001 → 0.0005
DROPOUT_RATE = 0.6     # 0.5 → 0.6
PATIENCE = 25          # 15 → 25
IMG_SIZE = 256         # 224 → 256
방법 B - v2 모델 사용:
model_v2.py, train_v2.py를 src/ 폴더에 넣고
python src/train_v2.py
v2 개선점: Residual Connection, CBAM 어텐션, CutMix, Stochastic Depth



1-6. 모델 평가
python src/evaluate.py
results/ 폴더에 생성되는 파일:

confusion_matrix.png - 클래스간 혼동 행렬
class_performance.png - Top/Bottom 클래스 F1 차트
evaluation_results.json - 전체 수치 데이터
misclassification_analysis.txt - 오분류 패턴


 2단계: 서버 설정 (Server/)
2-1. 라이브러리 설치
/Server
npm install

2-2. 환경변수 설정
.env
.env 파일에 아래 항목 입력:
envPORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_NAME=graduation_db
DB_USER=root
DB_PASSWORD=본인MySQL비밀번호
JWT_SECRET=아무랜덤문자열
OPENAI_API_KEY=sk-xxxx
PYTHON_PATH=python

# 모델 가중치
copy model_CNN\weights\food_scouter_v1.pth Server\model\weights\

# 라벨 파일
copy model_CNN\data\processed\labels.json Server\model\data\

# Python 소스 (predict.py가 필요로 하는 파일들)
copy model_CNN\src\predict.py Server\model\
copy model_CNN\src\model.py Server\model\
copy model_CNN\src\config.py Server\model\
copy model_CNN\src\transforms.py Server\model\


2-5. MySQL 데이터베이스 생성
쿼리문 : CREATE DATABASE graduation_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

2-6. 서버 실행
npm run dev
정상 실행 시 출력:
 DB 연결 성공
 테이블 동기화 완료
 서버 실행 중: http://localhost:3000

 3단계: 테스트
3-1. 웹 테스트 페이지
터미널 2개를 열어서:
터미널 1 - API 서버:
/Server
npm run dev
터미널 2 - 테스트 페이지 서버:
/Server
python -m http.server 8080
브라우저에서 접속:
http://localhost:8080/food-scouter-test.html
음식 사진 업로드 → "분석하기" 클릭 → CNN 결과 확인

3-2. API 직접 테스트
헬스체크:
http://localhost:3000/api/health

3-3. 전체 요청 흐름
사진 업로드 (브라우저/앱)
  → POST /api/verify/meal (Server)
  → foodScouter.js가 predict.py 호출
  → CNN 모델이 음식 판별
  → 권장 식단 Label과 비교
  → 일치/불일치 결과 반환
  → 불일치 시 재스케줄링 유도


 CNN 모델 아키텍처
v1 - FoodScouterCNN
Input (3×224×224)
  → ConvBlock1 (32ch) + SE Block + MaxPool  → 112×112
  → ConvBlock2 (64ch) + SE Block + MaxPool  → 56×56
  → ConvBlock3 (128ch) + SE Block + MaxPool → 28×28
  → ConvBlock4 (256ch) + SE Block + MaxPool → 14×14
  → ConvBlock5 (512ch) + SE Block + MaxPool → 7×7
  → Global Average Pooling → 512
  → Dropout → FC(512→256) → ReLU
  → Dropout → FC(256→150)
v2 - FoodScouterCNNv2 (성능 개선)
Input (3×256×256)
  → Stem (7×7 Conv, stride=2) → 64ch
  → Stage1: 2×ResBlock(64ch) + CBAM
  → Stage2: 2×ResBlock(128ch) + CBAM
  → Stage3: 3×ResBlock(256ch) + CBAM
  → Stage4: 3×ResBlock(512ch) + CBAM
  → Global Average Pooling → 512
  → FC(512→256→150)


적용 기술

SE Block / CBAM (채널+공간 어텐션)
Label Smoothing (과적합 방지)
Mixup / CutMix (데이터 증강)
Cosine Annealing LR (학습률 스케줄링)
WeightedRandomSampler (클래스 불균형 해소)
Stochastic Depth (v2, 정규화)
Residual Connection (v2, 학습 안정화)


참고

AI Hub 한국 음식 이미지: https://aihub.or.kr/aihubdata/data/view.do?dataSetSn=79
PyTorch 설치: https://pytorch.org/get-started/locally/
Node.js 다운로드: https://nodejs.org/en/download