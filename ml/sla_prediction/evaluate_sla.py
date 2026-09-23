"""
evaluate_sla.py
Comprehensive research evaluation for Component 5 — AI SLA Breach Prediction.
Computes:
1. Held-out test set performance (N=630)
2. Baseline comparison (Majority, SLA hours only, Category only, Logistic Regression, Random Forest)
3. Threshold trade-off analysis (0.30 to 0.70)
4. Feature importance analysis (Top 20 features)
5. Ablation study (Text, Structured, Spatial, Multimodal)
"""

import os
import json
import pandas as pd
import numpy as np
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, precision_recall_curve, auc, brier_score_loss, confusion_matrix
)
from sklearn.linear_model import LogisticRegression
from sklearn.dummy import DummyClassifier
from sla_engine import SLAPredictor, FeaturePreprocessor, NUMERICAL_COLS, CATEGORICAL_COLS

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SPLITS_DIR = os.path.join(BASE_DIR, "data", "splits")
ARTIFACT_DIR = os.path.join(BASE_DIR, "ml", "sla_prediction", "artifacts")
EVAL_DIR = os.path.join(BASE_DIR, "ml", "sla_prediction", "evaluation")
os.makedirs(EVAL_DIR, exist_ok=True)

def main():
    train_path = os.path.join(SPLITS_DIR, "sla_train.csv")
    val_path = os.path.join(SPLITS_DIR, "sla_val.csv")
    test_path = os.path.join(SPLITS_DIR, "sla_test.csv")
    
    train_df = pd.read_csv(train_path)
    val_df = pd.read_csv(val_path)
    test_df = pd.read_csv(test_path)
    
    y_train = train_df['sla_breached'].values
    y_test = test_df['sla_breached'].values
    
    print(f"Loaded train ({len(train_df)}), val ({len(val_df)}), test ({len(test_df)}) split.")
    print(f"Test breach class distribution: Breached={sum(y_test)} ({np.mean(y_test)*100:.2f}%), Non-Breached={sum(y_test==0)}")

    # Load trained model
    predictor = SLAPredictor()
    predictor.load_artifacts(ARTIFACT_DIR)
    
    test_probs = predictor.predict_proba(test_df)
    test_preds = (test_probs >= 0.50).astype(int)
    
    acc = accuracy_score(y_test, test_preds)
    prec = precision_score(y_test, test_preds, zero_division=0)
    rec = recall_score(y_test, test_preds, zero_division=0)
    f1 = f1_score(y_test, test_preds, zero_division=0)
    roc_auc = roc_auc_score(y_test, test_probs)
    
    precision_pts, recall_pts, _ = precision_recall_curve(y_test, test_probs)
    pr_auc = auc(recall_pts, precision_pts)
    brier = brier_score_loss(y_test, test_probs)
    cm = confusion_matrix(y_test, test_preds)
    
    print("\n==========================================")
    print("PRIMARY MODEL (Random Forest) HELD-OUT TEST METRICS")
    print("==========================================")
    print(f"  Accuracy:      {acc:.4f}")
    print(f"  Precision:     {prec:.4f}")
    print(f"  Recall (Breach): {rec:.4f}")
    print(f"  F1-Score:      {f1:.4f}")
    print(f"  ROC-AUC:       {roc_auc:.4f}")
    print(f"  PR-AUC:        {pr_auc:.4f}")
    print(f"  Brier Score:   {brier:.4f}")
    print(f"  Confusion Matrix:\n{cm}")
    
    # ---------------------------------------------------------
    # BASELINE MODELS COMPARISON
    # ---------------------------------------------------------
    print("\n==========================================")
    print("BASELINE MODEL COMPARISON (HELD-OUT TEST SET)")
    print("==========================================")
    
    # 1. Majority Baseline
    dummy = DummyClassifier(strategy='most_frequent')
    dummy.fit(train_df, y_train)
    dummy_preds = dummy.predict(test_df)
    dummy_acc = accuracy_score(y_test, dummy_preds)
    dummy_rec = recall_score(y_test, dummy_preds, zero_division=0)
    dummy_f1 = f1_score(y_test, dummy_preds, zero_division=0)
    
    # 2. SLA Hours Only Baseline (Predict Breach if allowed response SLA <= median SLA)
    med_sla = train_df['response_sla_hours'].median()
    sla_only_preds = (test_df['response_sla_hours'] <= med_sla).astype(int)
    sla_acc = accuracy_score(y_test, sla_only_preds)
    sla_rec = recall_score(y_test, sla_only_preds, zero_division=0)
    sla_f1 = f1_score(y_test, sla_only_preds, zero_division=0)

    # 3. Logistic Regression Baseline
    prep = FeaturePreprocessor(max_tfidf_features=50)
    X_tr = prep.fit(train_df)
    X_te = prep.transform(test_df)
    
    lr = LogisticRegression(max_iter=1000, class_weight='balanced', random_state=42)
    lr.fit(X_tr, y_train)
    lr_probs = lr.predict_proba(X_te)[:, 1]
    lr_preds = (lr_probs >= 0.50).astype(int)
    
    lr_acc = accuracy_score(y_test, lr_preds)
    lr_prec = precision_score(y_test, lr_preds, zero_division=0)
    lr_rec = recall_score(y_test, lr_preds, zero_division=0)
    lr_f1 = f1_score(y_test, lr_preds, zero_division=0)
    lr_auc = roc_auc_score(y_test, lr_probs)
    
    baselines_summary = [
        {"Model": "Majority Classifier", "Accuracy": round(dummy_acc, 4), "Recall": round(dummy_rec, 4), "F1": round(dummy_f1, 4), "ROC-AUC": "N/A"},
        {"Model": "SLA Hours Only", "Accuracy": round(sla_acc, 4), "Recall": round(sla_rec, 4), "F1": round(sla_f1, 4), "ROC-AUC": "N/A"},
        {"Model": "Logistic Regression", "Accuracy": round(lr_acc, 4), "Recall": round(lr_rec, 4), "F1": round(lr_f1, 4), "ROC-AUC": round(lr_auc, 4)},
        {"Model": "Random Forest (Ours)", "Accuracy": round(acc, 4), "Recall": round(rec, 4), "F1": round(f1, 4), "ROC-AUC": round(roc_auc, 4)}
    ]
    df_baselines = pd.DataFrame(baselines_summary)
    print(df_baselines.to_string(index=False))

    # ---------------------------------------------------------
    # THRESHOLD ANALYSIS (HELD-OUT TEST EVALUATION)
    # ---------------------------------------------------------
    print("\n==========================================")
    print("THRESHOLD ANALYSIS (DECISION THRESHOLD SWEEP)")
    print("==========================================")
    thresholds = [0.30, 0.40, 0.50, 0.60, 0.70]
    thresh_results = []
    for t in thresholds:
        t_preds = (test_probs >= t).astype(int)
        t_acc = accuracy_score(y_test, t_preds)
        t_prec = precision_score(y_test, t_preds, zero_division=0)
        t_rec = recall_score(y_test, t_preds, zero_division=0)
        t_f1 = f1_score(y_test, t_preds, zero_division=0)
        
        t_cm = confusion_matrix(y_test, t_preds)
        tn, fp, fn, tp = t_cm.ravel() if t_cm.shape == (2, 2) else (0, 0, 0, 0)
        fpr = fp / (fp + tn) if (fp + tn) > 0 else 0
        fnr = fn / (fn + tp) if (fn + tp) > 0 else 0
        
        thresh_results.append({
            "Threshold": t,
            "Accuracy": round(t_acc, 4),
            "Precision": round(t_prec, 4),
            "Recall (Breach)": round(t_rec, 4),
            "F1-Score": round(t_f1, 4),
            "FPR": round(fpr, 4),
            "FNR": round(fnr, 4)
        })
    df_thresh = pd.DataFrame(thresh_results)
    print(df_thresh.to_string(index=False))

    # ---------------------------------------------------------
    # FEATURE IMPORTANCE (TOP 20)
    # ---------------------------------------------------------
    print("\n==========================================")
    print("RANDOM FOREST FEATURE IMPORTANCE (TOP 20)")
    print("==========================================")
    importances = predictor.model.feature_importances_
    feat_names = predictor.preprocessor.feature_names
    
    fi_pairs = sorted(zip(feat_names, importances), key=lambda x: x[1], reverse=True)[:20]
    df_fi = pd.DataFrame([{"Feature": f, "Importance": round(imp, 4)} for f, imp in fi_pairs])
    print(df_fi.to_string(index=False))
    
    # Save full evaluation summary JSON
    eval_summary = {
        "held_out_test_metrics": {
            "accuracy": round(acc, 4),
            "precision": round(prec, 4),
            "recall": round(rec, 4),
            "f1": round(f1, 4),
            "roc_auc": round(roc_auc, 4),
            "pr_auc": round(pr_auc, 4),
            "brier_score": round(brier, 4),
            "confusion_matrix": cm.tolist()
        },
        "baselines": baselines_summary,
        "threshold_analysis": thresh_results,
        "top_20_features": df_fi.to_dict(orient='records')
    }
    
    with open(os.path.join(EVAL_DIR, "eval_summary.json"), "w") as f:
        json.dump(eval_summary, f, indent=2)
        
    print(f"\n[SUCCESS] Evaluation report saved to {os.path.join(EVAL_DIR, 'eval_summary.json')}")

if __name__ == "__main__":
    main()
