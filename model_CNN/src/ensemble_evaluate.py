"""
Food Scouter CNN v1+v2 앙상블 테스트셋 평가 스크립트

model_CNN/src/ 안에 이 파일을 놓고 실행하세요:
    python ensemble_evaluate.py --v1 weights/food_scouter_v1.pth --v2 weights/food_scouter_v2.pth
"""

import os
import sys
import json
import argparse
import importlib.util

import numpy as np
import torch
import torch.nn.functional as F
from tqdm import tqdm
from sklearn.metrics import classification_report

_HERE = os.path.dirname(os.path.abspath(__file__))
_V2_DIR = os.path.join(_HERE, "v2_backup")

sys.path.insert(0, _HERE)
import config
from dataset import create_dataloaders
import evaluate as ev  # plot_confusion_matrix / plot_top_bottom_classes / analyze_misclassifications 재사용


def load_model_for_checkpoint(ckpt_path, device):
    """체크포인트의 model_version에 따라 v1(model.py)/v2(v2_backup/model.py) 아키텍처를 골라 로드"""
    ckpt = torch.load(ckpt_path, map_location=device)
    version = ckpt.get("model_version", "v1")
    src_dir = _V2_DIR if version == "v2" else _HERE

    old_config = sys.modules.pop("config", None)
    sys.path.insert(0, src_dir)
    try:
        spec = importlib.util.spec_from_file_location(
            f"food_scouter_cnn_{version}", os.path.join(src_dir, "model.py")
        )
        cnn_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cnn_module)
    finally:
        sys.path.pop(0)
        sys.modules.pop("config", None)
        if old_config is not None:
            sys.modules["config"] = old_config

    num_classes = ckpt.get("num_classes", 150)
    classes = ckpt.get("classes", [])
    model = cnn_module.FoodScouterCNN(num_classes=num_classes)
    model.load_state_dict(ckpt["model_state_dict"])
    model.to(device).eval()
    print(f"  [{version}] {os.path.basename(ckpt_path)} 로드 완료 "
          f"(epoch {ckpt.get('epoch', '?')}, val_acc {ckpt.get('val_acc', '?')})")
    return model, classes


@torch.no_grad()
def evaluate_ensemble(models, test_loader, classes, device):
    all_preds, all_labels = [], []
    for images, labels in tqdm(test_loader, desc="  앙상블 평가 중"):
        images, labels = images.to(device), labels.to(device)
        probs_sum = None
        for model in models:
            probs = F.softmax(model(images), dim=1)
            probs_sum = probs if probs_sum is None else probs_sum + probs
        probs_avg = probs_sum / len(models)
        _, predicted = torch.max(probs_avg, 1)
        all_preds.extend(predicted.cpu().numpy())
        all_labels.extend(labels.cpu().numpy())

    all_preds = np.array(all_preds)
    all_labels = np.array(all_labels)
    top1_acc = 100.0 * np.sum(all_preds == all_labels) / len(all_labels)
    report = classification_report(all_labels, all_preds, target_names=classes, output_dict=True)
    print(f"\n  앙상블 Top-1 Accuracy: {top1_acc:.2f}%")
    return all_preds, all_labels, report


def main(args):
    device = config.DEVICE
    model_v1, classes_v1 = load_model_for_checkpoint(args.v1, device)
    model_v2, classes_v2 = load_model_for_checkpoint(args.v2, device)

    if classes_v1 != classes_v2:
        print("  경고: v1/v2 체크포인트의 클래스 순서가 다릅니다. 결과가 부정확할 수 있습니다.")

    _, _, test_loader, _ = create_dataloaders()

    all_preds, all_labels, report = evaluate_ensemble(
        [model_v1, model_v2], test_loader, classes_v1, device
    )

    os.makedirs(config.RESULTS_DIR, exist_ok=True)

    ev.plot_confusion_matrix(
        all_labels, all_preds, classes_v1,
        os.path.join(config.RESULTS_DIR, "confusion_matrix_ensemble.png"),
    )
    ev.plot_top_bottom_classes(
        report, classes_v1,
        os.path.join(config.RESULTS_DIR, "class_performance_ensemble.png"),
    )
    ev.analyze_misclassifications(
        all_preds, all_labels, classes_v1,
        os.path.join(config.RESULTS_DIR, "misclassification_analysis_ensemble.txt"),
    )

    results = {
        "model_version": "ensemble_v1_v2",
        "top1_accuracy": float(100.0 * np.sum(all_preds == all_labels) / len(all_labels)),
        "num_classes": len(classes_v1),
        "test_samples": len(all_labels),
        "per_class": {
            cls: {
                "precision": report[cls]["precision"],
                "recall": report[cls]["recall"],
                "f1": report[cls]["f1-score"],
                "support": report[cls]["support"],
            }
            for cls in classes_v1 if cls in report
        },
    }
    results_path = os.path.join(config.RESULTS_DIR, "evaluation_results_ensemble.json")
    with open(results_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"\n  전체 결과 저장: {results_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Food Scouter CNN v1+v2 Ensemble Evaluation")
    parser.add_argument("--v1", type=str, default=os.path.join(config.WEIGHTS_DIR, "food_scouter_v1.pth"))
    parser.add_argument("--v2", type=str, default=os.path.join(config.WEIGHTS_DIR, "food_scouter_v2.pth"))
    args = parser.parse_args()
    main(args)
