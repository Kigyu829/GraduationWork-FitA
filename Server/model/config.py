"""
Food Scouter - Faster R-CNN 학습 설정
"""

import os
import torch

# ══════════════════════════════════════════
# 경로 설정
# ══════════════════════════════════════════
BASE_DIR      = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEIGHTS_DIR   = os.path.join(BASE_DIR, "weights")
RESULTS_DIR   = os.path.join(BASE_DIR, "results")

# AIHub 데이터 경로 (D드라이브)
TRAIN_IMG_DIR   = r"D:\AIHub_training_images"
TRAIN_LABEL_DIR = r"D:\데이터 모음\296.비전영역, 음식이미지 및 정보소개 텍스트 데이터\01-1.정식개방데이터\Training\02.라벨링데이터"
VAL_IMG_DIR     = r"C:\AIHub_Food_Dataset\Validation\images"
VAL_LABEL_DIR   = r"D:\데이터 모음\296.비전영역, 음식이미지 및 정보소개 텍스트 데이터\01-1.정식개방데이터\Validation\02.라벨링데이터"

CLASSES_JSON = os.path.join(BASE_DIR, "model", "data", "labels.json")

# ══════════════════════════════════════════
# 데이터셋 설정
# ══════════════════════════════════════════
NUM_CLASSES  = 100          # 배경 제외 음식 클래스 수
IMG_SIZE     = 800          # Faster R-CNN 입력 크기 (단변 기준)
IMG_MAX_SIZE = 1333

# ══════════════════════════════════════════
# 학습 하이퍼파라미터
# ══════════════════════════════════════════
BATCH_SIZE     = 4          # Faster R-CNN은 GPU 메모리 많이 씀 → 작게
NUM_EPOCHS     = 30
LEARNING_RATE  = 0.005
MOMENTUM       = 0.9
WEIGHT_DECAY   = 5e-4

# Learning Rate 스케줄러 (step)
LR_STEP_SIZE  = 10          # 10 에포크마다 LR 감소
LR_GAMMA      = 0.1

# ══════════════════════════════════════════
# 모델 설정
# ══════════════════════════════════════════
MODEL_FILENAME    = "food_detector_v1.pth"
PRETRAINED_BACKBONE = True  # ResNet50 ImageNet 사전학습 사용

# ══════════════════════════════════════════
# 디바이스
# ══════════════════════════════════════════
DEVICE      = torch.device("cuda" if torch.cuda.is_available() else "cpu")
NUM_WORKERS = 2 if torch.cuda.is_available() else 0
PIN_MEMORY  = torch.cuda.is_available()
USE_AMP     = torch.cuda.is_available()   # Automatic Mixed Precision (RTX 권장)

# ══════════════════════════════════════════
# 저장 설정
# ══════════════════════════════════════════
SAVE_EVERY_N_EPOCHS = 5
TENSORBOARD_LOG_DIR = os.path.join(RESULTS_DIR, "tensorboard")

for d in [WEIGHTS_DIR, RESULTS_DIR, TENSORBOARD_LOG_DIR]:
    os.makedirs(d, exist_ok=True)


def print_config():
    print("=" * 50)
    print("  Food Scouter - Faster R-CNN 설정")
    print("=" * 50)
    print(f"  디바이스:        {DEVICE}")
    print(f"  클래스 수:       {NUM_CLASSES} (+ background)")
    print(f"  배치 크기:       {BATCH_SIZE}")
    print(f"  에포크:          {NUM_EPOCHS}")
    print(f"  학습률:          {LEARNING_RATE}")
    print(f"  훈련 이미지:     {TRAIN_IMG_DIR}")
    print(f"  검증 이미지:     {VAL_IMG_DIR}")
    print("=" * 50)


if __name__ == "__main__":
    print_config()
