"""
@file tune_model.py
@description Hyperparameter grid search for Random Forest Severity Model.
Evaluates parameter grid on training/validation splits without touching final held-out test data.
"""

import pandas as pd
import numpy as np
from sklearn.metrics import classification_report, accuracy_score, f1_score
from severity_engine import SeverityPredictor, SEVERITY_CLASSES

def tune_random_forest():
    print("=== HYPERPARAMETER GRID SEARCH: RANDOM FOREST SEVERITY MODEL ===")

    train_df = pd.read_csv("ml/severity_prediction/data/severity_train.csv")
    val_df = pd.read_csv("ml/severity_prediction/data/severity_val.csv")

    param_grid = [
        {'n_estimators': 100, 'max_depth': 8, 'min_samples_split': 5, 'min_samples_leaf': 2, 'class_weight': 'balanced'},
        {'n_estimators': 200, 'max_depth': 12, 'min_samples_split': 5, 'min_samples_leaf': 2, 'class_weight': 'balanced'},
        {'n_estimators': 300, 'max_depth': 16, 'min_samples_split': 4, 'min_samples_leaf': 1, 'class_weight': 'balanced'},
        {'n_estimators': 200, 'max_depth': 12, 'min_samples_split': 5, 'min_samples_leaf': 2, 'class_weight': None},
    ]

    best_val_f1 = -1.0
    best_params = None
    best_model = None

    print(f"\nEvaluating {len(param_grid)} hyperparameter candidates on Validation Split...")

    for i, params in enumerate(param_grid):
        predictor = SeverityPredictor(**params)
        predictor.fit(train_df)

        val_preds = predictor.predict(val_df)
        y_val_pred = [p['predicted_severity'] for p in val_preds]
        y_val_true = val_df['urgency_level'].values

        acc = accuracy_score(y_val_true, y_val_pred)
        macro_f1 = f1_score(y_val_true, y_val_pred, average='macro')
        weighted_f1 = f1_score(y_val_true, y_val_pred, average='weighted')

        print(f"\nCandidate [{i+1}/{len(param_grid)}]: {params}")
        print(f"  Val Accuracy: {acc:.4f} | Val Macro F1: {macro_f1:.4f} | Val Weighted F1: {weighted_f1:.4f}")

        if macro_f1 > best_val_f1:
            best_val_f1 = macro_f1
            best_params = params
            best_model = predictor

    print("\n==================================================")
    print("OPTIMAL HYPERPARAMETERS SELECTED:")
    print(best_params)
    print(f"Best Validation Macro F1: {best_val_f1:.4f}")
    print("==================================================")

    # Save artifacts for best model
    best_model.save_artifacts("ml/severity_prediction/artifacts")
    return best_model, best_params

if __name__ == "__main__":
    tune_random_forest()
