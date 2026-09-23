"""
CivicPulse AI Component 2 — Research-Grade Baseline Evaluation
Evaluates the existing MultimodalDuplicateEngine as-is on the ground-truth evaluation dataset (500 pairs).
Computes exact empirical Accuracy, Precision, Recall, F1, FPR, FNR, False Merge Rate, and Confusion Matrix.
Stores outputs in evaluation/baseline_results.csv, evaluation/metrics.json, evaluation/confusion_matrix.csv.
"""

import os
import sys
import csv
import json

sys.path.insert(0, os.path.dirname(__file__))
from duplicate_engine import MultimodalDuplicateEngine

EVAL_DIR = os.path.join(os.path.dirname(__file__), "evaluation")
GROUND_TRUTH_CSV = os.path.join(EVAL_DIR, "ground_truth.csv")
BASELINE_RESULTS_CSV = os.path.join(EVAL_DIR, "baseline_results.csv")
METRICS_JSON = os.path.join(EVAL_DIR, "metrics.json")
CONFUSION_MATRIX_CSV = os.path.join(EVAL_DIR, "confusion_matrix.csv")

def calculate_metrics(results):
    tp = sum(1 for r in results if r["ground_truth"] == 1 and r["predicted_duplicate"] == 1)
    tn = sum(1 for r in results if r["ground_truth"] == 0 and r["predicted_duplicate"] == 0)
    fp = sum(1 for r in results if r["ground_truth"] == 0 and r["predicted_duplicate"] == 1)
    fn = sum(1 for r in results if r["ground_truth"] == 1 and r["predicted_duplicate"] == 0)

    total = len(results)
    acc = (tp + tn) / float(total) if total > 0 else 0.0
    prec = tp / float(tp + fp) if (tp + fp) > 0 else 0.0
    rec = tp / float(tp + fn) if (tp + fn) > 0 else 0.0
    f1 = (2 * prec * rec) / (prec + rec) if (prec + rec) > 0 else 0.0

    fpr = fp / float(fp + tn) if (fp + tn) > 0 else 0.0
    fnr = fn / float(fn + tp) if (fn + tp) > 0 else 0.0

    # False Merge Rate: Percentage of predicted duplicates that were incorrect false merges
    false_merge_rate = fp / float(tp + fp) if (tp + fp) > 0 else 0.0

    return {
        "count": total,
        "true_positives": tp,
        "true_negatives": tn,
        "false_positives": fp,
        "false_negatives": fn,
        "accuracy": round(acc, 4),
        "precision": round(prec, 4),
        "recall": round(rec, 4),
        "f1_score": round(f1, 4),
        "false_positive_rate": round(fpr, 4),
        "false_negative_rate": round(fnr, 4),
        "false_merge_rate": round(false_merge_rate, 4),
    }

def run_evaluation():
    if not os.path.exists(GROUND_TRUTH_CSV):
        raise FileNotFoundError(f"{GROUND_TRUTH_CSV} not found. Run build_ground_truth.py first.")

    engine = MultimodalDuplicateEngine()
    print(f"[Baseline Evaluation] Evaluating MultimodalDuplicateEngine configuration:")
    print(f"  - Weights: {engine.config['weights']}")
    print(f"  - High Confidence Threshold: {engine.config['high_confidence_threshold']}")
    print(f"  - Medium Confidence Threshold: {engine.config['medium_confidence_threshold']}")

    rows = []
    with open(GROUND_TRUTH_CSV, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            rows.append(r)

    eval_results = []
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

        res = engine.evaluate_pair(c1, c2)
        gt = int(r["ground_truth"])
        pred = 1 if res["isDuplicate"] else 0

        eval_results.append({
            "pair_id": r["pair_id"],
            "split": r["split"],
            "scenario": r["scenario"],
            "ground_truth": gt,
            "text_similarity": res["textSimilarity"],
            "location_similarity": res["locationSimilarity"],
            "image_similarity": res["imageSimilarity"],
            "fused_score": res["fusedScore"],
            "decision": res["decision"],
            "predicted_duplicate": pred
        })

    # Save detailed pair baseline results to CSV
    fieldnames = [
        "pair_id", "split", "scenario", "ground_truth", "text_similarity",
        "location_similarity", "image_similarity", "fused_score", "decision", "predicted_duplicate"
    ]
    with open(BASELINE_RESULTS_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for res in eval_results:
            writer.writerow(res)

    dev_results = [r for r in eval_results if r["split"] == "DEV"]
    test_results = [r for r in eval_results if r["split"] == "TEST"]
    all_results = eval_results

    dev_metrics = calculate_metrics(dev_results)
    test_metrics = calculate_metrics(test_results)
    overall_metrics = calculate_metrics(all_results)

    final_metrics_payload = {
        "baseline_configuration": engine.config,
        "dev_split_metrics": dev_metrics,
        "test_split_metrics": test_metrics,
        "overall_metrics": overall_metrics
    }

    with open(METRICS_JSON, "w", encoding="utf-8") as f:
        json.dump(final_metrics_payload, f, indent=2)

    # Save confusion matrix CSV
    with open(CONFUSION_MATRIX_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["Split", "TP", "TN", "FP", "FN", "Accuracy", "Precision", "Recall", "F1", "False_Merge_Rate"])
        writer.writerow(["DEV", dev_metrics["true_positives"], dev_metrics["true_negatives"], dev_metrics["false_positives"], dev_metrics["false_negatives"], dev_metrics["accuracy"], dev_metrics["precision"], dev_metrics["recall"], dev_metrics["f1_score"], dev_metrics["false_merge_rate"]])
        writer.writerow(["TEST", test_metrics["true_positives"], test_metrics["true_negatives"], test_metrics["false_positives"], test_metrics["false_negatives"], test_metrics["accuracy"], test_metrics["precision"], test_metrics["recall"], test_metrics["f1_score"], test_metrics["false_merge_rate"]])
        writer.writerow(["OVERALL", overall_metrics["true_positives"], overall_metrics["true_negatives"], overall_metrics["false_positives"], overall_metrics["false_negatives"], overall_metrics["accuracy"], overall_metrics["precision"], overall_metrics["recall"], overall_metrics["f1_score"], overall_metrics["false_merge_rate"]])

    print(f"\n[Baseline Results Summary]")
    print(f"--- DEV SPLIT (250 Pairs) ---")
    print(f"  Accuracy : {dev_metrics['accuracy'] * 100:.2f}%")
    print(f"  Precision: {dev_metrics['precision'] * 100:.2f}%")
    print(f"  Recall   : {dev_metrics['recall'] * 100:.2f}%")
    print(f"  F1-Score : {dev_metrics['f1_score'] * 100:.2f}%")
    print(f"  False Merge Rate: {dev_metrics['false_merge_rate'] * 100:.2f}%")
    print(f"  Confusion Matrix: TP={dev_metrics['true_positives']}, TN={dev_metrics['true_negatives']}, FP={dev_metrics['false_positives']}, FN={dev_metrics['false_negatives']}")

    print(f"\n--- HELD-OUT TEST SPLIT (250 Pairs) ---")
    print(f"  Accuracy : {test_metrics['accuracy'] * 100:.2f}%")
    print(f"  Precision: {test_metrics['precision'] * 100:.2f}%")
    print(f"  Recall   : {test_metrics['recall'] * 100:.2f}%")
    print(f"  F1-Score : {test_metrics['f1_score'] * 100:.2f}%")
    print(f"  False Merge Rate: {test_metrics['false_merge_rate'] * 100:.2f}%")
    print(f"  Confusion Matrix: TP={test_metrics['true_positives']}, TN={test_metrics['true_negatives']}, FP={test_metrics['false_positives']}, FN={test_metrics['false_negatives']}")

if __name__ == "__main__":
    run_evaluation()
