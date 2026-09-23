"""
@file error_analysis.py
@description Error Analysis and Confusion Diagnostic Script for Component 4.
Identifies false LOW/MEDIUM predictions for HIGH/CRITICAL complaints, evaluates class confusion,
and analyzes prediction confidence distributions.
"""

import os
import json
import pandas as pd
import numpy as np
from severity_engine import SeverityPredictor, SEVERITY_CLASSES

def perform_error_analysis():
    print("=== CIVICPULSE COMPONENT 4: ERROR ANALYSIS & CONFUSION DIAGNOSTIC ===")

    test_df = pd.read_csv("ml/severity_prediction/data/severity_test_clean.csv")
    predictor = SeverityPredictor()
    predictor.load_artifacts("ml/severity_prediction/artifacts")

    results = predictor.predict(test_df)
    test_df['predicted_severity'] = [r['predicted_severity'] for r in results]
    test_df['confidence'] = [r['confidence'] for r in results]

    # Filter misclassifications
    errors_df = test_df[test_df['urgency_level'] != test_df['predicted_severity']].copy()
    print(f"\nTotal test samples: {len(test_df)}")
    print(f"Total misclassifications: {len(errors_df)} ({len(errors_df)/len(test_df)*100:.2f}%)")

    # High-Risk Errors: True HIGH or CRITICAL misclassified as LOW or MEDIUM
    high_risk_errors = errors_df[
        (errors_df['urgency_level'].isin(['HIGH', 'CRITICAL'])) &
        (errors_df['predicted_severity'].isin(['LOW', 'MEDIUM']))
    ]

    print(f"\n[SAFETY AUDIT] High-Risk Misclassifications (True High/Critical -> Predicted Low/Medium): {len(high_risk_errors)}")

    # Confidence Distribution Analysis
    avg_conf_correct = test_df[test_df['urgency_level'] == test_df['predicted_severity']]['confidence'].mean()
    avg_conf_error = errors_df['confidence'].mean() if len(errors_df) > 0 else 0.0

    print(f"\nAverage Model Confidence (Correct Predictions): {avg_conf_correct:.4f}")
    print(f"Average Model Confidence (Erroneous Predictions): {avg_conf_error:.4f}")

    error_summary = {
        'total_test_samples': len(test_df),
        'total_errors': len(errors_df),
        'error_rate_pct': float(len(errors_df)/len(test_df)*100),
        'high_risk_errors_count': len(high_risk_errors),
        'avg_confidence_correct': float(avg_conf_correct),
        'avg_confidence_error': float(avg_conf_error)
    }

    os.makedirs("ml/severity_prediction/evaluation", exist_ok=True)
    with open("ml/severity_prediction/evaluation/error_analysis.json", "w") as f:
        json.dump(error_summary, f, indent=2)

    print("\n[SUCCESS] Error analysis output saved to ml/severity_prediction/evaluation/error_analysis.json")
    return error_summary

if __name__ == "__main__":
    perform_error_analysis()
