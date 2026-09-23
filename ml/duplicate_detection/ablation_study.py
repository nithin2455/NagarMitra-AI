"""
CivicPulse AI Component 2 — Multimodal Ablation Study Engine
Evaluates individual vs combined modalities across 7 controlled experiments:
  A. Text Only
  B. Location Only
  C. Image Only
  D. Text + Location
  E. Text + Image
  F. Location + Image
  G. Text + Location + Image (Full Multimodal Fusion)

Saves detailed comparison matrix in evaluation/ablation_results.csv.
"""

import os
import sys
import csv
import json

sys.path.insert(0, os.path.dirname(__file__))
from duplicate_engine import MultimodalDuplicateEngine

EVAL_DIR = os.path.join(os.path.dirname(__file__), "evaluation")
GROUND_TRUTH_CSV = os.path.join(EVAL_DIR, "ground_truth.csv")
ABLATION_RESULTS_CSV = os.path.join(EVAL_DIR, "ablation_results.csv")

def evaluate_with_weights(weights, threshold=0.75):
    if not os.path.exists(GROUND_TRUTH_CSV):
        raise FileNotFoundError(f"{GROUND_TRUTH_CSV} not found.")

    engine = MultimodalDuplicateEngine(config={
        "location_radius_meters": 100.0,
        "max_location_distance_meters": 1000.0,
        "weights": weights,
        "weights_no_image": {
            "text": weights.get("text", 0.5) / (weights.get("text", 0.5) + weights.get("location", 0.5) + 1e-9),
            "location": weights.get("location", 0.5) / (weights.get("text", 0.5) + weights.get("location", 0.5) + 1e-9),
            "image": 0.0
        },
        "high_confidence_threshold": threshold,
        "medium_confidence_threshold": 0.50
    })

    rows = []
    with open(GROUND_TRUTH_CSV, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
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

    fpr = fp / float(fp + tn) if (fp + tn) > 0 else 0.0
    fnr = fn / float(fn + tp) if (fn + tp) > 0 else 0.0
    false_merge = fp / float(tp + fp) if (tp + fp) > 0 else 0.0

    return {
        "tp": tp, "tn": tn, "fp": fp, "fn": fn,
        "accuracy": round(acc, 4),
        "precision": round(prec, 4),
        "recall": round(rec, 4),
        "f1": round(f1, 4),
        "fpr": round(fpr, 4),
        "fnr": round(fnr, 4),
        "false_merge_rate": round(false_merge, 4)
    }

def run_ablation_study():
    experiments = [
        {"id": "EXP_A", "method": "Text Only", "weights": {"text": 1.0, "location": 0.0, "image": 0.0}},
        {"id": "EXP_B", "method": "Location Only", "weights": {"text": 0.0, "location": 1.0, "image": 0.0}},
        {"id": "EXP_C", "method": "Image Only", "weights": {"text": 0.0, "location": 0.0, "image": 1.0}},
        {"id": "EXP_D", "method": "Text + Location", "weights": {"text": 0.45, "location": 0.55, "image": 0.0}},
        {"id": "EXP_E", "method": "Text + Image", "weights": {"text": 0.55, "location": 0.0, "image": 0.45}},
        {"id": "EXP_F", "method": "Location + Image", "weights": {"text": 0.0, "location": 0.60, "image": 0.40}},
        {"id": "EXP_G", "method": "Text + Location + Image (Multimodal Fusion)", "weights": {"text": 0.30, "location": 0.45, "image": 0.25}},
    ]

    ablation_results = []
    for exp in experiments:
        metrics = evaluate_with_weights(exp["weights"])
        row = {
            "experiment_id": exp["id"],
            "method": exp["method"],
            "weights": json.dumps(exp["weights"]),
            "accuracy": metrics["accuracy"],
            "precision": metrics["precision"],
            "recall": metrics["recall"],
            "f1_score": metrics["f1"],
            "fpr": metrics["fpr"],
            "fnr": metrics["fnr"],
            "false_merge_rate": metrics["false_merge_rate"],
            "tp": metrics["tp"], "tn": metrics["tn"], "fp": metrics["fp"], "fn": metrics["fn"]
        }
        ablation_results.append(row)

    # Save to CSV
    fieldnames = [
        "experiment_id", "method", "weights", "accuracy", "precision",
        "recall", "f1_score", "fpr", "fnr", "false_merge_rate", "tp", "tn", "fp", "fn"
    ]
    with open(ABLATION_RESULTS_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for res in ablation_results:
            writer.writerow(res)

    print("\n[Ablation Study Results Summary]")
    print(f"{'Exp ID':<7} | {'Method':<38} | {'Acc':<6} | {'Prec':<6} | {'Rec':<6} | {'F1':<6} | {'False Merge':<11}")
    print("-" * 95)
    for r in ablation_results:
        print(f"{r['experiment_id']:<7} | {r['method']:<38} | {r['accuracy']*100:5.1f}% | {r['precision']*100:5.1f}% | {r['recall']*100:5.1f}% | {r['f1_score']*100:5.1f}% | {r['false_merge_rate']*100:9.1f}%")

if __name__ == "__main__":
    run_ablation_study()
