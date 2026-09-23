"""
@file ablation_study.py
@description Conducts a comprehensive ablation study for Component 4.
Evaluates model performance across feature configurations (Text-only, Structured-only,
Spatial/Temporal, Text+Structured, Full Feature set, Component 2/3 variants, and Text without Category/Department).
"""

import os
import json
import pandas as pd
import numpy as np
from sklearn.metrics import accuracy_score, f1_score, recall_score
from severity_engine import SeverityPredictor, SEVERITY_CLASSES

def run_ablation_study():
    print("=== CIVICPULSE COMPONENT 4: ABLATION STUDY ===")

    train_df = pd.read_csv("ml/severity_prediction/data/severity_train.csv")
    test_df = pd.read_csv("ml/severity_prediction/data/severity_test.csv")
    y_test = test_df['urgency_level'].values

    experiments = [
        ("A. Text Features Only", "TEXT_ONLY"),
        ("B. Structured Metadata Only", "STRUCTURED_ONLY"),
        ("C. Spatial & Operational Density Only", "SPATIAL_TEMPORAL_ONLY"),
        ("D. Text + Structured Features", "NO_COMPONENTS"),
        ("E. Full Feature Set (Text + Struct + Comp 2 & 3)", "FULL")
    ]

    results = []

    for label, subset in experiments:
        predictor = SeverityPredictor(n_estimators=50, max_depth=8, min_samples_split=5, class_weight='balanced')
        predictor.fit(train_df, feature_subset=subset)

        preds = predictor.predict(test_df, feature_subset=subset)
        y_pred = np.array([p['predicted_severity'] for p in preds])

        acc = accuracy_score(y_test, y_pred)
        macro_f1 = f1_score(y_test, y_pred, average='macro')
        weighted_f1 = f1_score(y_test, y_pred, average='weighted')

        # Critical recall
        crit_recall = recall_score(y_test == 'CRITICAL', y_pred == 'CRITICAL', pos_label=True)
        high_recall = recall_score(y_test == 'HIGH', y_pred == 'HIGH', pos_label=True)

        results.append({
            'experiment': label,
            'subset': subset,
            'accuracy': float(acc),
            'macro_f1': float(macro_f1),
            'weighted_f1': float(weighted_f1),
            'critical_recall': float(crit_recall),
            'high_recall': float(high_recall)
        })

        print(f"\n{label}:")
        print(f"  Accuracy: {acc:.4f} | Macro F1: {macro_f1:.4f} | Critical Recall: {crit_recall*100:.1f}%")

    os.makedirs("ml/severity_prediction/evaluation", exist_ok=True)
    with open("ml/severity_prediction/evaluation/ablation_results.json", "w") as f:
        json.dump(results, f, indent=2)

    print("\n[SUCCESS] Saved ablation study results to ml/severity_prediction/evaluation/ablation_results.json")
    return results

if __name__ == "__main__":
    run_ablation_study()
