"""
train_sla_model.py
Trains Component 5 RandomForestClassifier on train split, validates on val split,
calibrates probabilities, exports metadata and joblib model artifacts.
"""

import os
import json
import pandas as pd
import numpy as np
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, brier_score_loss
from sla_engine import SLAPredictor

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SPLITS_DIR = os.path.join(BASE_DIR, "data", "splits")
ARTIFACT_DIR = os.path.join(BASE_DIR, "ml", "sla_prediction", "artifacts")

def main():
    train_path = os.path.join(SPLITS_DIR, "sla_train.csv")
    val_path = os.path.join(SPLITS_DIR, "sla_val.csv")
    
    train_df = pd.read_csv(train_path)
    val_df = pd.read_csv(val_path)
    
    print(f"Loaded train ({len(train_df)}) and val ({len(val_df)}) records.")
    
    predictor = SLAPredictor()
    print("Fitting Random Forest Model & Calibrator...")
    predictor.fit(train_df, val_df)
    
    # Evaluate on validation set
    y_val_true = val_df['sla_breached'].values
    val_probs = predictor.predict_proba(val_df)
    val_preds = (val_probs >= 0.50).astype(int)
    
    val_acc = float(accuracy_score(y_val_true, val_preds))
    val_prec = float(precision_score(y_val_true, val_preds, zero_division=0))
    val_rec = float(recall_score(y_val_true, val_preds, zero_division=0))
    val_f1 = float(f1_score(y_val_true, val_preds, zero_division=0))
    val_auc = float(roc_auc_score(y_val_true, val_probs))
    val_brier = float(brier_score_loss(y_val_true, val_probs))
    
    print(f"Validation Metrics:")
    print(f"  Accuracy:    {val_acc:.4f}")
    print(f"  Precision:   {val_prec:.4f}")
    print(f"  Recall:      {val_rec:.4f}")
    print(f"  F1 Score:    {val_f1:.4f}")
    print(f"  ROC-AUC:     {val_auc:.4f}")
    print(f"  Brier Score: {val_brier:.4f}")
    
    # Meta information
    predictor.model_meta = {
        'model_type': 'RandomForestClassifier',
        'n_estimators': 200,
        'max_depth': 12,
        'min_samples_split': 5,
        'class_weight': 'balanced',
        'train_samples': len(train_df),
        'val_samples': len(val_df),
        'val_accuracy': round(val_acc, 4),
        'val_precision': round(val_prec, 4),
        'val_recall': round(val_rec, 4),
        'val_f1': round(val_f1, 4),
        'val_roc_auc': round(val_auc, 4),
        'val_brier': round(val_brier, 4),
        'threshold_low_medium': predictor.threshold_low_medium,
        'threshold_medium_high': predictor.threshold_medium_high,
        'model_version': '5.0.0-rf-calibrated'
    }
    
    predictor.save_artifacts(ARTIFACT_DIR)
    print(f"[SUCCESS] Component 5 model trained and saved to {ARTIFACT_DIR}")

if __name__ == "__main__":
    main()
