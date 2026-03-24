"""
Food Scouter CNN 학습 스크립트

사용법:
  python src/train.py
  python src/train.py --epochs 50 --batch_size 64 --lr 0.0005

학습 결과:
  - weights/food_scouter_v1.pth  (최고 성능 모델)
  - weights/checkpoint_epoch_N.pth (주기적 체크포인트)
  - results/training_history.json (학습 기록)
  - results/tensorboard/ (TensorBoard 로그)
"""

import os
import sys
import json
import time
import argparse
import numpy as np
from datetime import datetime

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.tensorboard import SummaryWriter
from tqdm import tqdm

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import config
from model import create_model
from dataset import create_dataloaders


# ══════════════════════════════════════════
# Early Stopping
# ══════════════════════════════════════════
class EarlyStopping:
    """검증 손실이 개선되지 않으면 학습 조기 종료"""

    def __init__(self, patience=config.PATIENCE, min_delta=config.MIN_DELTA):
        self.patience = patience
        self.min_delta = min_delta
        self.counter = 0
        self.best_loss = None
        self.should_stop = False

    def __call__(self, val_loss):
        if self.best_loss is None:
            self.best_loss = val_loss
        elif val_loss > self.best_loss - self.min_delta:
            self.counter += 1
            if self.counter >= self.patience:
                self.should_stop = True
                print(f"\n  ⏹️  Early Stopping! {self.patience} 에포크 동안 개선 없음")
        else:
            self.best_loss = val_loss
            self.counter = 0


# ══════════════════════════════════════════
# Label Smoothing Loss
# ══════════════════════════════════════════
class LabelSmoothingLoss(nn.Module):
    """
    라벨 스무딩: 과적합 방지 + 일반화 성능 향상
    hard label [0,0,1,0] → soft label [0.01, 0.01, 0.97, 0.01]
    """

    def __init__(self, num_classes, smoothing=0.1):
        super().__init__()
        self.smoothing = smoothing
        self.num_classes = num_classes
        self.confidence = 1.0 - smoothing

    def forward(self, pred, target):
        pred = pred.log_softmax(dim=-1)
        true_dist = torch.zeros_like(pred)
        true_dist.fill_(self.smoothing / (self.num_classes - 1))
        true_dist.scatter_(1, target.unsqueeze(1), self.confidence)
        return torch.mean(torch.sum(-true_dist * pred, dim=-1))


# ══════════════════════════════════════════
# Mixup 데이터 증강
# ══════════════════════════════════════════
def mixup_data(x, y, alpha=0.2):
    """
    Mixup: 두 이미지를 섞어 새로운 학습 데이터 생성
    일반화 성능 향상에 효과적
    """
    if alpha > 0:
        lam = np.random.beta(alpha, alpha)
    else:
        lam = 1

    batch_size = x.size(0)
    index = torch.randperm(batch_size).to(x.device)

    mixed_x = lam * x + (1 - lam) * x[index]
    y_a, y_b = y, y[index]
    return mixed_x, y_a, y_b, lam


def mixup_criterion(criterion, pred, y_a, y_b, lam):
    """Mixup 손실 함수"""
    return lam * criterion(pred, y_a) + (1 - lam) * criterion(pred, y_b)


# ══════════════════════════════════════════
# 학습 1 에포크
# ══════════════════════════════════════════
def train_one_epoch(model, loader, criterion, optimizer, device, use_mixup=True):
    model.train()
    running_loss = 0.0
    correct = 0
    total = 0

    pbar = tqdm(loader, desc="  Train", leave=False)
    for images, labels in pbar:
        images, labels = images.to(device), labels.to(device)

        # Mixup 적용
        if use_mixup:
            images, labels_a, labels_b, lam = mixup_data(images, labels)
            outputs = model(images)
            loss = mixup_criterion(criterion, outputs, labels_a, labels_b, lam)
            # 정확도는 원본 라벨 기준
            _, predicted = torch.max(outputs, 1)
            correct += (lam * predicted.eq(labels_a).sum().item()
                       + (1 - lam) * predicted.eq(labels_b).sum().item())
        else:
            outputs = model(images)
            loss = criterion(outputs, labels)
            _, predicted = torch.max(outputs, 1)
            correct += predicted.eq(labels).sum().item()

        total += labels.size(0)

        optimizer.zero_grad()
        loss.backward()

        # Gradient Clipping (학습 안정화)
        torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=5.0)

        optimizer.step()

        running_loss += loss.item() * images.size(0)
        pbar.set_postfix(loss=f"{loss.item():.4f}", acc=f"{100.*correct/total:.1f}%")

    epoch_loss = running_loss / total
    epoch_acc = 100.0 * correct / total
    return epoch_loss, epoch_acc


# ══════════════════════════════════════════
# 검증 1 에포크
# ══════════════════════════════════════════
@torch.no_grad()
def validate(model, loader, criterion, device):
    model.eval()
    running_loss = 0.0
    correct = 0
    total = 0

    for images, labels in tqdm(loader, desc="  Valid", leave=False):
        images, labels = images.to(device), labels.to(device)
        outputs = model(images)
        loss = criterion(outputs, labels)

        running_loss += loss.item() * images.size(0)
        _, predicted = torch.max(outputs, 1)
        correct += predicted.eq(labels).sum().item()
        total += labels.size(0)

    epoch_loss = running_loss / total
    epoch_acc = 100.0 * correct / total
    return epoch_loss, epoch_acc


# ══════════════════════════════════════════
# 메인 학습 함수
# ══════════════════════════════════════════
def train(args):
    config.print_config()

    # 재현성을 위한 시드 고정
    torch.manual_seed(42)
    np.random.seed(42)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(42)

    # 데이터 로더
    train_loader, val_loader, test_loader, classes = create_dataloaders()
    num_classes = len(classes)

    # 모델
    model = create_model(
        num_classes=num_classes,
        use_pretrained=args.pretrained,
    )

    # 손실함수 (Label Smoothing)
    criterion = LabelSmoothingLoss(num_classes=num_classes, smoothing=0.1)

    # 옵티마이저 (AdamW)
    optimizer = optim.AdamW(
        model.parameters(),
        lr=args.lr,
        weight_decay=config.WEIGHT_DECAY,
    )

    # 학습률 스케줄러
    if config.LR_SCHEDULER == "cosine":
        scheduler = optim.lr_scheduler.CosineAnnealingLR(
            optimizer, T_max=args.epochs, eta_min=config.LR_MIN
        )
    elif config.LR_SCHEDULER == "step":
        scheduler = optim.lr_scheduler.StepLR(
            optimizer, step_size=config.LR_STEP_SIZE, gamma=config.LR_GAMMA
        )
    else:
        scheduler = optim.lr_scheduler.ReduceLROnPlateau(
            optimizer, mode="min", patience=5, factor=0.5
        )

    # TensorBoard
    writer = SummaryWriter(config.TENSORBOARD_LOG_DIR)

    # Early Stopping
    early_stopping = EarlyStopping()

    # 학습 기록
    history = {
        "train_loss": [], "train_acc": [],
        "val_loss": [], "val_acc": [],
        "lr": [], "best_val_acc": 0, "best_epoch": 0,
    }

    best_val_acc = 0
    start_time = time.time()

    print(f"\n{'='*60}")
    print(f"  학습 시작 - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}\n")

    for epoch in range(1, args.epochs + 1):
        print(f"  Epoch [{epoch}/{args.epochs}]  lr={optimizer.param_groups[0]['lr']:.6f}")

        # Train
        train_loss, train_acc = train_one_epoch(
            model, train_loader, criterion, optimizer, config.DEVICE,
            use_mixup=(epoch > 5),  # 처음 5 에포크는 Mixup 없이
        )

        # Validate
        val_loss, val_acc = validate(model, val_loader, criterion, config.DEVICE)

        # 스케줄러 업데이트
        if config.LR_SCHEDULER == "plateau":
            scheduler.step(val_loss)
        else:
            scheduler.step()

        # 기록
        current_lr = optimizer.param_groups[0]["lr"]
        history["train_loss"].append(train_loss)
        history["train_acc"].append(train_acc)
        history["val_loss"].append(val_loss)
        history["val_acc"].append(val_acc)
        history["lr"].append(current_lr)

        # TensorBoard 기록
        writer.add_scalars("Loss", {"train": train_loss, "val": val_loss}, epoch)
        writer.add_scalars("Accuracy", {"train": train_acc, "val": val_acc}, epoch)
        writer.add_scalar("Learning Rate", current_lr, epoch)

        # 출력
        print(f"    Train Loss: {train_loss:.4f}  Acc: {train_acc:.2f}%")
        print(f"    Val   Loss: {val_loss:.4f}  Acc: {val_acc:.2f}%")

        # 최고 성능 모델 저장
        if val_acc > best_val_acc:
            best_val_acc = val_acc
            history["best_val_acc"] = best_val_acc
            history["best_epoch"] = epoch

            save_path = os.path.join(config.WEIGHTS_DIR, config.MODEL_FILENAME)
            torch.save({
                "epoch": epoch,
                "model_state_dict": model.state_dict(),
                "optimizer_state_dict": optimizer.state_dict(),
                "val_acc": val_acc,
                "val_loss": val_loss,
                "num_classes": num_classes,
                "classes": classes,
            }, save_path)
            print(f"    ✅ 최고 모델 저장! (Acc: {val_acc:.2f}%)")

        # 주기적 체크포인트
        if epoch % config.SAVE_EVERY_N_EPOCHS == 0:
            ckpt_path = os.path.join(config.WEIGHTS_DIR, f"checkpoint_epoch_{epoch}.pth")
            torch.save({
                "epoch": epoch,
                "model_state_dict": model.state_dict(),
                "optimizer_state_dict": optimizer.state_dict(),
                "val_acc": val_acc,
            }, ckpt_path)

        # Early Stopping 체크
        early_stopping(val_loss)
        if early_stopping.should_stop:
            break

        print()

    # 학습 완료
    elapsed = time.time() - start_time
    writer.close()

    print(f"\n{'='*60}")
    print(f"  학습 완료!")
    print(f"{'='*60}")
    print(f"  소요 시간: {elapsed/60:.1f}분")
    print(f"  최고 Val Acc: {best_val_acc:.2f}% (Epoch {history['best_epoch']})")
    print(f"  모델 저장: {os.path.join(config.WEIGHTS_DIR, config.MODEL_FILENAME)}")

    # 학습 기록 저장
    history_path = os.path.join(config.RESULTS_DIR, "training_history.json")
    with open(history_path, "w") as f:
        json.dump(history, f, indent=2)
    print(f"  학습 기록: {history_path}")

    # TensorBoard 안내
    print(f"\n  📊 TensorBoard 실행:")
    print(f"     tensorboard --logdir={config.TENSORBOARD_LOG_DIR}")

    return model, history


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Food Scouter CNN Training")
    parser.add_argument("--epochs", type=int, default=config.NUM_EPOCHS)
    parser.add_argument("--batch_size", type=int, default=config.BATCH_SIZE)
    parser.add_argument("--lr", type=float, default=config.LEARNING_RATE)
    parser.add_argument("--pretrained", action="store_true", help="ResNet18 백본 사용")
    args = parser.parse_args()

    # batch_size 반영
    config.BATCH_SIZE = args.batch_size

    train(args)
