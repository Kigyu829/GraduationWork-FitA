"""
Food Scouter CNN v2 모델 아키텍처

v1 대비 개선:
  1. Residual Connection (학습 안정성 + 깊은 네트워크)
  2. CBAM 어텐션 (채널 + 공간 어텐션 동시 적용)
  3. Stochastic Depth (과적합 방지)
  4. Stem 레이어 (초기 특징 추출 강화)
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
import random

import sys, os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import config


# ══════════════════════════════════════════
# CBAM: Convolutional Block Attention Module
# ══════════════════════════════════════════
class ChannelAttention(nn.Module):
    def __init__(self, channels, reduction=16):
        super().__init__()
        self.avg_pool = nn.AdaptiveAvgPool2d(1)
        self.max_pool = nn.AdaptiveMaxPool2d(1)
        self.fc = nn.Sequential(
            nn.Linear(channels, channels // reduction, bias=False),
            nn.ReLU(inplace=True),
            nn.Linear(channels // reduction, channels, bias=False),
        )

    def forward(self, x):
        b, c, _, _ = x.size()
        avg_out = self.fc(self.avg_pool(x).view(b, c))
        max_out = self.fc(self.max_pool(x).view(b, c))
        attention = torch.sigmoid(avg_out + max_out).view(b, c, 1, 1)
        return x * attention


class SpatialAttention(nn.Module):
    def __init__(self, kernel_size=7):
        super().__init__()
        padding = kernel_size // 2
        self.conv = nn.Conv2d(2, 1, kernel_size, padding=padding, bias=False)

    def forward(self, x):
        avg_out = torch.mean(x, dim=1, keepdim=True)
        max_out, _ = torch.max(x, dim=1, keepdim=True)
        attention = torch.sigmoid(self.conv(torch.cat([avg_out, max_out], dim=1)))
        return x * attention


class CBAM(nn.Module):
    def __init__(self, channels, reduction=16):
        super().__init__()
        self.channel_att = ChannelAttention(channels, reduction)
        self.spatial_att = SpatialAttention()

    def forward(self, x):
        x = self.channel_att(x)
        x = self.spatial_att(x)
        return x


# ══════════════════════════════════════════
# Residual Conv Block
# ══════════════════════════════════════════
class ResidualConvBlock(nn.Module):
    def __init__(self, in_channels, out_channels, stride=1, drop_rate=0.0):
        super().__init__()

        self.conv = nn.Sequential(
            nn.Conv2d(in_channels, out_channels, 3, stride=stride, padding=1, bias=False),
            nn.BatchNorm2d(out_channels),
            nn.ReLU(inplace=True),
            nn.Conv2d(out_channels, out_channels, 3, padding=1, bias=False),
            nn.BatchNorm2d(out_channels),
        )

        self.cbam = CBAM(out_channels)

        self.shortcut = nn.Identity()
        if in_channels != out_channels or stride != 1:
            self.shortcut = nn.Sequential(
                nn.Conv2d(in_channels, out_channels, 1, stride=stride, bias=False),
                nn.BatchNorm2d(out_channels),
            )

        self.relu = nn.ReLU(inplace=True)
        self.drop_rate = drop_rate

    def forward(self, x):
        if self.training and self.drop_rate > 0 and random.random() < self.drop_rate:
            return self.shortcut(x)

        residual = self.shortcut(x)
        out = self.conv(x)
        out = self.cbam(out)
        out = out + residual
        out = self.relu(out)
        return out


# ══════════════════════════════════════════
# Food Scouter CNN v2
# ══════════════════════════════════════════
class FoodScouterCNN(nn.Module):
    """
    v2 아키텍처:
      Input (3×256×256)
        → Stem (7×7 Conv, stride=2, MaxPool) → 64ch, 64×64
        → Stage 1: 2×ResBlock (64ch)
        → Stage 2: 2×ResBlock (128ch) stride=2
        → Stage 3: 3×ResBlock (256ch) stride=2
        → Stage 4: 3×ResBlock (512ch) stride=2
        → Global Average Pooling
        → FC (512→256→num_classes)
    """

    def __init__(self, num_classes=config.NUM_CLASSES):
        super().__init__()

        self.stem = nn.Sequential(
            nn.Conv2d(3, 64, kernel_size=7, stride=2, padding=3, bias=False),
            nn.BatchNorm2d(64),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(3, stride=2, padding=1),
        )

        drop_rates = [0.0, 0.05, 0.05, 0.1, 0.1, 0.15, 0.15, 0.2, 0.2, 0.2]

        self.stage1 = nn.Sequential(
            ResidualConvBlock(64, 64, drop_rate=drop_rates[0]),
            ResidualConvBlock(64, 64, drop_rate=drop_rates[1]),
        )

        self.stage2 = nn.Sequential(
            ResidualConvBlock(64, 128, stride=2, drop_rate=drop_rates[2]),
            ResidualConvBlock(128, 128, drop_rate=drop_rates[3]),
        )

        self.stage3 = nn.Sequential(
            ResidualConvBlock(128, 256, stride=2, drop_rate=drop_rates[4]),
            ResidualConvBlock(256, 256, drop_rate=drop_rates[5]),
            ResidualConvBlock(256, 256, drop_rate=drop_rates[6]),
        )

        self.stage4 = nn.Sequential(
            ResidualConvBlock(256, 512, stride=2, drop_rate=drop_rates[7]),
            ResidualConvBlock(512, 512, drop_rate=drop_rates[8]),
            ResidualConvBlock(512, 512, drop_rate=drop_rates[9]),
        )

        self.gap = nn.AdaptiveAvgPool2d(1)

        self.classifier = nn.Sequential(
            nn.Dropout(config.DROPOUT_RATE),
            nn.Linear(512, 256),
            nn.ReLU(inplace=True),
            nn.BatchNorm1d(256),
            nn.Dropout(config.DROPOUT_RATE * 0.5),
            nn.Linear(256, num_classes),
        )

        self._initialize_weights()

    def forward(self, x):
        x = self.stem(x)
        x = self.stage1(x)
        x = self.stage2(x)
        x = self.stage3(x)
        x = self.stage4(x)
        x = self.gap(x)
        x = x.view(x.size(0), -1)
        x = self.classifier(x)
        return x

    def _initialize_weights(self):
        for m in self.modules():
            if isinstance(m, nn.Conv2d):
                nn.init.kaiming_normal_(m.weight, mode="fan_out", nonlinearity="relu")
            elif isinstance(m, (nn.BatchNorm2d, nn.BatchNorm1d)):
                nn.init.constant_(m.weight, 1)
                nn.init.constant_(m.bias, 0)
            elif isinstance(m, nn.Linear):
                nn.init.kaiming_normal_(m.weight, mode="fan_out", nonlinearity="relu")
                if m.bias is not None:
                    nn.init.constant_(m.bias, 0)

    def get_feature_vector(self, x):
        x = self.stem(x)
        x = self.stage1(x)
        x = self.stage2(x)
        x = self.stage3(x)
        x = self.stage4(x)
        x = self.gap(x)
        x = x.view(x.size(0), -1)
        return x


# ══════════════════════════════════════════
# 비교 실험용: ResNet18 백본
# ══════════════════════════════════════════
class FoodScouterResNet(nn.Module):
    def __init__(self, num_classes=config.NUM_CLASSES, pretrained=True):
        super().__init__()
        from torchvision import models

        self.backbone = models.resnet18(
            weights=models.ResNet18_Weights.DEFAULT if pretrained else None
        )

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
    if use_pretrained:
        print(f"  모델: ResNet18 (전이학습), 클래스 수: {num_classes}")
        model = FoodScouterResNet(num_classes=num_classes, pretrained=True)
    else:
        print(f"  모델: FoodScouterCNN v2 (Residual + CBAM), 클래스 수: {num_classes}")
        model = FoodScouterCNN(num_classes=num_classes)

    total_params = sum(p.numel() for p in model.parameters())
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"  전체 파라미터: {total_params:,}")
    print(f"  학습 파라미터: {trainable_params:,}")

    return model.to(config.DEVICE)


if __name__ == "__main__":
    model = create_model(num_classes=150)
    dummy = torch.randn(1, 3, config.IMG_SIZE, config.IMG_SIZE).to(config.DEVICE)
    output = model(dummy)
    print(f"\n  입력: {dummy.shape}")
    print(f"  출력: {output.shape}")
