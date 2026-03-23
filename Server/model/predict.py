"""
Food Scouter CNN 추론 스크립트
Node.js 서버에서 child_process.spawn()으로 호출됩니다.

사용법:
  python predict.py --image ./uploads/food.jpg --model ./weights/food_scouter_v1.pth --labels ./data/labels.json

출력 (JSON):
  {"class_name": "bibimbap", "confidence": 0.92, "top_5": [...]}
"""

import argparse
import json
import sys
import torch
import torch.nn as nn
from torchvision import transforms
from PIL import Image


# ── CNN 모델 아키텍처 (직접 구현) ──
class FoodScouterCNN(nn.Module):
    """
    음식 이미지 분류를 위한 경량 CNN 모델
    - 입력: 224x224 RGB 이미지
    - Conv 블록 4개 + FC 레이어 2개
    - Batch Normalization + Dropout 적용
    """

    def __init__(self, num_classes=50):
        super(FoodScouterCNN, self).__init__()

        # Conv Block 1: 3 → 32 채널
        self.conv1 = nn.Sequential(
            nn.Conv2d(3, 32, kernel_size=3, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(inplace=True),
            nn.Conv2d(32, 32, kernel_size=3, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2, 2),  # 224 → 112
        )

        # Conv Block 2: 32 → 64 채널
        self.conv2 = nn.Sequential(
            nn.Conv2d(32, 64, kernel_size=3, padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(inplace=True),
            nn.Conv2d(64, 64, kernel_size=3, padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2, 2),  # 112 → 56
        )

        # Conv Block 3: 64 → 128 채널
        self.conv3 = nn.Sequential(
            nn.Conv2d(64, 128, kernel_size=3, padding=1),
            nn.BatchNorm2d(128),
            nn.ReLU(inplace=True),
            nn.Conv2d(128, 128, kernel_size=3, padding=1),
            nn.BatchNorm2d(128),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2, 2),  # 56 → 28
        )

        # Conv Block 4: 128 → 256 채널
        self.conv4 = nn.Sequential(
            nn.Conv2d(128, 256, kernel_size=3, padding=1),
            nn.BatchNorm2d(256),
            nn.ReLU(inplace=True),
            nn.Conv2d(256, 256, kernel_size=3, padding=1),
            nn.BatchNorm2d(256),
            nn.ReLU(inplace=True),
            nn.AdaptiveAvgPool2d((4, 4)),  # 28 → 4
        )

        # Fully Connected
        self.classifier = nn.Sequential(
            nn.Dropout(0.5),
            nn.Linear(256 * 4 * 4, 512),
            nn.ReLU(inplace=True),
            nn.Dropout(0.3),
            nn.Linear(512, num_classes),
        )

    def forward(self, x):
        x = self.conv1(x)
        x = self.conv2(x)
        x = self.conv3(x)
        x = self.conv4(x)
        x = x.view(x.size(0), -1)  # Flatten
        x = self.classifier(x)
        return x


# ── 이미지 전처리 파이프라인 ──
def get_transform():
    return transforms.Compose(
        [
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406],  # ImageNet 평균
                std=[0.229, 0.224, 0.225],  # ImageNet 표준편차
            ),
        ]
    )


# ── 추론 함수 ──
def predict(image_path, model_path, labels_path):
    # 디바이스 설정
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    # 라벨 로드
    with open(labels_path, "r", encoding="utf-8") as f:
        labels = json.load(f)

    num_classes = len(labels)

    # 모델 로드
    model = FoodScouterCNN(num_classes=num_classes)
    model.load_state_dict(torch.load(model_path, map_location=device))
    model.to(device)
    model.eval()

    # 이미지 로드 및 전처리
    image = Image.open(image_path).convert("RGB")
    transform = get_transform()
    input_tensor = transform(image).unsqueeze(0).to(device)

    # 추론
    with torch.no_grad():
        output = model(input_tensor)
        probabilities = torch.softmax(output, dim=1)
        confidence, predicted_idx = torch.max(probabilities, 1)

    # Top-5 결과
    top5_prob, top5_idx = torch.topk(probabilities, min(5, num_classes), dim=1)
    top_5 = []
    for i in range(top5_prob.size(1)):
        idx = top5_idx[0][i].item()
        label_key = str(idx)
        top_5.append(
            {
                "class_name": labels.get(label_key, f"unknown_{idx}"),
                "confidence": round(top5_prob[0][i].item(), 4),
            }
        )

    result = {
        "class_name": labels.get(str(predicted_idx.item()), "unknown"),
        "confidence": round(confidence.item(), 4),
        "top_5": top_5,
    }

    return result


# ── 메인 실행 ──
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Food Scouter CNN Prediction")
    parser.add_argument("--image", required=True, help="이미지 파일 경로")
    parser.add_argument("--model", required=True, help="모델 가중치 파일 경로")
    parser.add_argument("--labels", required=True, help="라벨 JSON 파일 경로")

    args = parser.parse_args()

    try:
        result = predict(args.image, args.model, args.labels)
        # Node.js가 stdout을 JSON으로 파싱
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)
