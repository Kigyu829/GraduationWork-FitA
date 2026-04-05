"""
Food Scouter CNN v1 모델 성능 평가 스크립트
"""

import os
import sys
import json
import argparse
import numpy as np
from collections import defaultdict

import torch
import torch.nn.functional as F
from tqdm import tqdm
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import classification_report, confusion_matrix

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import config
from model import FoodScouterCNN
from dataset import create_dataloaders


@torch.no_grad()
def evaluate(model, test_loader, classes, device):
    model.eval()
    all_preds = []
    all_labels = []
    all_top5_correct = 0
    total = 0

    for images, labels in tqdm(test_loader, desc="  평가 중"):
        images, labels = images.to(device), labels.to(device)
        outputs = model(images)
        _, predicted = torch.max(outputs, 1)

        _, top5_pred = outputs.topk(5, 1, True, True)
        correct_top5 = top5_pred.eq(labels.view(-1, 1).expand_as(top5_pred))
        all_top5_correct += correct_top5.any(dim=1).sum().item()

        all_preds.extend(predicted.cpu().numpy())
        all_labels.extend(labels.cpu().numpy())
        total += labels.size(0)

    all_preds = np.array(all_preds)
    all_labels = np.array(all_labels)

    top1_acc = 100.0 * np.sum(all_preds == all_labels) / total
    top5_acc = 100.0 * all_top5_correct / total

    print(f"\n{'='*60}")
    print(f"  v1 평가 결과")
    print(f"{'='*60}")
    print(f"  Top-1 Accuracy: {top1_acc:.2f}%")
    print(f"  Top-5 Accuracy: {top5_acc:.2f}%")
    print(f"  테스트 샘플 수: {total}")

    report = classification_report(all_labels, all_preds, target_names=classes, output_dict=True)

    class_f1 = [(cls, report[cls]["f1-score"]) for cls in classes if cls in report]
    class_f1.sort(key=lambda x: x[1], reverse=True)

    print("\n  Top-5 잘 분류되는 음식:")
    for cls, f1 in class_f1[:5]:
        print(f"     {cls}: F1={f1:.3f}")

    print("\n  Bottom-5 잘 못 분류되는 음식:")
    for cls, f1 in class_f1[-5:]:
        print(f"     {cls}: F1={f1:.3f}")

    return all_preds, all_labels, report


def plot_confusion_matrix(all_labels, all_preds, classes, save_path):
    cm = confusion_matrix(all_labels, all_preds)

    if len(classes) > 30:
        from collections import Counter
        top_classes_idx = [idx for idx, _ in Counter(all_labels).most_common(30)]
        mask = np.isin(all_labels, top_classes_idx)
        filtered_labels = all_labels[mask]
        filtered_preds = all_preds[mask]

        idx_map = {old: new for new, old in enumerate(sorted(top_classes_idx))}
        remapped_labels = np.array([idx_map[l] for l in filtered_labels])
        remapped_preds = np.array([idx_map.get(p, -1) for p in filtered_preds])
        valid = remapped_preds >= 0
        remapped_labels = remapped_labels[valid]
        remapped_preds = remapped_preds[valid]

        cm = confusion_matrix(remapped_labels, remapped_preds)
        display_classes = [classes[i] for i in sorted(top_classes_idx)]
        title = "Confusion Matrix v1 (Top-30 classes)"
    else:
        display_classes = classes
        title = "Confusion Matrix v1"

    cm_normalized = cm.astype("float") / cm.sum(axis=1)[:, np.newaxis]
    cm_normalized = np.nan_to_num(cm_normalized)

    plt.figure(figsize=(max(12, len(display_classes) * 0.4), max(10, len(display_classes) * 0.35)))
    sns.heatmap(cm_normalized, annot=len(display_classes) <= 20, fmt=".2f" if len(display_classes) <= 20 else "",
                cmap="Blues", xticklabels=display_classes, yticklabels=display_classes, vmin=0, vmax=1)
    plt.title(title, fontsize=14)
    plt.ylabel("True Label", fontsize=12)
    plt.xlabel("Predicted Label", fontsize=12)
    plt.xticks(rotation=45, ha="right", fontsize=8)
    plt.yticks(fontsize=8)
    plt.tight_layout()
    plt.savefig(save_path, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"\n  Confusion Matrix 저장: {save_path}")


def plot_top_bottom_classes(report, classes, save_path):
    class_f1 = [(cls, report[cls]["f1-score"]) for cls in classes if cls in report]
    class_f1.sort(key=lambda x: x[1], reverse=True)

    top10 = class_f1[:10]
    bottom10 = class_f1[-10:]

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6))

    names, scores = zip(*top10)
    ax1.barh(range(len(names)), scores, color="#2ecc71")
    ax1.set_yticks(range(len(names)))
    ax1.set_yticklabels(names, fontsize=10)
    ax1.set_xlim(0, 1)
    ax1.set_title("Top-10 F1-Score (v1)", fontsize=13)
    ax1.invert_yaxis()

    names, scores = zip(*bottom10)
    ax2.barh(range(len(names)), scores, color="#e74c3c")
    ax2.set_yticks(range(len(names)))
    ax2.set_yticklabels(names, fontsize=10)
    ax2.set_xlim(0, 1)
    ax2.set_title("Bottom-10 F1-Score (v1)", fontsize=13)
    ax2.invert_yaxis()

    plt.tight_layout()
    plt.savefig(save_path, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"  클래스별 성능 차트 저장: {save_path}")


def analyze_misclassifications(all_preds, all_labels, classes, save_path):
    misclassified = defaultdict(lambda: defaultdict(int))
    for true, pred in zip(all_labels, all_preds):
        if true != pred:
            misclassified[classes[true]][classes[pred]] += 1

    pairs = []
    for true_cls, preds in misclassified.items():
        for pred_cls, count in preds.items():
            pairs.append((true_cls, pred_cls, count))
    pairs.sort(key=lambda x: x[2], reverse=True)

    with open(save_path, "w", encoding="utf-8") as f:
        f.write("오분류 패턴 분석 v1 (Top-20)\n")
        f.write("=" * 60 + "\n\n")
        for true_cls, pred_cls, count in pairs[:20]:
            f.write(f"  {true_cls} → {pred_cls} : {count}회\n")

    print(f"  오분류 분석 저장: {save_path}")
    print("\n  가장 많이 혼동되는 음식 쌍 (Top-10):")
    for true_cls, pred_cls, count in pairs[:10]:
        print(f"     {true_cls} → {pred_cls} : {count}회")


def main(args):
    print(f"\n  모델 로드: {args.model}")
    checkpoint = torch.load(args.model, map_location=config.DEVICE)

    classes = checkpoint.get("classes", [])
    num_classes = checkpoint.get("num_classes", len(classes))
    version = checkpoint.get("model_version", "v1")

    print(f"  모델 버전: {version}")
    print(f"  클래스 수: {num_classes}")
    print(f"  학습 에포크: {checkpoint.get('epoch', '?')}")
    print(f"  저장 시 Val Acc: {checkpoint.get('val_acc', '?'):.2f}%")

    model = FoodScouterCNN(num_classes=num_classes).to(config.DEVICE)
    model.load_state_dict(checkpoint["model_state_dict"])

    _, _, test_loader, _ = create_dataloaders()

    all_preds, all_labels, report = evaluate(model, test_loader, classes, config.DEVICE)

    os.makedirs(config.RESULTS_DIR, exist_ok=True)

    plot_confusion_matrix(all_labels, all_preds, classes,
        os.path.join(config.RESULTS_DIR, "confusion_matrix_v1.png"))

    plot_top_bottom_classes(report, classes,
        os.path.join(config.RESULTS_DIR, "class_performance_v1.png"))

    analyze_misclassifications(all_preds, all_labels, classes,
        os.path.join(config.RESULTS_DIR, "misclassification_analysis_v1.txt"))

    results = {
        "model_version": version,
        "top1_accuracy": float(100.0 * np.sum(all_preds == all_labels) / len(all_labels)),
        "num_classes": num_classes,
        "test_samples": len(all_labels),
        "per_class": {
            cls: {
                "precision": report[cls]["precision"],
                "recall": report[cls]["recall"],
                "f1": report[cls]["f1-score"],
                "support": report[cls]["support"],
            }
            for cls in classes if cls in report
        },
    }

    results_path = os.path.join(config.RESULTS_DIR, "evaluation_results_v1.json")
    with open(results_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"\n  전체 결과 저장: {results_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Food Scouter CNN v1 Evaluation")
    parser.add_argument("--model", type=str,
        default=os.path.join(config.WEIGHTS_DIR, config.MODEL_FILENAME))
    args = parser.parse_args()
    main(args)
