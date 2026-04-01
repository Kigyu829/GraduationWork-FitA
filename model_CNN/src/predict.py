"""
단일 이미지 추론 스크립트
Node.js 서버에서 호출되며, JSON으로 결과를 출력합니다.

사용법:
  python src/predict.py --image ./test.jpg --model ./weights/food_scouter_v1.pth

출력 (stdout → JSON):
  {
    "class_name": "bibimbap",
    "class_name_kr": "비빔밥",
    "confidence": 0.9234,
    "top_5": [
      {"class_name": "bibimbap", "confidence": 0.9234},
      {"class_name": "fried_rice", "confidence": 0.0321},
      ...
    ]
  }
"""

import os
import sys
import json
import argparse

import torch
import torch.nn.functional as F
import numpy as np
from PIL import Image

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import config
from model import FoodScouterCNN
from transforms import get_val_transforms, get_tta_transforms


# 영문 → 한글 매핑 (서버 응답에 한글명 포함)
ENGLISH_TO_KOREAN = {
    "bibimbap": "비빔밥", "kimchi_fried_rice": "김치볶음밥",
    "fried_rice": "볶음밥", "curry_rice": "카레라이스",
    "gimbap": "김밥", "white_rice": "흰쌀밥",
    "kimchi_jjigae": "김치찌개", "doenjang_jjigae": "된장찌개",
    "sundubu_jjigae": "순두부찌개", "budae_jjigae": "부대찌개",
    "miyeok_guk": "미역국", "kongnamul_guk": "콩나물국",
    "samgyetang": "삼계탕", "seolleongtang": "설렁탕",
    "ramyeon": "라면", "jajangmyeon": "자장면",
    "jjamppong": "짬뽕", "naengmyeon": "냉면",
    "kalguksu": "칼국수", "pasta": "파스타",
    "bulgogi": "불고기", "samgyeopsal": "삼겹살",
    "galbi": "갈비", "dakgalbi": "닭갈비",
    "jeyuk_bokkeum": "제육볶음", "jokbal": "족발",
    "bossam": "보쌈", "donkatsu": "돈까스",
    "tangsuyuk": "탕수육", "fried_chicken": "치킨",
    "steak": "스테이크", "kimchi": "김치",
    "japchae": "잡채", "gyeran_mari": "계란말이",
    "tteokbokki": "떡볶이", "mandu": "만두",
    "pizza": "피자", "hamburger": "햄버거",
    "sandwich": "샌드위치", "sushi": "초밥",
    "salad": "샐러드", "chicken_breast": "닭가슴살",
    "sweet_potato": "고구마", "fruit": "과일",
    "bread": "빵", "yogurt": "요거트",
    "grilled_fish": "생선구이", "jeon": "전",
}


def predict_single(image_path, model, classes, device, use_tta=False):
    """단일 이미지 추론"""
    image = np.array(Image.open(image_path).convert("RGB"))

    if use_tta:
        # Test Time Augmentation: 여러 변환의 예측을 평균
        tta_transforms = get_tta_transforms()
        all_probs = []

        for transform in tta_transforms:
            transformed = transform(image=image)
            input_tensor = transformed["image"].unsqueeze(0).to(device)

            with torch.no_grad():
                output = model(input_tensor)
                probs = F.softmax(output, dim=1)
                all_probs.append(probs)

        # 평균 확률
        avg_probs = torch.stack(all_probs).mean(dim=0)
        confidence, predicted_idx = torch.max(avg_probs, 1)
        top5_prob, top5_idx = torch.topk(avg_probs, min(5, len(classes)), dim=1)
    else:
        transform = get_val_transforms()
        transformed = transform(image=image)
        input_tensor = transformed["image"].unsqueeze(0).to(device)

        with torch.no_grad():
            output = model(input_tensor)
            probabilities = F.softmax(output, dim=1)
            confidence, predicted_idx = torch.max(probabilities, 1)
            top5_prob, top5_idx = torch.topk(probabilities, min(5, len(classes)), dim=1)

    # 결과 포맷
    predicted_class = classes[predicted_idx.item()]
    top_5 = []
    for i in range(top5_prob.size(1)):
        cls_name = classes[top5_idx[0][i].item()]
        top_5.append({
            "class_name": cls_name,
            "class_name_kr": ENGLISH_TO_KOREAN.get(cls_name, cls_name),
            "confidence": round(top5_prob[0][i].item(), 4),
        })

    result = {
        "class_name": predicted_class,
        "class_name_kr": ENGLISH_TO_KOREAN.get(predicted_class, predicted_class),
        "confidence": round(confidence.item(), 4),
        "top_5": top_5,
    }

    return result


def load_model(model_path, device):
    """저장된 모델 로드"""
    checkpoint = torch.load(model_path, map_location=device)

    classes = checkpoint.get("classes", [])
    num_classes = checkpoint.get("num_classes", len(classes))

    model = FoodScouterCNN(num_classes=num_classes)
    model.load_state_dict(checkpoint["model_state_dict"])
    model.to(device)
    model.eval()

    return model, classes


def main():
    parser = argparse.ArgumentParser(description="Food Scouter CNN Prediction")
    parser.add_argument("--image", required=True, help="이미지 파일 경로")
    parser.add_argument(
        "--model",
        default=os.path.join(config.WEIGHTS_DIR, config.MODEL_FILENAME),
        help="모델 가중치 파일 경로",
    )
    parser.add_argument("--labels", default=None, help="라벨 JSON 파일 (미사용, 호환용)")
    parser.add_argument("--tta", action="store_true", help="Test Time Augmentation 사용")
    args = parser.parse_args()

    try:
        model, classes = load_model(args.model, config.DEVICE)
        result = predict_single(args.image, model, classes, config.DEVICE, use_tta=args.tta)

        # JSON으로 stdout 출력 (Node.js가 파싱)
        print(json.dumps(result, ensure_ascii=False))

    except Exception as e:
        error_result = {"error": str(e)}
        print(json.dumps(error_result), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
