"""
Food Scouter - SAM + FoodScouterCNN 하이브리드 추론

위치 탐지: SAM (Segment Anything Model) -> 이미지에서 음식 영역 자동 분리
분류:      FoodScouterCNN v1+v2 앙상블   -> 각 영역을 150 한국음식 클래스로 분류

사용법:
  python model/predict.py --image ./test.jpg
"""

import os
import sys
import json
import argparse
import importlib.util

import numpy as np
import torch
import torchvision.transforms as T
import torchvision.ops as ops
from PIL import Image

_HERE        = os.path.dirname(os.path.abspath(__file__))
_CNN_SRC     = os.path.abspath(os.path.join(_HERE, '..', '..', 'model_CNN', 'src'))
_CNN_SRC_V2  = os.path.abspath(os.path.join(_CNN_SRC, 'v2_backup'))

sys.path.insert(0, _HERE)
import config

# ── 하이퍼파라미터 ──────────────────────────────────────
SCORE_THRESHOLD   = 0.27  # FoodScouterCNN 분류 신뢰도 최소값
NMS_IOU_THRESHOLD = 0.3   # NMS IoU 임계값
CNN_IMG_SIZE      = 256   # FoodScouterCNN 입력 크기
MIN_AREA_RATIO    = 0.005 # 이미지 전체 대비 최소 면적 비율 (0.5%)
MAX_AREA_RATIO    = 0.6   # 이미지 전체 대비 최대 면적 비율 (60%)
TOP_K_PER_REGION  = 3     # 각 SAM 영역에서 상위 K개 후보 포함
CROP_PADDING      = 0.08  # Crop 주변 패딩 비율 (8%)
SAM_POINTS        = 32    # SAM points_per_side (많을수록 세밀, 느려짐)

# TTA (Test Time Augmentation) 변환 목록 - 5가지
_MEAN = [0.485, 0.456, 0.406]
_STD  = [0.229, 0.224, 0.225]
_TTA_TRANSFORMS = [
    # 기본
    T.Compose([T.Resize((CNN_IMG_SIZE, CNN_IMG_SIZE)), T.ToTensor(), T.Normalize(_MEAN, _STD)]),
    # 좌우 반전
    T.Compose([T.Resize((CNN_IMG_SIZE, CNN_IMG_SIZE)), T.RandomHorizontalFlip(p=1.0), T.ToTensor(), T.Normalize(_MEAN, _STD)]),
    # 상하 반전
    T.Compose([T.Resize((CNN_IMG_SIZE, CNN_IMG_SIZE)), T.RandomVerticalFlip(p=1.0), T.ToTensor(), T.Normalize(_MEAN, _STD)]),
    # 약간 확대 후 중앙 크롭 (1.1x)
    T.Compose([T.Resize((int(CNN_IMG_SIZE*1.1), int(CNN_IMG_SIZE*1.1))), T.CenterCrop(CNN_IMG_SIZE), T.ToTensor(), T.Normalize(_MEAN, _STD)]),
    # 더 크게 확대 후 중앙 크롭 (1.2x)
    T.Compose([T.Resize((int(CNN_IMG_SIZE*1.2), int(CNN_IMG_SIZE*1.2))), T.CenterCrop(CNN_IMG_SIZE), T.ToTensor(), T.Normalize(_MEAN, _STD)]),
]


# ── 모델 로드 ────────────────────────────────────────────

def load_sam(checkpoint_path, device):
    from segment_anything import sam_model_registry, SamAutomaticMaskGenerator
    sam = sam_model_registry["vit_b"](checkpoint=checkpoint_path)
    sam.to(device=device)
    mask_generator = SamAutomaticMaskGenerator(
        model=sam,
        points_per_side=SAM_POINTS,
        pred_iou_thresh=0.88,
        stability_score_thresh=0.92,
        min_mask_region_area=500,
    )
    return mask_generator


def load_cnn(model_path, device):
    """model_CNN/src/model.py 또는 v2_backup/model.py를 직접 로드 (config 충돌 방지)"""
    is_v2   = 'v2' in os.path.basename(model_path)
    src_dir = _CNN_SRC_V2 if is_v2 else _CNN_SRC

    old_config = sys.modules.pop('config', None)
    sys.path.insert(0, src_dir)
    try:
        spec = importlib.util.spec_from_file_location(
            "food_scouter_cnn",
            os.path.join(src_dir, "model.py")
        )
        cnn_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cnn_module)
    finally:
        sys.path.pop(0)
        sys.modules.pop('config', None)
        if old_config is not None:
            sys.modules['config'] = old_config

    ckpt = torch.load(model_path, map_location=device)
    num_classes = ckpt.get('num_classes', 150)
    classes     = ckpt.get('classes', [])
    model = cnn_module.FoodScouterCNN(num_classes=num_classes)
    model.load_state_dict(ckpt['model_state_dict'])
    model.to(device).eval()
    return model, classes


def load_cnn_safe(model_path, device):
    """로드 실패 시 None 반환 (앙상블에서 선택적으로 사용)"""
    if not os.path.exists(model_path):
        return None, []
    try:
        return load_cnn(model_path, device)
    except Exception:
        return None, []


# ── SAM 세그멘테이션 ─────────────────────────────────────

def get_sam_regions(mask_generator, image_np):
    """SAM으로 이미지 내 오브젝트 마스크 생성 후 크기/형태 필터링"""
    masks    = mask_generator.generate(image_np)
    img_h, img_w = image_np.shape[0], image_np.shape[1]
    img_area = img_h * img_w

    filtered = []
    for m in masks:
        ratio = m['area'] / img_area
        if not (MIN_AREA_RATIO <= ratio <= MAX_AREA_RATIO):
            continue
        x, y, w, h = m['bbox']  # XYWH
        x1, y1, x2, y2 = x, y, x + w, y + h

        # 이미지 경계 근처의 얇은 띠 영역 제거 (워터마크/로고 오탐지 방지)
        near_top    = y1 < img_h * 0.05 and h < img_h * 0.15
        near_bottom = y2 > img_h * 0.95 and h < img_h * 0.15
        near_left   = x1 < img_w * 0.05 and w < img_w * 0.15
        near_right  = x2 > img_w * 0.95 and w < img_w * 0.15
        if near_top or near_bottom or near_left or near_right:
            continue

        # 극단적인 종횡비 제거 (6:1 이상 얇은 띠)
        aspect = max(w / h, h / w) if h > 0 and w > 0 else 999
        if aspect > 6:
            continue

        filtered.append({
            'bbox': [x1, y1, x2, y2],
            'iou':  m['predicted_iou'],
        })

    filtered.sort(key=lambda m: m['iou'], reverse=True)
    return filtered


def get_quadrant_regions(img_w, img_h):
    """SAM이 놓친 대형 음식을 보완하는 사분면 + 중앙 보조 영역"""
    hw, hh = img_w // 2, img_h // 2
    regions = [
        [0,  0,  hw,    hh],     # 좌상
        [hw, 0,  img_w, hh],     # 우상
        [0,  hh, hw,    img_h],  # 좌하
        [hw, hh, img_w, img_h],  # 우하
        [hw//2, hh//2, hw//2 + hw, hh//2 + hh],  # 중앙
    ]
    return [{'bbox': r, 'iou': 0.5} for r in regions]


# ── CNN 분류 (앙상블 + TTA + Crop 패딩) ──────────────────

def classify_crop(cnn_models, image, box, device, classes, top_k=TOP_K_PER_REGION):
    """박스 영역 crop → v1+v2 앙상블 + TTA 분류, Top-K 후보 반환"""
    img_w, img_h = image.size
    x1, y1, x2, y2 = [max(0, int(v)) for v in box]

    # Crop 패딩: 박스 주변에 여백 추가
    pad_x = int((x2 - x1) * CROP_PADDING)
    pad_y = int((y2 - y1) * CROP_PADDING)
    x1 = max(0, x1 - pad_x)
    y1 = max(0, y1 - pad_y)
    x2 = min(img_w, x2 + pad_x)
    y2 = min(img_h, y2 + pad_y)

    crop = image.crop((x1, y1, x2, y2))
    if crop.size[0] < 10 or crop.size[1] < 10:
        return []

    # 앙상블: 각 모델의 TTA 확률 평균
    ensemble_probs = None
    for model in cnn_models:
        model_probs = None
        for tfm in _TTA_TRANSFORMS:
            tensor = tfm(crop).unsqueeze(0).to(device)
            with torch.no_grad():
                probs = torch.softmax(model(tensor), dim=1)
            model_probs = probs if model_probs is None else model_probs + probs
        model_probs /= len(_TTA_TRANSFORMS)
        ensemble_probs = model_probs if ensemble_probs is None else ensemble_probs + model_probs
    ensemble_probs /= len(cnn_models)

    # Top-K 후보 반환
    top_confs, top_preds = ensemble_probs.topk(min(top_k, ensemble_probs.size(1)), dim=1)
    results = []
    for conf, pred in zip(top_confs[0], top_preds[0]):
        idx  = pred.item()
        name = classes[idx] if idx < len(classes) else f"class_{idx}"
        results.append((name, conf.item()))
    return results


# ── 메인 추론 ────────────────────────────────────────────

def predict(image_path, mask_generator, cnn_models, classes, device):
    image    = Image.open(image_path).convert("RGB")
    image_np = np.array(image)
    img_h, img_w = image_np.shape[0], image_np.shape[1]

    # 1단계: SAM 세그멘테이션 + 사분면 보조 영역
    sam_regions = get_sam_regions(mask_generator, image_np)
    quad_regions = get_quadrant_regions(img_w, img_h)
    regions = sam_regions + quad_regions

    if not regions:
        return {"detections": [], "best": None}

    # 2단계: 각 영역을 앙상블 CNN으로 분류 (Top-K 후보)
    raw = []
    for region in regions:
        candidates = classify_crop(cnn_models, image, region['bbox'], device, classes)
        for name, conf in candidates:
            if conf >= SCORE_THRESHOLD:
                raw.append({
                    "class_name": name,
                    "confidence": round(conf, 4),
                    "bbox":       [round(v, 1) for v in region['bbox']],
                })

    if not raw:
        return {"detections": [], "best": None}

    # 3단계: NMS로 겹치는 박스 제거
    boxes_t  = torch.tensor([d["bbox"] for d in raw], dtype=torch.float32)
    scores_t = torch.tensor([d["confidence"] for d in raw])
    keep     = ops.nms(boxes_t, scores_t, iou_threshold=NMS_IOU_THRESHOLD)
    detections = [raw[i] for i in keep.tolist()]

    # 4단계: 큰 박스 안에 포함된 작은 박스 제거 (음식 내부 재료 오탐지 방지)
    def is_contained(inner, outer, thresh=0.7):
        ix1, iy1, ix2, iy2 = inner
        ox1, oy1, ox2, oy2 = outer
        inter_x1, inter_y1 = max(ix1, ox1), max(iy1, oy1)
        inter_x2, inter_y2 = min(ix2, ox2), min(iy2, oy2)
        if inter_x2 <= inter_x1 or inter_y2 <= inter_y1:
            return False
        inter_area = (inter_x2 - inter_x1) * (inter_y2 - inter_y1)
        inner_area = max((ix2 - ix1) * (iy2 - iy1), 1)
        return inter_area / inner_area >= thresh

    filtered = []
    for i, d in enumerate(detections):
        dominated = any(
            j != i
            and detections[j]["confidence"] > d["confidence"]
            and is_contained(d["bbox"], detections[j]["bbox"])
            for j in range(len(detections))
        )
        if not dominated:
            filtered.append(d)
    detections = filtered

    # 5단계: 클래스당 최고 confidence 1개만 유지
    seen = {}
    deduped = []
    for d in sorted(detections, key=lambda x: x["confidence"], reverse=True):
        if d["class_name"] not in seen:
            seen[d["class_name"]] = True
            deduped.append(d)

    return {"detections": deduped, "best": deduped[0] if deduped else None}


def main():
    parser = argparse.ArgumentParser(description="Food Scouter (SAM + FoodScouterCNN Ensemble)")
    parser.add_argument("--image",  required=True)
    parser.add_argument("--sam",    default=os.path.join(config.WEIGHTS_DIR, "sam_vit_b.pth"))
    parser.add_argument("--cnn",    default=os.path.join(_HERE, '..', '..', 'model_CNN', 'weights', 'food_scouter_v2.pth'))
    parser.add_argument("--cnn2",   default=os.path.join(_HERE, '..', '..', 'model_CNN', 'weights', 'food_scouter_v1.pth'))
    parser.add_argument("--model",  default=None, help="(미사용, 호환용)")
    parser.add_argument("--labels", default=None, help="(미사용, 호환용)")
    args = parser.parse_args()

    try:
        mask_generator      = load_sam(args.sam, config.DEVICE)
        cnn_v2, classes     = load_cnn(args.cnn,  config.DEVICE)
        cnn_v1, _           = load_cnn_safe(args.cnn2, config.DEVICE)

        cnn_models = [m for m in [cnn_v1, cnn_v2] if m is not None]
        result = predict(args.image, mask_generator, cnn_models, classes, config.DEVICE)
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        import traceback
        print(json.dumps({"error": str(e), "trace": traceback.format_exc()}), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
