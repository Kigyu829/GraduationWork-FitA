"""
Food Scouter CNN - 학습 설정
모든 하이퍼파라미터와 경로를 한 곳에서 관리합니다.
"""

import os
import torch

# ══════════════════════════════════════════
# 경로 설정
# ══════════════════════════════════════════
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
RAW_DIR = os.path.join(DATA_DIR, "raw")           # AI Hub 원본 데이터
PROCESSED_DIR = os.path.join(DATA_DIR, "processed")  # 전처리된 데이터
WEIGHTS_DIR = os.path.join(BASE_DIR, "weights")
RESULTS_DIR = os.path.join(BASE_DIR, "results")

# ══════════════════════════════════════════
# 데이터셋 설정
# ══════════════════════════════════════════
NUM_CLASSES = 150          # AI Hub 한국 음식 클래스 수
IMG_SIZE = 256             # 입력 이미지 크기
TRAIN_RATIO = 0.8          # 학습 데이터 비율
VAL_RATIO = 0.1            # 검증 데이터 비율
TEST_RATIO = 0.1           # 테스트 데이터 비율
MIN_SAMPLES_PER_CLASS = 50 # 클래스당 최소 이미지 수 (너무 적으면 제외)

# ══════════════════════════════════════════
# 학습 하이퍼파라미터
# ══════════════════════════════════════════
BATCH_SIZE = 16
NUM_EPOCHS = 150
LEARNING_RATE = 0.0005
WEIGHT_DECAY = 1e-4
MOMENTUM = 0.9

# Learning Rate 스케줄러
LR_SCHEDULER = "cosine"    # "step" | "cosine" | "plateau"
LR_STEP_SIZE = 30          # StepLR용
LR_GAMMA = 0.1             # StepLR용
LR_MIN = 1e-6              # CosineAnnealing 최소 LR

# Early Stopping
PATIENCE = 25              # 검증 손실이 개선되지 않으면 중단
MIN_DELTA = 0.001          # 개선으로 인정할 최소 변화량

# ══════════════════════════════════════════
# 모델 설정
# ══════════════════════════════════════════
MODEL_NAME = "FoodScouterCNN"
DROPOUT_RATE = 0.6
USE_PRETRAINED_BACKBONE = False  # True면 ResNet 백본 사용 (비교 실험용)

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
SAVE_EVERY_N_EPOCHS = 10   # N 에포크마다 체크포인트 저장
MODEL_FILENAME = "food_scouter_v1.pth"

# ══════════════════════════════════════════
# TensorBoard
# ══════════════════════════════════════════
TENSORBOARD_LOG_DIR = os.path.join(RESULTS_DIR, "tensorboard")

# ══════════════════════════════════════════
# 경로 자동 생성
# ══════════════════════════════════════════
for d in [DATA_DIR, RAW_DIR, PROCESSED_DIR, WEIGHTS_DIR, RESULTS_DIR, TENSORBOARD_LOG_DIR]:
    os.makedirs(d, exist_ok=True)


def print_config():
    """현재 설정 출력"""
    print("=" * 50)
    print("  Food Scouter CNN - 학습 설정")
    print("=" * 50)
    print(f"  디바이스:       {DEVICE}")
    print(f"  클래스 수:      {NUM_CLASSES}")
    print(f"  이미지 크기:    {IMG_SIZE}x{IMG_SIZE}")
    print(f"  배치 크기:      {BATCH_SIZE}")
    print(f"  에포크:         {NUM_EPOCHS}")
    print(f"  학습률:         {LEARNING_RATE}")
    print(f"  스케줄러:       {LR_SCHEDULER}")
    print(f"  Early Stop:     {PATIENCE} epochs")
    print(f"  드롭아웃:       {DROPOUT_RATE}")
    print(f"  데이터 비율:    Train {TRAIN_RATIO} / Val {VAL_RATIO} / Test {TEST_RATIO}")
    print("=" * 50)


if __name__ == "__main__":
    print_config()
