"""
Food Scouter - Faster R-CNN 학습 스크립트

사용법:
  python model/train.py
"""

import os
import sys
import json
import time

import torch
from torch.utils.data import DataLoader
from torch.utils.tensorboard import SummaryWriter
from torch.amp import GradScaler, autocast

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import config
from model import create_model
from dataset import AIHubFoodDataset, get_transforms, collate_fn, load_class_map


def train_one_epoch(model, optimizer, scaler, data_loader, device, epoch):
    model.train()
    total_loss = 0.0
    n_batches  = len(data_loader)

    for i, (images, targets) in enumerate(data_loader):
        images  = [img.to(device) for img in images]
        targets = [{k: v.to(device) for k, v in t.items()} for t in targets]

        optimizer.zero_grad()

        if config.USE_AMP:
            with autocast('cuda'):
                loss_dict = model(images, targets)
                losses    = sum(loss_dict.values())
            scaler.scale(losses).backward()
            scaler.unscale_(optimizer)
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            scaler.step(optimizer)
            scaler.update()
        else:
            loss_dict = model(images, targets)
            losses    = sum(loss_dict.values())
            losses.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            optimizer.step()

        total_loss += losses.item()

        if (i + 1) % 50 == 0 or (i + 1) == n_batches:
            avg         = total_loss / (i + 1)
            loss_detail = " | ".join(f"{k}: {v.item():.4f}" for k, v in loss_dict.items())
            print(f"  [Epoch {epoch}] {i+1}/{n_batches}  avg_loss: {avg:.4f}  ({loss_detail})")

    return total_loss / n_batches


@torch.no_grad()
def evaluate(model, data_loader, device):
    """검증 손실 계산 (train 모드로 loss만 측정)"""
    model.train()  # Faster R-CNN은 eval 모드에서 loss 미반환
    total_loss = 0.0
    for images, targets in data_loader:
        images  = [img.to(device) for img in images]
        targets = [{k: v.to(device) for k, v in t.items()} for t in targets]
        loss_dict = model(images, targets)
        total_loss += sum(loss_dict.values()).item()
    model.eval()
    return total_loss / len(data_loader)


def main():
    config.print_config()

    # ── 클래스 맵 로드 ──
    class_map, idx_to_name = load_class_map(config.CLASSES_JSON)
    print(f"\n  클래스 수: {len(class_map)}개")

    # ── 데이터셋 ──
    print("\n[데이터셋 준비]")
    train_dataset = AIHubFoodDataset(
        img_root   = config.TRAIN_IMG_DIR,
        label_root = config.TRAIN_LABEL_DIR,
        class_map  = class_map,
        transforms = get_transforms(train=True),
    )

    # 검증 이미지도 학습에 포함 (데이터 2배 효과)
    val_as_train_dataset = AIHubFoodDataset(
        img_root   = config.VAL_IMG_DIR,
        label_root = config.VAL_LABEL_DIR,
        class_map  = class_map,
        transforms = get_transforms(train=True),
    )

    from torch.utils.data import ConcatDataset
    combined_train = ConcatDataset([train_dataset, val_as_train_dataset])

    # 전체의 10%를 검증으로 분리
    val_size   = int(len(combined_train) * 0.1)
    train_size = len(combined_train) - val_size
    train_split, val_split = torch.utils.data.random_split(
        combined_train, [train_size, val_size],
        generator=torch.Generator().manual_seed(42)
    )

    train_loader = DataLoader(
        train_split,
        batch_size  = config.BATCH_SIZE,
        shuffle     = True,
        num_workers = config.NUM_WORKERS,
        pin_memory  = config.PIN_MEMORY,
        collate_fn  = collate_fn,
    )
    val_loader = DataLoader(
        val_split,
        batch_size  = 2,
        shuffle     = False,
        num_workers = config.NUM_WORKERS,
        pin_memory  = config.PIN_MEMORY,
        collate_fn  = collate_fn,
    )
    print(f"  전체: {len(combined_train)}장 → 훈련: {train_size}장 | 검증: {val_size}장")

    # ── 모델 ──
    print("\n[모델 생성]")
    model = create_model(num_classes=config.NUM_CLASSES)

    # ── 옵티마이저 ──
    params    = [p for p in model.parameters() if p.requires_grad]
    optimizer = torch.optim.SGD(
        params,
        lr           = config.LEARNING_RATE,
        momentum     = config.MOMENTUM,
        weight_decay = config.WEIGHT_DECAY,
    )
    # Warmup(3 epoch) + Cosine Annealing
    warmup_epochs   = 3
    warmup_scheduler = torch.optim.lr_scheduler.LinearLR(
        optimizer, start_factor=0.1, end_factor=1.0, total_iters=warmup_epochs
    )
    cosine_scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(
        optimizer, T_max=config.NUM_EPOCHS - warmup_epochs, eta_min=1e-6
    )
    scheduler = torch.optim.lr_scheduler.SequentialLR(
        optimizer,
        schedulers=[warmup_scheduler, cosine_scheduler],
        milestones=[warmup_epochs]
    )

    # ── AMP Scaler ──
    scaler = GradScaler('cuda', enabled=config.USE_AMP)
    print(f"  AMP(혼합 정밀도): {'활성화' if config.USE_AMP else '비활성화'}")

    # ── TensorBoard ──
    writer = SummaryWriter(config.TENSORBOARD_LOG_DIR)

    # ── 학습 루프 ──
    print("\n[학습 시작]")
    best_val_loss = float("inf")

    for epoch in range(1, config.NUM_EPOCHS + 1):
        t0 = time.time()
        train_loss = train_one_epoch(model, optimizer, scaler, train_loader, config.DEVICE, epoch)
        val_loss   = evaluate(model, val_loader, config.DEVICE)
        scheduler.step()

        elapsed = time.time() - t0
        lr_now  = optimizer.param_groups[0]["lr"]
        print(f"Epoch {epoch:3d}/{config.NUM_EPOCHS} | "
              f"train: {train_loss:.4f} | val: {val_loss:.4f} | "
              f"lr: {lr_now:.6f} | {elapsed:.0f}s")

        writer.add_scalars("Loss", {"train": train_loss, "val": val_loss}, epoch)
        writer.add_scalar("LR", lr_now, epoch)

        # 최적 모델 저장
        if val_loss < best_val_loss:
            best_val_loss = val_loss
            save_path = os.path.join(config.WEIGHTS_DIR, config.MODEL_FILENAME)
            torch.save({
                "epoch":            epoch,
                "model_state_dict": model.state_dict(),
                "optimizer_state_dict": optimizer.state_dict(),
                "val_loss":         val_loss,
                "num_classes":      config.NUM_CLASSES,
                "idx_to_name":      idx_to_name,
            }, save_path)
            print(f"  ★ 최적 모델 저장 (val_loss: {val_loss:.4f})")

        # 체크포인트 저장
        if epoch % config.SAVE_EVERY_N_EPOCHS == 0:
            ckpt_path = os.path.join(config.WEIGHTS_DIR, f"checkpoint_epoch{epoch:03d}.pth")
            torch.save({
                "epoch":            epoch,
                "model_state_dict": model.state_dict(),
                "optimizer_state_dict": optimizer.state_dict(),
                "val_loss":         val_loss,
            }, ckpt_path)

    writer.close()
    print(f"\n학습 완료! 최적 val_loss: {best_val_loss:.4f}")
    print(f"가중치 저장: {os.path.join(config.WEIGHTS_DIR, config.MODEL_FILENAME)}")


if __name__ == "__main__":
    main()
