"""
evaluate_anomaly.py
Research evaluation script for Component 6 — AI Anomaly & Suspicious Pattern Detection.
Calculates:
1. Operational test set evaluation (N=630)
2. Leakage-controlled baseline comparison (Historical Mean + 3SD, Rolling Z-score, Isolation Forest)
   (Note: Baselines calculate thresholds strictly from training set data to prevent leakage)
3. Controlled Synthetic Anomaly Benchmark Evaluation (N=200, ROC-AUC, PR-AUC, Precision, Recall, F1)
4. Subsampling stability analysis (Jaccard similarity under 80%/90% subsamples)
5. Top-K anomaly review & explainability summary
"""

import os
import json
import pandas as pd
import numpy as np
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, precision_recall_curve, auc, confusion_matrix
)
from anomaly_engine import IsolationForestPredictor, NUMERICAL_COLS

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SPLITS_DIR = os.path.join(BASE_DIR, "data", "splits")
ARTIFACT_DIR = os.path.join(BASE_DIR, "ml", "anomaly_detection", "artifacts")
EVAL_DIR = os.path.join(BASE_DIR, "ml", "anomaly_detection", "evaluation")
os.makedirs(EVAL_DIR, exist_ok=True)

def main():
    train_df = pd.read_csv(os.path.join(SPLITS_DIR, "anomaly_train.csv"))
    val_df = pd.read_csv(os.path.join(SPLITS_DIR, "anomaly_val.csv"))
    test_df = pd.read_csv(os.path.join(SPLITS_DIR, "anomaly_test.csv"))
    synth_df = pd.read_csv(os.path.join(SPLITS_DIR, "anomaly_synthetic_benchmark.csv"))

    predictor = IsolationForestPredictor()
    predictor.load_artifacts(ARTIFACT_DIR)

    # 1. Operational Test Evaluation (Unsupervised N=630)
    test_scores = predictor.predict_anomaly_score(test_df)
    anom_flags = (test_scores >= predictor.threshold_low_medium).astype(int)
    detected_count = int(np.sum(anom_flags))
    anom_rate = float(round(detected_count / len(test_df), 4))

    print("==========================================")
    print("1. OPERATIONAL HELD-OUT TEST EVALUATION (N=630, UNSUPERVISED)")
    print("==========================================")
    print(f"  Test Observations: {len(test_df)}")
    print(f"  Detected Anomalies: {detected_count} ({anom_rate*100:.2f}%)")
    print(f"  Mean Anomaly Score: {np.mean(test_scores):.4f}")
    print(f"  Max Anomaly Score:  {np.max(test_scores):.4f}")
    print(f"  Min Anomaly Score:  {np.min(test_scores):.4f}")

    # 2. Leakage-Controlled Baseline Comparison (Thresholds computed ONLY on train_df)
    train_mean_vol = train_df['raw_report_count'].mean()
    train_std_vol = train_df['raw_report_count'].std()
    
    threshold_3sd = train_mean_vol + 3.0 * train_std_vol

    # Baseline 1: Historical Mean + 3SD
    b1_flags = (test_df['raw_report_count'] >= threshold_3sd).astype(int)
    
    # Baseline 2: Rolling Z-Score >= 3.0
    test_z = (test_df['raw_report_count'] - train_mean_vol) / (train_std_vol + 1e-5)
    b2_flags = (test_z >= 3.0).astype(int)

    # Baseline 3: Isolation Forest (Ours)
    b3_flags = anom_flags

    baseline_comp = [
        {"Method": "Historical Mean + 3SD Spike Detector", "Threshold Source": "Train Set Mean+3SD", "Detected Anomalies": int(np.sum(b1_flags)), "Detection Rate": f"{(np.sum(b1_flags)/len(test_df))*100:.2f}%"},
        {"Method": "Rolling Z-Score (Z >= 3.0)", "Threshold Source": "Train Set StdDev", "Detected Anomalies": int(np.sum(b2_flags)), "Detection Rate": f"{(np.sum(b2_flags)/len(test_df))*100:.2f}%"},
        {"Method": "Isolation Forest (Multimodal Ours)", "Threshold Source": "Contamination 0.05", "Detected Anomalies": int(np.sum(b3_flags)), "Detection Rate": f"{(np.sum(b3_flags)/len(test_df))*100:.2f}%"}
    ]
    print("\n==========================================")
    print("2. LEAKAGE-CONTROLLED BASELINE COMPARISON")
    print("==========================================")
    print(pd.DataFrame(baseline_comp).to_string(index=False))

    # 3. Controlled Synthetic Anomaly Benchmark Evaluation (N=200)
    synth_y = synth_df['synthetic_anomaly_label'].values
    synth_scores = predictor.predict_anomaly_score(synth_df)
    synth_preds = (synth_scores >= predictor.threshold_low_medium).astype(int)

    synth_acc = accuracy_score(synth_y, synth_preds)
    synth_prec = precision_score(synth_y, synth_preds, zero_division=0)
    synth_rec = recall_score(synth_y, synth_preds, zero_division=0)
    synth_f1 = f1_score(synth_y, synth_preds, zero_division=0)
    synth_auc = roc_auc_score(synth_y, synth_scores)
    
    p_pts, r_pts, _ = precision_recall_curve(synth_y, synth_scores)
    synth_pr_auc = auc(r_pts, p_pts)

    print("\n==========================================")
    print("3. CONTROLLED SYNTHETIC ANOMALY BENCHMARK (N=200 EXPLICIT SYNTHETIC TEST)")
    print("==========================================")
    print(f"  Accuracy:         {synth_acc:.4f}")
    print(f"  Precision:        {synth_prec:.4f}")
    print(f"  Recall (Detection): {synth_rec:.4f}")
    print(f"  F1-Score:         {synth_f1:.4f}")
    print(f"  ROC-AUC:          {synth_auc:.4f}")
    print(f"  PR-AUC:           {synth_pr_auc:.4f}")

    # 4. Subsampling Stability Test (Jaccard similarity across 10 random seeds)
    jaccard_80_list = []
    jaccard_90_list = []
    
    base_top_indices = set(np.argsort(test_scores)[::-1][:int(len(test_scores)*0.05)])

    for seed in range(10):
        # 80% subsample
        sub80 = test_df.sample(frac=0.80, random_state=seed+100)
        s80_scores = predictor.predict_anomaly_score(sub80)
        top80_orig_idx = set(sub80.index[np.argsort(s80_scores)[::-1][:int(len(s80_scores)*0.05)]])
        
        # Jaccard index
        inter80 = len(base_top_indices.intersection(top80_orig_idx))
        union80 = len(base_top_indices.union(top80_orig_idx))
        jaccard_80_list.append(inter80 / union80 if union80 > 0 else 1.0)

        # 90% subsample
        sub90 = test_df.sample(frac=0.90, random_state=seed+200)
        s90_scores = predictor.predict_anomaly_score(sub90)
        top90_orig_idx = set(sub90.index[np.argsort(s90_scores)[::-1][:int(len(s90_scores)*0.05)]])
        
        inter90 = len(base_top_indices.intersection(top90_orig_idx))
        union90 = len(base_top_indices.union(top90_orig_idx))
        jaccard_90_list.append(inter90 / union90 if union90 > 0 else 1.0)

    mean_jaccard_80 = float(round(np.mean(jaccard_80_list), 4))
    mean_jaccard_90 = float(round(np.mean(jaccard_90_list), 4))

    print("\n==========================================")
    print("4. SUBSAMPLING STABILITY TEST (10 RANDOM SEEDS)")
    print("==========================================")
    print(f"  Mean Jaccard Similarity (80% Subsample): {mean_jaccard_80:.4f}")
    print(f"  Mean Jaccard Similarity (90% Subsample): {mean_jaccard_90:.4f}")

    # 5. Top-K Anomaly Review (Top 10 Operational Anomalies)
    top_indices = np.argsort(test_scores)[::-1][:10]
    top_anomalies = []
    for idx in top_indices:
        row_dict = test_df.iloc[idx].to_dict()
        res = predictor.predict_single(row_dict)
        top_anomalies.append({
            "WindowID": row_dict["window_id"],
            "Date": row_dict["date"],
            "Dept": row_dict["department_code"],
            "RawVol": row_dict["raw_report_count"],
            "DupRatio": row_dict["duplicate_ratio"],
            "Hotspot": row_dict["hotspot_score"],
            "Score": res["anomaly_score"],
            "Level": res["anomaly_level"],
            "Pattern": res["anomaly_type"],
            "Indicators": "; ".join(res["contributing_indicators"])
        })
    df_top = pd.DataFrame(top_anomalies)
    print("\n==========================================")
    print("5. TOP-10 OPERATIONAL ANOMALIES REVIEW")
    print("==========================================")
    print(df_top[["WindowID", "Dept", "RawVol", "DupRatio", "Score", "Level", "Pattern"]].to_string(index=False))

    # Export Evaluation Summary JSON
    summary_eval = {
        "operational_test_evaluation": {
            "test_samples": len(test_df),
            "detected_anomalies": detected_count,
            "anomaly_rate": anom_rate,
            "mean_score": round(float(np.mean(test_scores)), 4)
        },
        "baseline_comparison": baseline_comp,
        "controlled_synthetic_benchmark": {
            "accuracy": round(synth_acc, 4),
            "precision": round(synth_prec, 4),
            "recall": round(synth_rec, 4),
            "f1": round(synth_f1, 4),
            "roc_auc": round(synth_auc, 4),
            "pr_auc": round(synth_pr_auc, 4)
        },
        "subsampling_stability": {
            "mean_jaccard_80": mean_jaccard_80,
            "mean_jaccard_90": mean_jaccard_90
        },
        "top_10_anomalies": top_anomalies
    }

    with open(os.path.join(EVAL_DIR, "eval_summary.json"), "w") as f:
        json.dump(summary_eval, f, indent=2)

    print(f"\n[SUCCESS] Component 6 evaluation summary exported to {os.path.join(EVAL_DIR, 'eval_summary.json')}")

if __name__ == "__main__":
    main()
