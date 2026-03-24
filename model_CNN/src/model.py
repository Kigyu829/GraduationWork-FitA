"""
Food Scouter CNN 모델 아키텍처

직접 설계한 경량 CNN + SE Block(Squeeze-and-Excitation) 적용
교수님께 어필 포인트: 단순 Conv 스택이 아닌 Attention 메커니즘 포함

구조:
  - Conv Block 5개 (3→32→64→128→256→512)
  - 각 블록에 SE Block 적용 (채널 어텐션)
  - Batch Normalization + Dropout
  - Global Average Pooling → FC 2층

비교 실험용 ResNet18 백본도 포함
"""

import torch
import torch.nn as nn
import torch.nn.functional as F

import sys, os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import config


# ══════════════════════════════════════════
# Squeeze-and-Excitation Block
# ══════════════════════════════════════════
class SEBlock(nn.Module):
    """
    채널 어텐션 메커니즘
    각 채널의 중요도를 학습하여 가중치를 부여합니다.
    논문: "Squeeze-and-Excitation Networks" (Hu et al., 2018)

    졸업작품 어필: "단순 CNN이 아닌 Attention 기반 채널 가중치 학습"
    """

    def __init__(self, channels, reduction=16):
        super(SEBlock, self).__init__()
        self.squeeze = nn.AdaptiveAvgPool2d(1)
        self.excitation = nn.Sequential(
            nn.Linear(channels, channels // reduction, bias=False),
            nn.ReLU(inplace=True),
            nn.Linear(channels // reduction, channels, bias=False),
            nn.Sigmoid(),
        )

    def forward(self, x):
        b, c, _, _ = x.size()
        # Squeeze: Global Average Pooling
        y = self.squeeze(x).view(b, c)
        # Excitation: FC → ReLU → FC → Sigmoid
        y = self.excitation(y).view(b, c, 1, 1)
        # Scale: 채널별 가중치 적용
        return x * y.expand_as(x)


# ══════════════════════════════════════════
# Conv Block (Conv + BN + ReLU + SE)
# ══════════════════════════════════════════
class ConvBlock(nn.Module):
    """Conv → BN → ReLU → Conv → BN → ReLU → SE → MaxPool"""

    def __init__(self, in_channels, out_channels, use_se=True):
        super(ConvBlock, self).__init__()
        self.conv = nn.Sequential(
            nn.Conv2d(in_channels, out_channels, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(out_channels),
            nn.ReLU(inplace=True),
            nn.Conv2d(out_channels, out_channels, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(out_channels),
            nn.ReLU(inplace=True),
        )
        self.se = SEBlock(out_channels) if use_se else nn.Identity()
        self.pool = nn.MaxPool2d(2, 2)

    def forward(self, x):
        x = self.conv(x)
        x = self.se(x)
        x = self.pool(x)
        return x


# ══════════════════════════════════════════
# Food Scouter CNN (직접 구현)
# ══════════════════════════════════════════
class FoodScouterCNN(nn.Module):
    """
    음식 이미지 분류를 위한 CNN 모델

    아키텍처:
      Input (3×224×224)
        → ConvBlock1 (32ch, 112×112)  + SE
        → ConvBlock2 (64ch, 56×56)    + SE
        → ConvBlock3 (128ch, 28×28)   + SE
        → ConvBlock4 (256ch, 14×14)   + SE
        → ConvBlock5 (512ch, 7×7)     + SE
        → Global Average Pooling (512)
        → Dropout → FC (512→256) → ReLU
        → Dropout → FC (256→num_classes)

    총 파라미터: ~4.5M (ResNet18의 11M보다 경량)
    """

    def __init__(self, num_classes=config.NUM_CLASSES):
        super(FoodScouterCNN, self).__init__()

        # Feature Extractor
        self.features = nn.Sequential(
            ConvBlock(3, 32),      # 224→112
            ConvBlock(32, 64),     # 112→56
            ConvBlock(64, 128),    # 56→28
            ConvBlock(128, 256),   # 28→14
            ConvBlock(256, 512),   # 14→7
        )

        # Global Average Pooling
        self.gap = nn.AdaptiveAvgPool2d(1)  # 7×7 → 1×1

        # Classifier
        self.classifier = nn.Sequential(
            nn.Dropout(config.DROPOUT_RATE),
            nn.Linear(512, 256),
            nn.ReLU(inplace=True),
            nn.Dropout(config.DROPOUT_RATE * 0.6),  # 두 번째 드롭아웃은 좀 낮게
            nn.Linear(256, num_classes),
        )

        # 가중치 초기화
        self._initialize_weights()

    def forward(self, x):
        x = self.features(x)
        x = self.gap(x)
        x = x.view(x.size(0), -1)  # Flatten
        x = self.classifier(x)
        return x

    def _initialize_weights(self):
        """He 초기화 (ReLU 활성함수에 최적)"""
        for m in self.modules():
            if isinstance(m, nn.Conv2d):
                nn.init.kaiming_normal_(m.weight, mode="fan_out", nonlinearity="relu")
            elif isinstance(m, nn.BatchNorm2d):
                nn.init.constant_(m.weight, 1)
                nn.init.constant_(m.bias, 0)
            elif isinstance(m, nn.Linear):
                nn.init.kaiming_normal_(m.weight, mode="fan_out", nonlinearity="relu")
                if m.bias is not None:
                    nn.init.constant_(m.bias, 0)

    def get_feature_vector(self, x):
        """마지막 FC 직전의 특징 벡터 추출 (시각화용)"""
        x = self.features(x)
        x = self.gap(x)
        x = x.view(x.size(0), -1)
        return x


# ══════════════════════════════════════════
# 비교 실험용: ResNet18 백본 (전이학습)
# ══════════════════════════════════════════
class FoodScouterResNet(nn.Module):
    """
    비교 실험용 ResNet18 기반 모델
    직접 구현한 CNN과 성능 비교하여 발표에 활용
    """

    def __init__(self, num_classes=config.NUM_CLASSES, pretrained=True):
        super(FoodScouterResNet, self).__init__()
        from torchvision import models

        self.backbone = models.resnet18(
            weights=models.ResNet18_Weights.DEFAULT if pretrained else None
        )

        # 마지막 FC 교체
        in_features = self.backbone.fc.in_features
        self.backbone.fc = nn.Sequential(
            nn.Dropout(config.DROPOUT_RATE),
            nn.Linear(in_features, 256),
            nn.ReLU(inplace=True),
            nn.Dropout(0.3),
            nn.Linear(256, num_classes),
        )

    def forward(self, x):
        return self.backbone(x)


# ══════════════════════════════════════════
# 모델 팩토리
# ══════════════════════════════════════════
def create_model(num_classes=config.NUM_CLASSES, use_pretrained=False):
    """모델 생성"""
    if use_pretrained:
        print(f"  모델: ResNet18 (전이학습), 클래스 수: {num_classes}")
        model = FoodScouterResNet(num_classes=num_classes, pretrained=True)
    else:
        print(f"  모델: FoodScouterCNN (직접 구현), 클래스 수: {num_classes}")
        model = FoodScouterCNN(num_classes=num_classes)

    # 파라미터 수 출력
    total_params = sum(p.numel() for p in model.parameters())
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"  전체 파라미터: {total_params:,}")
    print(f"  학습 파라미터: {trainable_params:,}")

    return model.to(config.DEVICE)


if __name__ == "__main__":
    # 모델 테스트
    model = create_model(num_classes=150)

    # 더미 입력으로 forward pass 테스트
    dummy_input = torch.randn(1, 3, 224, 224).to(config.DEVICE)
    output = model(dummy_input)
    print(f"\n  입력:  {dummy_input.shape}")
    print(f"  출력:  {output.shape}")  # [1, 150]
    print(f"  예측:  클래스 {output.argmax(dim=1).item()}")
