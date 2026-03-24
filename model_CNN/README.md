#  Food Scouter CNN

AI Hub 한국 음식 이미지 데이터셋으로 학습하는 음식 분류 CNN 모델입니다.

##  프로젝트 구조

```
food-scouter-cnn/
├── data/
│   ├── raw/              ← AI Hub 원본 데이터 (여기에 넣기)
│   └── processed/        ← 전처리 후 자동 생성
│       ├── train/
│       ├── val/
│       ├── test/
│       └── labels.json
├── src/
│   ├── config.py         ← 모든 설정값 (하이퍼파라미터)
│   ├── preprocess.py     ← AI Hub 데이터 전처리
│   ├── transforms.py     ← 데이터 증강 파이프라인
│   ├── dataset.py        ← PyTorch Dataset/DataLoader
│   ├── model.py          ← CNN 아키텍처 (SE Block 포함)
│   ├── train.py          ← 학습 스크립트
│   ├── evaluate.py       ← 성능 평가 + 시각화
│   └── predict.py        ← 단일 이미지 추론 (서버 연동)
├── weights/              ← 학습된 모델 저장
├── results/              ← 평가 결과, 그래프
├── notebooks/            ← Jupyter 실험용
└── requirements.txt
```

## 시작하기

### 1. 환경 설정

```bash
# CUDA 버전 확인
nvidia-smi

# PyTorch 설치 (본인 CUDA 버전에 맞게)
# https://pytorch.org/get-started/locally/
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121

# 나머지 패키지 설치
pip install -r requirements.txt
```

### 2. 데이터 준비

1. [AI Hub](https://aihub.or.kr) 접속 → '한국 음식 이미지' 검색 → 다운로드
2. 압축 풀고 `data/raw/` 폴더에 넣기
3. 전처리 실행:

```bash
python src/preprocess.py
```

### 3. 학습

```bash
# 기본 학습
python src/train.py

# 하이퍼파라미터 조정
python src/train.py --epochs 50 --batch_size 64 --lr 0.0005

# ResNet18 비교 실험
python src/train.py --pretrained
```

### 4. 평가

```bash
python src/evaluate.py
```

### 5. 추론 (서버 연동 테스트)

```bash
python src/predict.py --image ./test_food.jpg
```

## 모델 아키텍처

```
FoodScouterCNN
├── ConvBlock1 (3→32)    + SE Block + MaxPool  → 112×112
├── ConvBlock2 (32→64)   + SE Block + MaxPool  → 56×56
├── ConvBlock3 (64→128)  + SE Block + MaxPool  → 28×28
├── ConvBlock4 (128→256) + SE Block + MaxPool  → 14×14
├── ConvBlock5 (256→512) + SE Block + MaxPool  → 7×7
├── Global Average Pooling                      → 512
├── Dropout(0.5) → FC(512→256) → ReLU
└── Dropout(0.3) → FC(256→num_classes)
```

**특징:**
- SE Block (채널 어텐션) 적용 → 중요한 특징 채널에 가중치
- Label Smoothing → 과적합 방지
- Mixup 데이터 증강 → 일반화 성능 향상
- Cosine Annealing LR → 안정적 수렴
- WeightedRandomSampler → 클래스 불균형 해소

## TensorBoard 모니터링

```bash
tensorboard --logdir=results/tensorboard
```

## 서버 연동

학습 완료 후 `weights/food_scouter_v1.pth`를 서버의 `model/weights/`에 복사하면
Node.js 서버에서 자동으로 로드합니다.
