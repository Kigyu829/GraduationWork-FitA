"""
AIHub 음식 데이터셋 로더 - Faster R-CNN용

AIHub JSON 어노테이션 → PyTorch 타겟 포맷 변환
  JSON: { "data": { "2d_annotation": {x, y, width, height}, ... } }
  타겟: { "boxes": Tensor[N,4] (x1,y1,x2,y2), "labels": Tensor[N] }
"""

import os
import json
import glob

import torch
from torch.utils.data import Dataset
from PIL import Image
import torchvision.transforms.functional as TF
import torchvision.transforms as T


def load_class_map(classes_json_path):
    """labels.json 로드 → {food_id: class_idx} 매핑 반환"""
    with open(classes_json_path, encoding="utf-8") as f:
        labels = json.load(f)
    # labels.json: {"0": {"name": "가자미구이", "food_id": "A13001"}, ...}
    class_map = {}   # food_id → class_idx (1-based, 0은 background)
    idx_to_name = {} # class_idx → 음식명
    for idx_str, info in labels.items():
        idx = int(idx_str) + 1  # 0은 배경이므로 +1
        class_map[info["food_id"]] = idx
        idx_to_name[idx] = info["name"]
    return class_map, idx_to_name


class AIHubFoodDataset(Dataset):
    """
    AIHub 음식 이미지 데이터셋

    이미지 경로: {img_root}/TS{N}/X/NN/food_id/촬영번호/각도/파일명.jpg
    라벨 경로:  {label_root}/TL{N}/X/NN/food_id/촬영번호/각도/파일명.json
    """

    def __init__(self, img_root, label_root, class_map, transforms=None):
        self.img_root   = img_root
        self.label_root = label_root
        self.class_map  = class_map   # food_id → class_idx
        self.transforms = transforms
        self.samples    = []          # (img_path, label_path, class_idx) 리스트

        self._build_samples()

    def _build_samples(self):
        """이미지-라벨 페어 수집"""
        pattern = os.path.join(self.img_root, "**", "*.jpg")
        img_paths = glob.glob(pattern, recursive=True)

        for img_path in img_paths:
            # 음식 ID 추출 (경로의 4번째 레벨: TSN/X/NN/food_id/...)
            rel = os.path.relpath(img_path, self.img_root)
            parts = rel.split(os.sep)
            if len(parts) < 4:
                continue

            ts_folder  = parts[0]              # TS1, TS2, ... or VS1, VS2, ...
            food_id    = parts[3]              # A13001, B12006, ...

            if food_id not in self.class_map:
                continue

            # 대응 라벨 경로 구성 (TSN → TLN, VSN → VLN, .jpg → .json)
            prefix_map = {"TS": "TL", "VS": "VL"}
            img_prefix = ts_folder[:2]
            label_prefix = prefix_map.get(img_prefix, "TL")
            tl_folder  = label_prefix + ts_folder[2:]
            label_rel  = os.path.join(tl_folder, *parts[1:])
            label_path = os.path.join(
                self.label_root,
                label_rel.replace(".jpg", ".json")
            )

            if not os.path.exists(label_path):
                continue

            self.samples.append((img_path, label_path, self.class_map[food_id]))

        print(f"  데이터셋 로드 완료: {len(self.samples)}개 샘플")

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        img_path, label_path, class_idx = self.samples[idx]

        # 이미지 로드
        image = Image.open(img_path).convert("RGB")
        orig_w, orig_h = image.size

        # 어노테이션 로드
        with open(label_path, encoding="utf-8") as f:
            ann = json.load(f)

        bbox = ann["data"]["2d_annotation"]
        x, y, bw, bh = bbox["x"], bbox["y"], bbox["width"], bbox["height"]

        # XYWH → XYXY 변환 + 이미지 범위 클램핑
        x1 = max(0.0, float(x))
        y1 = max(0.0, float(y))
        x2 = min(float(orig_w), float(x + bw))
        y2 = min(float(orig_h), float(y + bh))

        # get_transforms의 Resize(800) 비율에 맞게 바운딩박스 스케일 조정
        scale = 800.0 / min(orig_w, orig_h)
        new_w, new_h = orig_w * scale, orig_h * scale
        sx, sy = new_w / orig_w, new_h / orig_h
        x1, x2 = x1 * sx, x2 * sx
        y1, y2 = y1 * sy, y2 * sy

        # 유효하지 않은 박스 처리
        if x2 <= x1 or y2 <= y1:
            x1, y1, x2, y2 = 0.0, 0.0, float(new_w), float(new_h)

        boxes  = torch.tensor([[x1, y1, x2, y2]], dtype=torch.float32)
        labels = torch.tensor([class_idx], dtype=torch.int64)

        target = {
            "boxes":    boxes,
            "labels":   labels,
            "image_id": torch.tensor([idx]),
        }

        if self.transforms:
            image = self.transforms(image)

        return image.contiguous(), target


def get_transforms(train=True):
    """이미지 전처리 변환

    2992×2992 원본을 800px로 먼저 리사이즈 (메모리 14배 절감)
    Faster R-CNN 내부에서도 리사이즈하지만, 배치 적재 전에 줄여야 RAM/디스크 부담 감소
    """
    transforms = [
        T.Resize(800),   # 단변 기준 800px (원본 107MB → 7MB)
        T.ToTensor(),
    ]
    if train:
        transforms += [
            T.RandomHorizontalFlip(0.5),
            T.RandomVerticalFlip(0.1),
            T.ColorJitter(brightness=0.3, contrast=0.3, saturation=0.3, hue=0.05),
            T.RandomGrayscale(p=0.02),
            T.RandomAutocontrast(p=0.1),
        ]
    return T.Compose(transforms)


def collate_fn(batch):
    """DataLoader collate - 이미지/타겟 각각 리스트로"""
    return tuple(zip(*batch))
