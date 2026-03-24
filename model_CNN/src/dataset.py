"""
커스텀 음식 이미지 Dataset 클래스
ImageFolder 구조를 사용하되, Albumentations 변환을 적용합니다.
"""

import os
import json
import numpy as np
from pathlib import Path
from PIL import Image
from torch.utils.data import Dataset, DataLoader, WeightedRandomSampler
from collections import Counter

import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import config
from transforms import get_train_transforms, get_val_transforms


class FoodDataset(Dataset):
    """
    음식 이미지 데이터셋

    디렉토리 구조:
      root/
        ├── bibimbop
        │   ├── bibimbap/
        │       ├── bibimbap_0001.jpg
        │       └── ...
        ├── bulgogi/
        │       ├── bulgogi/
        │       ├── bulgogi_0001.jpg
        │       └── ...
    """

    def __init__(self, root_dir, transform=None):
        self.root_dir = root_dir
        self.transform = transform
        self.samples = []     # (image_path, label_index)
        self.classes = []     # 클래스명 리스트
        self.class_to_idx = {}

        # 클래스 디렉토리 탐색
        self.classes = sorted([
            d for d in os.listdir(root_dir)
            if os.path.isdir(os.path.join(root_dir, d))
        ])
        self.class_to_idx = {cls: idx for idx, cls in enumerate(self.classes)}

        # 이미지 파일 수집
        image_extensions = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
        for cls_name in self.classes:
            cls_dir = os.path.join(root_dir, cls_name)
            for fname in sorted(os.listdir(cls_dir)):
                if Path(fname).suffix.lower() in image_extensions:
                    self.samples.append((
                        os.path.join(cls_dir, fname),
                        self.class_to_idx[cls_name],
                    ))

        print(f"  데이터셋 로드: {len(self.samples)}장, {len(self.classes)}클래스 ({root_dir})")

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        img_path, label = self.samples[idx]

        # 이미지 로드 (Albumentations는 numpy 배열 사용)
        image = np.array(Image.open(img_path).convert("RGB"))

        if self.transform:
            transformed = self.transform(image=image)
            image = transformed["image"]

        return image, label

    def get_class_weights(self):
        """
        클래스 불균형 해소를 위한 가중치 계산
        샘플 수가 적은 클래스에 더 높은 가중치 부여
        """
        labels = [s[1] for s in self.samples]
        class_counts = Counter(labels)
        total = len(labels)

        weights = []
        for label in labels:
            weight = total / (len(class_counts) * class_counts[label])
            weights.append(weight)

        return weights

    def get_class_distribution(self):
        """클래스별 샘플 수 반환"""
        labels = [s[1] for s in self.samples]
        counts = Counter(labels)
        return {self.classes[k]: v for k, v in sorted(counts.items())}


def create_dataloaders():
    """
    Train/Val/Test DataLoader 생성
    클래스 불균형 처리를 위한 WeightedRandomSampler 포함
    """
    processed_dir = config.PROCESSED_DIR

    # 데이터셋 생성
    print("\n 데이터셋 로드 중...")
    train_dataset = FoodDataset(
        os.path.join(processed_dir, "train"),
        transform=get_train_transforms(),
    )
    val_dataset = FoodDataset(
        os.path.join(processed_dir, "val"),
        transform=get_val_transforms(),
    )
    test_dataset = FoodDataset(
        os.path.join(processed_dir, "test"),
        transform=get_val_transforms(),
    )

    sample_weights = train_dataset.get_class_weights()
    sampler = WeightedRandomSampler(
        weights=sample_weights,
        num_samples=len(sample_weights),
        replacement=True,
    )

    # DataLoader 생성
    train_loader = DataLoader(
        train_dataset,
        batch_size=config.BATCH_SIZE,
        sampler=sampler,
        num_workers=config.NUM_WORKERS,
        pin_memory=config.PIN_MEMORY,
        drop_last=True,
    )

    val_loader = DataLoader(
        val_dataset,
        batch_size=config.BATCH_SIZE,
        shuffle=False,
        num_workers=config.NUM_WORKERS,
        pin_memory=config.PIN_MEMORY,
    )

    test_loader = DataLoader(
        test_dataset,
        batch_size=config.BATCH_SIZE,
        shuffle=False,
        num_workers=config.NUM_WORKERS,
        pin_memory=config.PIN_MEMORY,
    )

    return train_loader, val_loader, test_loader, train_dataset.classes


if __name__ == "__main__":
    # 데이터셋 테스트
    train_loader, val_loader, test_loader, classes = create_dataloaders()
    print(f"\n  클래스 목록 ({len(classes)}개): {classes[:10]}...")
    print(f"  Train 배치 수: {len(train_loader)}")
    print(f"  Val 배치 수:   {len(val_loader)}")
    print(f"  Test 배치 수:  {len(test_loader)}")

    # 배치 확인
    images, labels = next(iter(train_loader))
    print(f"\n  배치 shape: {images.shape}")  # [32, 3, 224, 224]
    print(f"  라벨 shape: {labels.shape}")    # [32]
