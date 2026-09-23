"""
CivicPulse AI Component 2 — Threshold Evaluation & Optimization Engine
Evaluates threshold values (0.50 to 0.90) strictly on the DEV split to optimize F1 while keeping False Merge Rate at 0.0%.
Freezes optimal threshold on DEV, then executes a single evaluation on the HELD-OUT TEST split.
"""

import os
import sys
import csv
import json

sys.path.insert(0, os.path.dirname(__file__))
from duplicate_engine import MultimodalDuplicateEngine

EVAL_DIR = os.path.join(os.path.dirname(__file__), "evaluation")
GROUND_TRUTH_CSV = os.path.join(EVAL_DIR, "ground_truth.csv")
THRESHOLD_RESULTS_CSV = os.path.join(EVAL_DIR, "threshold_results.csv")

def evaluate_threshold_on_split(threshold, split_name):
    engine = MultimodalDuplicateEngine(config={
        "location_radius_meters": 100.0,
        "max_location_distance_meters": 1000.0,
        "weights": {"text": 0.30, "location": 0.45, "image": 0.25},
        "weights_no_image": {"text": 0.45, "location": 0.55, "image": 0.0},
        "high_confidence_threshold": threshold,
        "medium_confidence_threshold": 0.50
    })

    rows = []
    with open(GROUND_TRUTH_CSV, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            if r["split"] == split_name:
                rows.append(r)

    preds = []
    for r in rows:
        c1 = {
            "id": r["complaint_a_id"],
            "title": r["title_a"],
            "description": r["desc_a"],
            "categoryId": r["category_a"],
            "departmentId": r["department_a"],
            "lat": float(r["lat_a"]) if r["lat_a"] else None,
            "lng": float(r["lng_a"]) if r["lng_a"] else None,
            "mediaUrls": [r["image_a"]] if r["image_a"] else []
        }
        c2 = {
            "id": r["complaint_b_id"],
            "title": r["title_b"],
            "description": r["desc_b"],
            "categoryId": r["category_b"],
            "departmentId": r["department_b"],
            "lat": float(r["lat_b"]) if r["lat_b"] else None,
            "lng": float(r["lng_b"]) if r["lng_b"] else None,
            "mediaUrls": [r["image_b"]] if r["image_b"] else []
        }

        eval_res = engine.evaluate_pair(c1, c2)
        gt = int(r["ground_truth"])
        p = 1 if eval_res["isDuplicate"] else 0
        preds.append({"gt": gt, "pred": p})

    tp = sum(1 for p in preds if p["gt"] == 1 and p["pred"] == 1)
    tn = sum(1 for p in preds if p["gt"] == 0 and p["pred"] == 0)
    fp = sum(1 for p in preds if p["gt"] == 0 and p["pred"] == 1)
    fn = sum(1 for p in preds if p["gt"] == 1 and p["pred"] == 0)

    total = len(preds)
    acc = (tp + tn) / float(total) if total > 0 else 0.0
    prec = tp / float(tp + fp) if (tp + fp) > 0 else 0.0
    rec = tp / float(tp + fn) if (tp + fn) > 0 else 0.0
    f1 = (2 * prec * rec) / (prec + rec) if (prec + rec) > 0 else 0.0
    false_merge = fp / float(tp + fp) if (tp + fp) > 0 else 0.0

    return {
        "threshold": threshold,
        "split": split_name,
        "tp": tp, "tn": tn, "fp": fp, "fn": fn,
        "accuracy": round(acc, 4),
        "precision": round(prec, 4),
        "recall": round(rec, 4),
        "f1": round(f1, 4),
        "false_merge_rate": round(false_merge, 4)
    }

def run_threshold_analysis():
    candidate_thresholds = [0.50, 0.55, 0.60, 0.65, 0.70, 0.75, 0.80, 0.85, 0.90]

    dev_results = []
    best_dev_f1 = -1.0
    optimal_threshold = 0.75

    for th in candidate_thresholds:
        res = evaluate_threshold_on_split(th, "DEV")
        dev_results.append(res)
        # Choose highest F1 provided false_merge_rate == 0.0 (Safety constraint)
        if res["false_merge_rate"] == 0.0 and res["f1"] > best_dev_f1:
            best_dev_f1 = res["f1"]
            optimal_threshold = th

    # Freeze optimal threshold and evaluate ONCE on HELD-OUT TEST split
    final_test_res = evaluate_threshold_on_split(optimal_threshold, "TEST")

    # Save to CSV
    fieldnames = ["threshold", "split", "tp", "tn", "fp", "fn", "accuracy", "precision", "recall", "f1", "false_merge_rate"]
    with open(THRESHOLD_RESULTS_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in dev_results:
            writer.writerow(r)
        writer.writerow(final_test_res)

    print("\n[DEV Threshold Optimization Analysis]")
    print(f"{'Threshold':<10} | {'Acc':<7} | {'Prec':<7} | {'Rec':<7} | {'F1':<7} | {'False Merge Rate':<16}")
    print("-" * 75)
    for r in dev_results:
        star = " *" if r["threshold"] == optimal_threshold else ""
        print(f"{r['threshold']:<10.2f} | {r['accuracy']*100:6.1f}% | {r['precision']*100:6.1f}% | {r['recall']*100:6.1f}% | {r['f1']*100:6.1f}% | {r['false_merge_rate']*100:14.1f}%{star}")

    print(f"\n[Frozen Optimal Threshold Selected]: {optimal_threshold} (DEV F1: {best_dev_f1 * 100:.2f}%, False Merge Rate: 0.0%)")
    print(f"\n[Final Held-Out TEST Split Evaluation (Frozen Threshold = {optimal_threshold})]:")
    print(f"  Accuracy : {final_test_res['accuracy'] * 100:.2f}%")
    print(f"  Precision: {final_test_res['precision'] * 100:.2f}%")
    print(f"  Recall   : {final_test_res['recall'] * 100:.2f}%")
    print(f"  F1-Score : {final_test_res['f1'] * 100:.2f}%")
    print(f"  False Merge Rate: {final_test_res['false_merge_rate'] * 100:.2f}%")
    print(f"  Confusion Matrix: TP={final_test_res['tp']}, TN={final_test_res['tn']}, FP={final_test_res['fp']}, FN={final_test_res['fn']}")

if __name__ == "__main__":
    run_threshold_analysis()
