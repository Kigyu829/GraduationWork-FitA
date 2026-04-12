"""
Food Scouter CNN v2 학습 스크립트

v1 대비 개선:
  - CutMix (Mixup보다 효과적)
  - Cosine Annealing Warm Restart
  - FoodScouterCNN v2 (Residual + CBAM)
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


class EarlyStopping:
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
                print(f"\n  Early Stopping! {self.patience} 에포크 동안 개선 없음")
        else:
            self.best_loss = val_loss
            self.counter = 0


class LabelSmoothingLoss(nn.Module):
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


def cutmix_data(x, y, alpha=1.0):
    """CutMix: 이미지 일부를 잘라 다른 이미지로 대체"""
    lam = np.random.beta(alpha, alpha)
    batch_size = x.size(0)
    index = torch.randperm(batch_size).to(x.device)

    _, _, H, W = x.size()
    cut_ratio = np.sqrt(1. - lam)
    cut_h = int(H * cut_ratio)
    cut_w = int(W * cut_ratio)

    cx = np.random.randint(W)
    cy = np.random.randint(H)

    x1 = np.clip(cx - cut_w // 2, 0, W)
    y1 = np.clip(cy - cut_h // 2, 0, H)
    x2 = np.clip(cx + cut_w // 2, 0, W)
    y2 = np.clip(cy + cut_h // 2, 0, H)

    x_mixed = x.clone()
    x_mixed[:, :, y1:y2, x1:x2] = x[index, :, y1:y2, x1:x2]

    lam = 1 - ((x2 - x1) * (y2 - y1) / (H * W))
    return x_mixed, y, y[index], lam


def train_one_epoch(model, loader, criterion, optimizer, device, epoch, use_cutmix=True):
    model.train()
    running_loss = 0.0
    correct = 0
    total = 0

    pbar = tqdm(loader, desc="  Train", leave=False)
    for images, labels in pbar:
        images, labels = images.to(device), labels.to(device)

        if use_cutmix and epoch > 10 and np.random.random() < 0.5:
            images, labels_a, labels_b, lam = cutmix_data(images, labels)
            outputs = model(images)
            loss = lam * criterion(outputs, labels_a) + (1 - lam) * criterion(outputs, labels_b)
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
        torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=5.0)
        optimizer.step()

        running_loss += loss.item() * images.size(0)
        pbar.set_postfix(loss=f"{loss.item():.4f}", acc=f"{100.*correct/total:.1f}%")

    return running_loss / total, 100.0 * correct / total


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

    return running_loss / total, 100.0 * correct / total


def train(args):
    config.print_config()

    torch.manual_seed(42)
    np.random.seed(42)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(42)

    train_loader, val_loader, test_loader, classes = create_dataloaders()
    num_classes = len(classes)

    model = create_model(num_classes=num_classes, use_pretrained=args.pretrained)

    criterion = LabelSmoothingLoss(num_classes=num_classes, smoothing=0.1)

    optimizer = optim.AdamW(
        model.parameters(),
        lr=args.lr,
        weight_decay=config.WEIGHT_DECAY,
    )

    # v2: Cosine Annealing Warm Restart
    scheduler = optim.lr_scheduler.CosineAnnealingWarmRestarts(
        optimizer,
        T_0=20,
        T_mult=2,
        eta_min=config.LR_MIN,
    )

    writer = SummaryWriter(config.TENSORBOARD_LOG_DIR)
    early_stopping = EarlyStopping()

    history = {
        "train_loss": [], "train_acc": [],
        "val_loss": [], "val_acc": [],
        "lr": [], "best_val_acc": 0, "best_epoch": 0,
        "model_version": "v2",
    }

    best_val_acc = 0
    start_time = time.time()

    print(f"\n{'='*60}")
    print(f"  v2 학습 시작 - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}\n")

    for epoch in range(1, args.epochs + 1):
        lr = optimizer.param_groups[0]['lr']
        print(f"  Epoch [{epoch}/{args.epochs}]  lr={lr:.6f}")

        train_loss, train_acc = train_one_epoch(
            model, train_loader, criterion, optimizer, config.DEVICE, epoch
        )

        val_loss, val_acc = validate(model, val_loader, criterion, config.DEVICE)

        scheduler.step()

        history["train_loss"].append(train_loss)
        history["train_acc"].append(train_acc)
        history["val_loss"].append(val_loss)
        history["val_acc"].append(val_acc)
        history["lr"].append(lr)

        writer.add_scalars("Loss", {"train": train_loss, "val": val_loss}, epoch)
        writer.add_scalars("Accuracy", {"train": train_acc, "val": val_acc}, epoch)
        writer.add_scalar("LR", lr, epoch)

        print(f"    Train Loss: {train_loss:.4f}  Acc: {train_acc:.2f}%")
        print(f"    Val   Loss: {val_loss:.4f}  Acc: {val_acc:.2f}%")

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
                "model_version": "v2",
            }, save_path)
            print(f"    ✅ 최고 모델 저장! (Acc: {val_acc:.2f}%)")

        if epoch % config.SAVE_EVERY_N_EPOCHS == 0:
            ckpt_path = os.path.join(config.WEIGHTS_DIR, f"v2_checkpoint_epoch_{epoch}.pth")
            torch.save({
                "epoch": epoch,
                "model_state_dict": model.state_dict(),
                "val_acc": val_acc,
                "model_version": "v2",
            }, ckpt_path)

        early_stopping(val_loss)
        if early_stopping.should_stop:
            break

        print()

    elapsed = time.time() - start_time
    writer.close()

    print(f"\n{'='*60}")
    print(f"  v2 학습 완료!")
    print(f"{'='*60}")
    print(f"  소요 시간: {elapsed/60:.1f}분")
    print(f"  최고 Val Acc: {best_val_acc:.2f}% (Epoch {history['best_epoch']})")
    print(f"  모델 저장: {os.path.join(config.WEIGHTS_DIR, config.MODEL_FILENAME)}")

    history_path = os.path.join(config.RESULTS_DIR, "training_history_v2.json")
    with open(history_path, "w") as f:
        json.dump(history, f, indent=2)

    print(f"\n  TensorBoard: tensorboard --logdir={config.TENSORBOARD_LOG_DIR}")

    return model, history


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Food Scouter CNN v2 Training")
    parser.add_argument("--epochs", type=int, default=config.NUM_EPOCHS)
    parser.add_argument("--batch_size", type=int, default=config.BATCH_SIZE)
    parser.add_argument("--lr", type=float, default=config.LEARNING_RATE)
    parser.add_argument("--pretrained", action="store_true")
    args = parser.parse_args()

    config.BATCH_SIZE = args.batch_size

    train(args)
