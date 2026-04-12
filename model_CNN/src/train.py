"""
Food Scouter CNN v1 (튜닝) 학습 스크립트
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


def mixup_data(x, y, alpha=0.2):
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
    return lam * criterion(pred, y_a) + (1 - lam) * criterion(pred, y_b)


def train_one_epoch(model, loader, criterion, optimizer, device, use_mixup=True):
    model.train()
    running_loss = 0.0
    correct = 0
    total = 0

    pbar = tqdm(loader, desc="  Train", leave=False)
    for images, labels in pbar:
        images, labels = images.to(device), labels.to(device)

        if use_mixup:
            images, labels_a, labels_b, lam = mixup_data(images, labels)
            outputs = model(images)
            loss = mixup_criterion(criterion, outputs, labels_a, labels_b, lam)
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

    # CosineAnnealingLR 고정 사용
    scheduler = optim.lr_scheduler.CosineAnnealingLR(
        optimizer, T_max=args.epochs, eta_min=config.LR_MIN
    )

    writer = SummaryWriter(config.TENSORBOARD_LOG_DIR)
    early_stopping = EarlyStopping()

    history = {
        "train_loss": [], "train_acc": [],
        "val_loss": [], "val_acc": [],
        "lr": [], "best_val_acc": 0, "best_epoch": 0,
        "model_version": "v1_tuned",
    }

    best_val_acc = 0
    start_time = time.time()

    print(f"\n{'='*60}")
    print(f"  v1 (튜닝) 학습 시작 - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}\n")

    for epoch in range(1, args.epochs + 1):
        print(f"  Epoch [{epoch}/{args.epochs}]  lr={optimizer.param_groups[0]['lr']:.6f}")

        train_loss, train_acc = train_one_epoch(
            model, train_loader, criterion, optimizer, config.DEVICE,
            use_mixup=(epoch > 5),
        )

        val_loss, val_acc = validate(model, val_loader, criterion, config.DEVICE)

        scheduler.step()

        current_lr = optimizer.param_groups[0]["lr"]
        history["train_loss"].append(train_loss)
        history["train_acc"].append(train_acc)
        history["val_loss"].append(val_loss)
        history["val_acc"].append(val_acc)
        history["lr"].append(current_lr)

        writer.add_scalars("Loss", {"train": train_loss, "val": val_loss}, epoch)
        writer.add_scalars("Accuracy", {"train": train_acc, "val": val_acc}, epoch)
        writer.add_scalar("Learning Rate", current_lr, epoch)

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
                "model_version": "v1_tuned",
            }, save_path)
            print(f"    ✅ 최고 모델 저장! (Acc: {val_acc:.2f}%)")

        if epoch % config.SAVE_EVERY_N_EPOCHS == 0:
            ckpt_path = os.path.join(config.WEIGHTS_DIR, f"checkpoint_epoch_{epoch}.pth")
            torch.save({
                "epoch": epoch,
                "model_state_dict": model.state_dict(),
                "optimizer_state_dict": optimizer.state_dict(),
                "val_acc": val_acc,
                "model_version": "v1_tuned",
            }, ckpt_path)

        early_stopping(val_loss)
        if early_stopping.should_stop:
            break

        print()

    elapsed = time.time() - start_time
    writer.close()

    print(f"\n{'='*60}")
    print(f"  v1 (튜닝) 학습 완료!")
    print(f"{'='*60}")
    print(f"  소요 시간: {elapsed/60:.1f}분")
    print(f"  최고 Val Acc: {best_val_acc:.2f}% (Epoch {history['best_epoch']})")
    print(f"  모델 저장: {os.path.join(config.WEIGHTS_DIR, config.MODEL_FILENAME)}")

    history_path = os.path.join(config.RESULTS_DIR, "training_history_v1_tuned.json")
    with open(history_path, "w") as f:
        json.dump(history, f, indent=2)

    print(f"\n  TensorBoard: tensorboard --logdir={config.TENSORBOARD_LOG_DIR}")

    return model, history


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Food Scouter CNN v1 Tuned Training")
    parser.add_argument("--epochs", type=int, default=config.NUM_EPOCHS)
    parser.add_argument("--batch_size", type=int, default=config.BATCH_SIZE)
    parser.add_argument("--lr", type=float, default=config.LEARNING_RATE)
    parser.add_argument("--pretrained", action="store_true")
    args = parser.parse_args()

    config.BATCH_SIZE = args.batch_size
    train(args)