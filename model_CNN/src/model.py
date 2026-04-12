"""
Food Scouter CNN v1 모델 아키텍처
SE Block(Squeeze-and-Excitation) 적용
"""

import torch
import torch.nn as nn
import torch.nn.functional as F

import sys, os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import config


class SEBlock(nn.Module):
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
        y = self.squeeze(x).view(b, c)
        y = self.excitation(y).view(b, c, 1, 1)
        return x * y.expand_as(x)


class ConvBlock(nn.Module):
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


class FoodScouterCNN(nn.Module):
    def __init__(self, num_classes=config.NUM_CLASSES):
        super(FoodScouterCNN, self).__init__()

        self.features = nn.Sequential(
            ConvBlock(3, 32),
            ConvBlock(32, 64),
            ConvBlock(64, 128),
            ConvBlock(128, 256),
            ConvBlock(256, 512),
        )

        self.gap = nn.AdaptiveAvgPool2d(1)

        self.classifier = nn.Sequential(
            nn.Dropout(config.DROPOUT_RATE),
            nn.Linear(512, 256),
            nn.ReLU(inplace=True),
            nn.Dropout(config.DROPOUT_RATE * 0.6),
            nn.Linear(256, num_classes),
        )

        self._initialize_weights()

    def forward(self, x):
        x = self.features(x)
        x = self.gap(x)
        x = x.view(x.size(0), -1)
        x = self.classifier(x)
        return x

    def _initialize_weights(self):
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
        x = self.features(x)
        x = self.gap(x)
        x = x.view(x.size(0), -1)
        return x


class FoodScouterResNet(nn.Module):
    def __init__(self, num_classes=config.NUM_CLASSES, pretrained=True):
        super(FoodScouterResNet, self).__init__()
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


def create_model(num_classes=config.NUM_CLASSES, use_pretrained=False):
    if use_pretrained:
        print(f"  모델: ResNet18 (전이학습), 클래스 수: {num_classes}")
        model = FoodScouterResNet(num_classes=num_classes, pretrained=True)
    else:
        print(f"  모델: FoodScouterCNN v1 (SE Block), 클래스 수: {num_classes}")
        model = FoodScouterCNN(num_classes=num_classes)

    total_params = sum(p.numel() for p in model.parameters())
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"  전체 파라미터: {total_params:,}")
    print(f"  학습 파라미터: {trainable_params:,}")

    return model.to(config.DEVICE)


if __name__ == "__main__":
    model = create_model(num_classes=150)
    dummy_input = torch.randn(1, 3, config.IMG_SIZE, config.IMG_SIZE).to(config.DEVICE)
    output = model(dummy_input)
    print(f"\n  입력:  {dummy_input.shape}")
    print(f"  출력:  {output.shape}")
