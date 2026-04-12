"""
데이터 증강 및 전처리 파이프라인
Albumentations 라이브러리 사용 (torchvision보다 빠르고 다양한 증강 제공)
"""

import albumentations as A
from albumentations.pytorch import ToTensorV2
import cv2

import sys, os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import config


def get_train_transforms():
    """
    학습용 데이터 증강
    음식 사진 특성을 고려한 증강 전략:
    - 좌우 반전 O (음식은 방향 무관)
    - 상하 반전 X (음식 사진은 위에서 찍으므로 비현실적)
    - 색상 변화 O (조명 환경 다양화)
    - 회전 제한적 (±15도, 접시가 기울어진 느낌)
    - Cutout O (부분 가림에 강건하게)
    """
    aug = config.AUGMENTATION

    return A.Compose([
        # 크기 조정
        A.Resize(config.IMG_SIZE, config.IMG_SIZE),

        # 기하학적 변환
        A.HorizontalFlip(p=0.5 if aug["horizontal_flip"] else 0),
        A.Rotate(limit=aug["rotation_limit"], p=0.3, border_mode=cv2.BORDER_REFLECT_101),
        A.ShiftScaleRotate(
            shift_limit=0.05,
            scale_limit=0.1,
            rotate_limit=0,
            p=0.2,
        ),

        # 색상 변환 (조명 환경 다양화)
        A.OneOf([
            A.ColorJitter(
                brightness=aug["brightness_limit"],
                contrast=aug["contrast_limit"],
                saturation=aug["saturation_limit"] / 100,
                hue=aug["hue_shift_limit"] / 360,
                p=1,
            ),
            A.HueSaturationValue(
                hue_shift_limit=aug["hue_shift_limit"],
                sat_shift_limit=aug["saturation_limit"],
                val_shift_limit=20,
                p=1,
            ),
        ], p=0.5),

        # 블러 & 노이즈 (카메라 품질 다양화)
        A.OneOf([
            A.GaussianBlur(blur_limit=aug["blur_limit"], p=1),
            A.GaussNoise(var_limit=aug["noise_var_limit"], p=1),
            A.MotionBlur(blur_limit=3, p=1),
        ], p=0.2),

        # Cutout (부분 가림 → 강건성 향상)
        A.CoarseDropout(
            max_holes=aug["cutout_num_holes"],
            max_height=aug["cutout_max_size"],
            max_width=aug["cutout_max_size"],
            min_holes=1,
            min_height=10,
            min_width=10,
            fill_value=0,
            p=0.3,
        ),

        # 정규화 (ImageNet 통계)
        A.Normalize(
            mean=[0.485, 0.456, 0.406],
            std=[0.229, 0.224, 0.225],
        ),
        ToTensorV2(),
    ])


def get_val_transforms():
    """검증/테스트용 전처리 (증강 없음)"""
    return A.Compose([
        A.Resize(config.IMG_SIZE, config.IMG_SIZE),
        A.Normalize(
            mean=[0.485, 0.456, 0.406],
            std=[0.229, 0.224, 0.225],
        ),
        ToTensorV2(),
    ])


def get_tta_transforms():
    """
    Test Time Augmentation (TTA)
    테스트 시 여러 변환을 적용해 예측을 앙상블하여 정확도 향상
    """
    return [
        # 원본
        get_val_transforms(),
        # 좌우 반전
        A.Compose([
            A.Resize(config.IMG_SIZE, config.IMG_SIZE),
            A.HorizontalFlip(p=1.0),
            A.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
            ToTensorV2(),
        ]),
        # 약간 확대
        A.Compose([
            A.Resize(int(config.IMG_SIZE * 1.1), int(config.IMG_SIZE * 1.1)),
            A.CenterCrop(config.IMG_SIZE, config.IMG_SIZE),
            A.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
            ToTensorV2(),
        ]),
    ]
