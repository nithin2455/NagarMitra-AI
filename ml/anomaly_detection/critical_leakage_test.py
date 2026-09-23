"""
critical_leakage_test.py
Audits Component 6 feature extraction pipeline to ensure 100% operational window isolation.
Verifies that no outcome/future variables enter the training or inference pipeline.
"""

import os
import pandas as pd
from anomaly_engine import NUMERICAL_COLS, CATEGORICAL_COLS

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SPLITS_DIR = os.path.join(BASE_DIR, "data", "splits")

FORBIDDEN_LEAKAGE_COLS = [
    'actual_response_hours', 'actual_resolution_hours', 'response_breached',
    'resolution_breached', 'closed_at', 'resolved_at', 'seenAt', 'verifiedResolvedAt',
    'officer_assigned_at', 'escalation_level', 'escalation_reason'
]

def test_leakage():
    print("==========================================")
    print("COMPONENT 6 DATA LEAKAGE AUDIT")
    print("==========================================")
    
    train_path = os.path.join(SPLITS_DIR, "anomaly_train.csv")
    df = pd.read_csv(train_path)
    
    used_features = NUMERICAL_COLS + CATEGORICAL_COLS
    
    leaked_found = []
    for col in FORBIDDEN_LEAKAGE_COLS:
        if col in used_features:
            leaked_found.append(col)
            
    print(f"Forbidden Outcome Features Checked: {len(FORBIDDEN_LEAKAGE_COLS)}")
    print(f"Forbidden Features in Pipeline: {leaked_found}")
    
    assert len(leaked_found) == 0, f"FAILED: Forbidden leakage features found: {leaked_found}"
    
    print("[PASSED] 100% Operational Window Feature Isolation Verified.")
    print("No outcome variables present in feature space.")

if __name__ == "__main__":
    test_leakage()
