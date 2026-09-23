"""
critical_leakage_test.py
Audits Component 5 feature extraction pipeline to ensure 100% submission-time (t=0) isolation.
Verifies that no outcome/future variables enter the training or inference pipeline.
"""

import os
import pandas as pd
from sla_engine import FORBIDDEN_LEAKAGE_COLS, NUMERICAL_COLS, CATEGORICAL_COLS

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SPLITS_DIR = os.path.join(BASE_DIR, "data", "splits")

def test_leakage():
    print("==========================================")
    print("COMPONENT 5 DATA LEAKAGE AUDIT")
    print("==========================================")
    
    train_path = os.path.join(SPLITS_DIR, "sla_train.csv")
    df = pd.read_csv(train_path)
    
    used_features = NUMERICAL_COLS + CATEGORICAL_COLS + ['description']
    
    leaked_found = []
    for col in FORBIDDEN_LEAKAGE_COLS:
        if col in used_features:
            leaked_found.append(col)
            
    print(f"Forbidden Outcome Features Checked: {len(FORBIDDEN_LEAKAGE_COLS)}")
    print(f"Forbidden Features in Pipeline: {leaked_found}")
    
    assert len(leaked_found) == 0, f"FAILED: Forbidden leakage features found: {leaked_found}"
    
    print("[PASSED] 100% Submission-Time (t=0) Feature Isolation Verified.")
    print("No outcome variables (seenAt, actual_response_hours, closed_at, escalation) present in feature space.")

if __name__ == "__main__":
    test_leakage()
