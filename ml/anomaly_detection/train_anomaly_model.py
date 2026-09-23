"""
train_anomaly_model.py
Trains Component 6 IsolationForest model on anomaly_train.csv, validates score thresholds on val set,
exports model_meta.json and joblib model artifacts.
"""

import os
import time
import json
import pandas as pd
import numpy as np
from anomaly_engine import IsolationForestPredictor

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SPLITS_DIR = os.path.join(BASE_DIR, "data", "splits")
ARTIFACT_DIR = os.path.join(BASE_DIR, "ml", "anomaly_detection", "artifacts")

def main():
    train_path = os.path.join(SPLITS_DIR, "anomaly_train.csv")
    val_path = os.path.join(SPLITS_DIR, "anomaly_val.csv")
    
    train_df = pd.read_csv(train_path)
    val_df = pd.read_csv(val_path)
    
    print(f"Loaded train ({len(train_df)}) and val ({len(val_df)}) records.")
    
    start_time = time.perf_counter()
    
    predictor = IsolationForestPredictor()
    print("Fitting Isolation Forest Model (n_estimators=200, contamination=0.05)...")
    predictor.fit(train_df)
    
    train_time_sec = round(time.perf_counter() - start_time, 4)
    
    # Evaluate score distribution on validation set
    val_scores = predictor.predict_anomaly_score(val_df)
    val_anomalies_count = int(np.sum(val_scores >= predictor.threshold_low_medium))
    val_anomaly_rate = float(round(val_anomalies_count / len(val_df), 4))
    
    print(f"Training Complete:")
    print(f"  Training Time:   {train_time_sec} s")
    print(f"  Val Anomaly Rate: {val_anomaly_rate*100:.2f}% ({val_anomalies_count}/{len(val_df)} detected as anomalous)")
    print(f"  Mean Score:      {np.mean(val_scores):.4f}")
    print(f"  Max Score:       {np.max(val_scores):.4f}")
    print(f"  Min Score:       {np.min(val_scores):.4f}")
    
    predictor.model_meta = {
        'algorithm': 'IsolationForest',
        'n_estimators': 200,
        'contamination': 0.05,
        'train_samples': len(train_df),
        'val_samples': len(val_df),
        'training_time_sec': train_time_sec,
        'val_anomaly_rate': val_anomaly_rate,
        'threshold_low_medium': predictor.threshold_low_medium,
        'threshold_medium_high': predictor.threshold_medium_high,
        'model_version': '6.0.0-iforest',
        'random_seed': 42
    }
    
    predictor.save_artifacts(ARTIFACT_DIR)
    print(f"[SUCCESS] Component 6 Isolation Forest trained and saved to {ARTIFACT_DIR}")

if __name__ == "__main__":
    main()
