"""
Food Scouter - 정확도 평가 스크립트

학습 중인 터미널과 별도로 실행 가능
저장된 체크포인트를 불러와서 정확도를 측정합니다.

사용법:
  python model/evaluate.py                        # 최적 모델 평가
  python model/evaluate.py --model weights/checkpoint_epoch005.pth  # 특정 체크포인트
  python model/evaluate.py --samples 200          # 빠른 평가 (200장만)
"""

import os
import sys
import argparse
import time

import torch
from torch.utils.data import DataLoader, Subset
from torchvision.ops import box_iou

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import config
from model import create_model
from dataset import AIHubFoodDataset, get_transforms, collate_fn, load_class_map


@torch.no_grad()
def evaluate(model, data_loader, device, num_samples=None):
    model.eval()

    correct_cls  = 0   # 클래스만 맞은 것
    correct_det  = 0   # 클래스 + IoU≥0.5 (mAP@0.5 근사)
    no_detection = 0   # 아무것도 탐지 못한 것
    total        = 0

    t0 = time.time()

    for images, targets in data_loader:
        images = [img.to(device) for img in images]

        outputs = model(images)  # eval 모드 → loss 없이 예측만 반환

        for output, target in zip(outputs, targets):
            gt_label = target["labels"][0].item()
            gt_box   = target["boxes"][0].to(device)

            total += 1

            # 탐지 결과 없음
            if len(output["scores"]) == 0:
                no_detection += 1
                continue

            # 가장 높은 confidence 예측
            top_idx    = output["scores"].argmax()
            pred_label = output["labels"][top_idx].item()
            pred_box   = output["boxes"][top_idx].unsqueeze(0)

            # 분류 정확도
            if pred_label == gt_label:
                correct_cls += 1

                # IoU 계산 → mAP@0.5
                iou = box_iou(pred_box, gt_box.unsqueeze(0)).item()
                if iou >= 0.5:
                    correct_det += 1

        if num_samples and total >= num_samples:
            break

        # 진행 상황 출력
        if total % 200 == 0:
            elapsed = time.time() - t0
            print(f"  평가 중... {total}장 완료 ({elapsed:.0f}s)")

    elapsed = time.time() - t0
    cls_acc = correct_cls  / total * 100
    det_acc = correct_det  / total * 100
    no_det  = no_detection / total * 100

    print(f"\n{'='*50}")
    print(f"  평가 결과 ({total}장, {elapsed:.0f}s)")
    print(f"{'='*50}")
    print(f"  분류 정확도 (Top-1):     {cls_acc:.1f}%  ({correct_cls}/{total})")
    print(f"  검출 정확도 (mAP@0.5):  {det_acc:.1f}%  ({correct_det}/{total})")
    print(f"  탐지 실패:               {no_det:.1f}%  ({no_detection}/{total})")
    print(f"{'='*50}")

    return cls_acc, det_acc


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model",   default=os.path.join(config.WEIGHTS_DIR, config.MODEL_FILENAME))
    parser.add_argument("--samples", type=int, default=None, help="평가할 샘플 수 (기본: 전체)")
    args = parser.parse_args()

    if not os.path.exists(args.model):
        print(f"모델 파일 없음: {args.model}")
        print("아직 Epoch 1이 끝나지 않았거나 체크포인트가 없습니다.")
        return

    # 모델 로드
    print(f"\n모델 로드 중: {args.model}")
    checkpoint   = torch.load(args.model, map_location=config.DEVICE)
    num_classes  = checkpoint.get("num_classes", config.NUM_CLASSES)
    saved_epoch  = checkpoint.get("epoch", "?")
    saved_loss   = checkpoint.get("val_loss", "?")

    model = create_model(num_classes=num_classes)
    model.load_state_dict(checkpoint["model_state_dict"])
    print(f"  저장된 Epoch: {saved_epoch} | val_loss: {saved_loss:.4f}" if isinstance(saved_loss, float) else f"  Epoch: {saved_epoch}")

    # 데이터셋 (검증용)
    class_map, _ = load_class_map(config.CLASSES_JSON)
    val_dataset  = AIHubFoodDataset(
        img_root   = config.VAL_IMG_DIR,
        label_root = config.VAL_LABEL_DIR,
        class_map  = class_map,
        transforms = get_transforms(train=False),
    )

    if args.samples:
        indices     = list(range(min(args.samples, len(val_dataset))))
        val_dataset = Subset(val_dataset, indices)
        print(f"  평가 샘플: {len(val_dataset)}장 (빠른 평가 모드)")
    else:
        print(f"  평가 샘플: {len(val_dataset)}장 (전체)")

    val_loader = DataLoader(
        val_dataset,
        batch_size  = 4,
        shuffle     = False,
        num_workers = 2,
        pin_memory  = config.PIN_MEMORY,
        collate_fn  = collate_fn,
    )

    evaluate(model, val_loader, config.DEVICE, num_samples=args.samples)


if __name__ == "__main__":
    main()
