"""
Food Scouter CNN v2 - 학습 설정
"""

import os
import torch

# ══════════════════════════════════════════
# 경로 설정
# ══════════════════════════════════════════
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA_DIR = os.path.join(BASE_DIR, "data")
RAW_DIR = os.path.join(DATA_DIR, "raw")
PROCESSED_DIR = os.path.join(DATA_DIR, "processed")
WEIGHTS_DIR = os.path.join(BASE_DIR, "weights")
RESULTS_DIR = os.path.join(BASE_DIR, "results")

# ══════════════════════════════════════════
# 데이터셋 설정
# ══════════════════════════════════════════
NUM_CLASSES = 150
IMG_SIZE = 256
TRAIN_RATIO = 0.8
VAL_RATIO = 0.1
TEST_RATIO = 0.1
MIN_SAMPLES_PER_CLASS = 50

# ══════════════════════════════════════════
# 학습 하이퍼파라미터
# ══════════════════════════════════════════
BATCH_SIZE = 16
NUM_EPOCHS = 200
LEARNING_RATE = 0.0003
WEIGHT_DECAY = 1e-4
MOMENTUM = 0.9

LR_SCHEDULER = "cosine_warm"
LR_STEP_SIZE = 30
LR_GAMMA = 0.1
LR_MIN = 1e-6

PATIENCE = 40
MIN_DELTA = 0.001

# ══════════════════════════════════════════
# 모델 설정
# ══════════════════════════════════════════
MODEL_NAME = "FoodScouterCNNv2"
DROPOUT_RATE = 0.5
USE_PRETRAINED_BACKBONE = False

# ══════════════════════════════════════════
# 데이터 증강
# ══════════════════════════════════════════
AUGMENTATION = {
    "horizontal_flip": True,
    "vertical_flip": False,
    "rotation_limit": 15,
    "brightness_limit": 0.2,
    "contrast_limit": 0.2,
    "hue_shift_limit": 10,
    "saturation_limit": 20,
    "blur_limit": 3,
    "noise_var_limit": (10, 50),
    "cutout_num_holes": 4,
    "cutout_max_size": 40,
}

# ══════════════════════════════════════════
# 디바이스 설정
# ══════════════════════════════════════════
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
NUM_WORKERS = 4 if torch.cuda.is_available() else 0
PIN_MEMORY = torch.cuda.is_available()

# ══════════════════════════════════════════
# 저장 설정
# ══════════════════════════════════════════
SAVE_BEST_ONLY = True
SAVE_EVERY_N_EPOCHS = 10
MODEL_FILENAME = "food_scouter_v2.pth"

# ══════════════════════════════════════════
# TensorBoard
# ══════════════════════════════════════════
TENSORBOARD_LOG_DIR = os.path.join(RESULTS_DIR, "tensorboard_v2")

# ══════════════════════════════════════════
# 경로 자동 생성
# ══════════════════════════════════════════
for d in [DATA_DIR, RAW_DIR, PROCESSED_DIR, WEIGHTS_DIR, RESULTS_DIR, TENSORBOARD_LOG_DIR]:
    os.makedirs(d, exist_ok=True)


def print_config():
    print("=" * 50)
    print("  Food Scouter CNN v2 - 학습 설정")
    print("=" * 50)
    print(f"  디바이스:       {DEVICE}")
    print(f"  모델:           {MODEL_NAME}")
    print(f"  이미지 크기:    {IMG_SIZE}x{IMG_SIZE}")
    print(f"  배치 크기:      {BATCH_SIZE}")
    print(f"  에포크:         {NUM_EPOCHS}")
    print(f"  학습률:         {LEARNING_RATE}")
    print(f"  스케줄러:       {LR_SCHEDULER}")
    print(f"  Early Stop:     {PATIENCE} epochs")
    print(f"  드롭아웃:       {DROPOUT_RATE}")
    print(f"  저장 파일:      {MODEL_FILENAME}")
    print("=" * 50)


if __name__ == "__main__":
    print_config()
