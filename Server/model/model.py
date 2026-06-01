"""
Food Scouter - Faster R-CNN 모델

torchvision의 fasterrcnn_resnet50_fpn 기반
ResNet50 + FPN 백본 (ImageNet 사전학습) + 커스텀 헤드
"""

import torch
import torchvision
from torchvision.models.detection import fasterrcnn_resnet50_fpn_v2, FasterRCNN_ResNet50_FPN_V2_Weights
from torchvision.models.detection.faster_rcnn import FastRCNNPredictor

import sys, os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import config


def create_model(num_classes=config.NUM_CLASSES, pretrained=config.PRETRAINED_BACKBONE):
    """
    Faster R-CNN 모델 생성

    num_classes: 배경 제외 클래스 수 (내부에서 +1 처리)
    """
    weights = FasterRCNN_ResNet50_FPN_V2_Weights.DEFAULT if pretrained else None
    model = fasterrcnn_resnet50_fpn_v2(weights=weights)

    # 분류 헤드를 num_classes+1(배경 포함)로 교체
    in_features = model.roi_heads.box_predictor.cls_score.in_features
    model.roi_heads.box_predictor = FastRCNNPredictor(
        in_features, num_classes + 1  # +1: background
    )

    total_params     = sum(p.numel() for p in model.parameters())
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"  모델: Faster R-CNN v2 (ResNet50 + FPN v2)", file=sys.stderr)
    print(f"  클래스 수: {num_classes} + 1(배경) = {num_classes + 1}", file=sys.stderr)
    print(f"  전체 파라미터: {total_params:,}", file=sys.stderr)
    print(f"  학습 파라미터: {trainable_params:,}", file=sys.stderr)

    return model.to(config.DEVICE)


if __name__ == "__main__":
    model = create_model()
    model.eval()

    # 더미 입력 테스트
    dummy = [torch.randn(3, 800, 800).to(config.DEVICE)]
    with torch.no_grad():
        out = model(dummy)
    print(f"\n  테스트 출력 키: {list(out[0].keys())}")
    print(f"  박스 수: {len(out[0]['boxes'])}")
