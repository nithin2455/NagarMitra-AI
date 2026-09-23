"""
ablation_study.py
Ablation study for Component 5 — AI SLA Breach Prediction.
Evaluates model performance across different feature subsets:
A. Text Only (TF-IDF + word count + urgency keywords)
B. Structured Only (Temporal + Department + Operational)
C. Spatial Only (Latitude + Longitude + Hotspot score)
D. Severity Only (Component 4 Predicted Severity & Probabilities)
E. Multimodal (Full Integrated Model)
"""

import os
import json
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SPLITS_DIR = os.path.join(BASE_DIR, "data", "splits")
EVAL_DIR = os.path.join(BASE_DIR, "ml", "sla_prediction", "evaluation")

def run_ablation():
    train_df = pd.read_csv(os.path.join(SPLITS_DIR, "sla_train.csv"))
    test_df = pd.read_csv(os.path.join(SPLITS_DIR, "sla_test.csv"))

    y_train = train_df['sla_breached'].values
    y_test = test_df['sla_breached'].values

    # Feature definitions
    text_cols = ['description', 'word_count', 'urgency_kw_count']
    struct_cols = ['created_hour', 'created_day_of_week', 'created_month', 'is_weekend', 'is_working_hours', 'response_sla_hours', 'master_issue_count_at_submission', 'support_count_at_submission']
    spatial_cols = ['latitude', 'longitude', 'hotspot_score_at_submission', 'density_score_at_submission', 'is_hotspot_area']
    severity_cols = ['prob_low', 'prob_medium', 'prob_high', 'prob_critical', 'predicted_severity']

    def get_features(df, mode):
        X_parts = []
        if mode in ['text', 'full']:
            tfidf = TfidfVectorizer(max_features=50, ngram_range=(1,2), stop_words='english')
            # fit transform logic handled separately per split
            pass

    # Standard preprocessing pipelines for each subset
    results = []

    # 1. Text Only
    tfidf = TfidfVectorizer(max_features=50, ngram_range=(1,2), stop_words='english')
    X_tr_text = tfidf.fit_transform(train_df['description'].fillna('')).toarray()
    X_te_text = tfidf.transform(test_df['description'].fillna('')).toarray()
    rf_text = RandomForestClassifier(n_estimators=100, max_depth=10, class_weight='balanced', random_state=42)
    rf_text.fit(X_tr_text, y_train)
    preds_text = rf_text.predict(X_te_text)
    probs_text = rf_text.predict_proba(X_te_text)[:, 1]
    
    results.append({
        "Feature Subset": "A. Text Only",
        "Accuracy": round(accuracy_score(y_test, preds_text), 4),
        "Recall": round(recall_score(y_test, preds_text, zero_division=0), 4),
        "F1": round(f1_score(y_test, preds_text, zero_division=0), 4),
        "ROC-AUC": round(roc_auc_score(y_test, probs_text), 4)
    })

    # 2. Structured Only
    scaler = StandardScaler()
    ohe = OneHotEncoder(handle_unknown='ignore', sparse_output=False)
    X_tr_struct = np.hstack([scaler.fit_transform(train_df[struct_cols]), ohe.fit_transform(train_df[['category_id', 'department_id']])])
    X_te_struct = np.hstack([scaler.transform(test_df[struct_cols]), ohe.transform(test_df[['category_id', 'department_id']])])
    rf_struct = RandomForestClassifier(n_estimators=100, max_depth=10, class_weight='balanced', random_state=42)
    rf_struct.fit(X_tr_struct, y_train)
    preds_struct = rf_struct.predict(X_te_struct)
    probs_struct = rf_struct.predict_proba(X_te_struct)[:, 1]

    results.append({
        "Feature Subset": "B. Structured Only (Temporal/Dept)",
        "Accuracy": round(accuracy_score(y_test, preds_struct), 4),
        "Recall": round(recall_score(y_test, preds_struct, zero_division=0), 4),
        "F1": round(f1_score(y_test, preds_struct, zero_division=0), 4),
        "ROC-AUC": round(roc_auc_score(y_test, probs_struct), 4)
    })

    # 3. Spatial Only
    scaler_sp = StandardScaler()
    X_tr_sp = scaler_sp.fit_transform(train_df[spatial_cols])
    X_te_sp = scaler_sp.transform(test_df[spatial_cols])
    rf_sp = RandomForestClassifier(n_estimators=100, max_depth=10, class_weight='balanced', random_state=42)
    rf_sp.fit(X_tr_sp, y_train)
    preds_sp = rf_sp.predict(X_te_sp)
    probs_sp = rf_sp.predict_proba(X_te_sp)[:, 1]

    results.append({
        "Feature Subset": "C. Spatial Only (Hotspot/Coords)",
        "Accuracy": round(accuracy_score(y_test, preds_sp), 4),
        "Recall": round(recall_score(y_test, preds_sp, zero_division=0), 4),
        "F1": round(f1_score(y_test, preds_sp, zero_division=0), 4),
        "ROC-AUC": round(roc_auc_score(y_test, probs_sp), 4)
    })

    # 4. Severity Only
    scaler_sev = StandardScaler()
    ohe_sev = OneHotEncoder(handle_unknown='ignore', sparse_output=False)
    X_tr_sev = np.hstack([scaler_sev.fit_transform(train_df[['prob_low', 'prob_medium', 'prob_high', 'prob_critical']]), ohe_sev.fit_transform(train_df[['predicted_severity']])])
    X_te_sev = np.hstack([scaler_sev.transform(test_df[['prob_low', 'prob_medium', 'prob_high', 'prob_critical']]), ohe_sev.transform(test_df[['predicted_severity']])])
    rf_sev = RandomForestClassifier(n_estimators=100, max_depth=10, class_weight='balanced', random_state=42)
    rf_sev.fit(X_tr_sev, y_train)
    preds_sev = rf_sev.predict(X_te_sev)
    probs_sev = rf_sev.predict_proba(X_te_sev)[:, 1]

    results.append({
        "Feature Subset": "D. Severity Only (Comp 4 Predict)",
        "Accuracy": round(accuracy_score(y_test, preds_sev), 4),
        "Recall": round(recall_score(y_test, preds_sev, zero_division=0), 4),
        "F1": round(f1_score(y_test, preds_sev, zero_division=0), 4),
        "ROC-AUC": round(roc_auc_score(y_test, probs_sev), 4)
    })

    # 5. Full Multimodal
    from sla_engine import SLAPredictor
    predictor = SLAPredictor()
    predictor.fit(train_df)
    probs_full = predictor.predict_proba(test_df)
    preds_full = (probs_full >= 0.50).astype(int)

    results.append({
        "Feature Subset": "E. Full Integrated Multimodal (Ours)",
        "Accuracy": round(accuracy_score(y_test, preds_full), 4),
        "Recall": round(recall_score(y_test, preds_full, zero_division=0), 4),
        "F1": round(f1_score(y_test, preds_full, zero_division=0), 4),
        "ROC-AUC": round(roc_auc_score(y_test, probs_full), 4)
    })

    df_ablation = pd.DataFrame(results)
    print("==========================================")
    print("COMPONENT 5 ABLATION STUDY RESULTS")
    print("==========================================")
    print(df_ablation.to_string(index=False))

    with open(os.path.join(EVAL_DIR, "ablation_results.json"), "w") as f:
        json.dump(results, f, indent=2)

if __name__ == "__main__":
    run_ablation()
