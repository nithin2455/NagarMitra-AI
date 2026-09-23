"""
@file evaluate_severity.py
@description Evaluates Component 4 Random Forest Severity Model and Baselines on final frozen held-out test split.
Calculates Accuracy, Precision, Recall, F1 (Macro, Weighted, Per-Class), Confusion Matrix,
HIGH+CRITICAL Recall, ROC-AUC, and Feature Importance.
"""

import os
import json
import numpy as np
import pandas as pd
from sklearn.metrics import (
    classification_report, accuracy_score, precision_score, recall_score,
    f1_score, confusion_matrix, roc_auc_score
)
from sklearn.dummy import DummyClassifier
from sklearn.linear_model import LogisticRegression
from severity_engine import SeverityPredictor, SeverityFeaturePipeline, SEVERITY_CLASSES

def evaluate_on_held_out_test():
    print("=== CIVICPULSE COMPONENT 4: FINAL HELD-OUT TEST EVALUATION ===")

    train_df = pd.read_csv("ml/severity_prediction/data/severity_train.csv")
    test_df = pd.read_csv("ml/severity_prediction/data/severity_test.csv")

    y_train = train_df['urgency_level'].values
    y_test = test_df['urgency_level'].values

    # 1. Baseline 1: Majority Class Baseline
    dummy = DummyClassifier(strategy="most_frequent")
    dummy.fit(train_df, y_train)
    dummy_preds = dummy.predict(test_df)
    dummy_acc = accuracy_score(y_test, dummy_preds)
    dummy_f1 = f1_score(y_test, dummy_preds, average='macro')

    # 2. Baseline 2: Logistic Regression
    pipeline = SeverityFeaturePipeline()
    X_train_vec = pipeline.fit_transform(train_df)
    X_test_vec = pipeline.transform(test_df)

    lr = LogisticRegression(max_iter=1000, class_weight='balanced', random_state=42)
    lr.fit(X_train_vec, y_train)
    lr_preds = lr.predict(X_test_vec)
    lr_acc = accuracy_score(y_test, lr_preds)
    lr_macro_f1 = f1_score(y_test, lr_preds, average='macro')

    # 3. Main Random Forest Severity Model (Loaded from Artifacts)
    predictor = SeverityPredictor()
    predictor.load_artifacts("ml/severity_prediction/artifacts")

    rf_results = predictor.predict(test_df)
    rf_preds = np.array([r['predicted_severity'] for r in rf_results])
    rf_probs = np.array([[r['class_probabilities'][cls] for cls in SEVERITY_CLASSES] for r in rf_results])

    # Performance Metrics
    rf_acc = accuracy_score(y_test, rf_preds)
    rf_macro_p = precision_score(y_test, rf_preds, average='macro')
    rf_macro_r = recall_score(y_test, rf_preds, average='macro')
    rf_macro_f1 = f1_score(y_test, rf_preds, average='macro')
    rf_weighted_f1 = f1_score(y_test, rf_preds, average='weighted')

    # Per-Class Metrics
    per_class_p = precision_score(y_test, rf_preds, average=None, labels=SEVERITY_CLASSES)
    per_class_r = recall_score(y_test, rf_preds, average=None, labels=SEVERITY_CLASSES)
    per_class_f1 = f1_score(y_test, rf_preds, average=None, labels=SEVERITY_CLASSES)

    # High & Critical Safety Recall
    critical_idx = SEVERITY_CLASSES.index('CRITICAL')
    high_idx = SEVERITY_CLASSES.index('HIGH')

    critical_recall = per_class_r[critical_idx]
    high_recall = per_class_r[high_idx]
    high_critical_combined_recall = float(
        np.sum((y_test == 'CRITICAL') & (rf_preds == 'CRITICAL') | (y_test == 'HIGH') & (rf_preds == 'HIGH')) /
        np.sum((y_test == 'CRITICAL') | (y_test == 'HIGH'))
    )

    # Confusion Matrix
    cm = confusion_matrix(y_test, rf_preds, labels=SEVERITY_CLASSES)

    # Multi-class One-vs-Rest ROC-AUC
    try:
        # Convert y_test to one-hot for ROC-AUC
        y_test_oh = pd.get_dummies(y_test)[SEVERITY_CLASSES].values
        roc_auc = roc_auc_score(y_test_oh, rf_probs, multi_class='ovr', average='macro')
    except Exception as e:
        roc_auc = None

    print("\n--- BASELINE VS RANDOM FOREST MODEL COMPARISON ---")
    print(f"Majority Baseline    : Accuracy = {dummy_acc:.4f} | Macro F1 = {dummy_f1:.4f}")
    print(f"Logistic Regression  : Accuracy = {lr_acc:.4f} | Macro F1 = {lr_macro_f1:.4f}")
    print(f"Random Forest (Ours) : Accuracy = {rf_acc:.4f} | Macro F1 = {rf_macro_f1:.4f} | Weighted F1 = {rf_weighted_f1:.4f}")

    print("\n--- PER-CLASS METRICS (RANDOM FOREST) ---")
    for idx, cls in enumerate(SEVERITY_CLASSES):
        print(f"  Class [{cls:8s}]: Precision = {per_class_p[idx]:.4f} | Recall = {per_class_r[idx]:.4f} | F1 = {per_class_f1[idx]:.4f}")

    print("\n--- SAFETY CRITICAL RECALL FOCUS ---")
    print(f"  CRITICAL Recall      : {critical_recall*100:.2f}%")
    print(f"  HIGH Recall          : {high_recall*100:.2f}%")
    print(f"  HIGH+CRITICAL Combined: {high_critical_combined_recall*100:.2f}%")

    print("\n--- CONFUSION MATRIX ---")
    print("Labels order:", SEVERITY_CLASSES)
    print(cm)

    # Top Feature Importances
    fi_df = predictor.get_feature_importances()
    print("\n--- TOP 10 FEATURE IMPORTANCES ---")
    print(fi_df.head(10).to_string(index=False))

    results_summary = {
        'dummy_accuracy': float(dummy_acc),
        'dummy_macro_f1': float(dummy_f1),
        'lr_accuracy': float(lr_acc),
        'lr_macro_f1': float(lr_macro_f1),
        'rf_accuracy': float(rf_acc),
        'rf_macro_precision': float(rf_macro_p),
        'rf_macro_recall': float(rf_macro_r),
        'rf_macro_f1': float(rf_macro_f1),
        'rf_weighted_f1': float(rf_weighted_f1),
        'critical_recall': float(critical_recall),
        'high_recall': float(high_recall),
        'high_critical_combined_recall': float(high_critical_combined_recall),
        'roc_auc_macro': float(roc_auc) if roc_auc is not None else None,
        'confusion_matrix': cm.tolist(),
        'per_class_metrics': {
            cls: {
                'precision': float(per_class_p[i]),
                'recall': float(per_class_r[i]),
                'f1': float(per_class_f1[i])
            }
            for i, cls in enumerate(SEVERITY_CLASSES)
        }
    }

    os.makedirs("ml/severity_prediction/evaluation", exist_ok=True)
    with open("ml/severity_prediction/evaluation/evaluation_results.json", "w") as f:
        json.dump(results_summary, f, indent=2)

    return results_summary

if __name__ == "__main__":
    evaluate_on_held_out_test()
