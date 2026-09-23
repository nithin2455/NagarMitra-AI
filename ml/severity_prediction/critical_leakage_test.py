"""
@file critical_leakage_test.py
@description Critical Leakage Test for Component 4 Retraining.
Automates P(severity | category) conditional probability checks and single-feature category/department baselines.
"""

import pandas as pd
import numpy as np
from sklearn.preprocessing import OneHotEncoder
from sklearn.tree import DecisionTreeClassifier
from sklearn.metrics import accuracy_score, f1_score

def run_critical_leakage_checks():
    print("=== CIVICPULSE COMPONENT 4: CRITICAL LEAKAGE VERIFICATION TEST ===")

    train_df = pd.read_csv("ml/severity_prediction/data/severity_train.csv")
    val_df = pd.read_csv("ml/severity_prediction/data/severity_val.csv")
    test_df = pd.read_csv("ml/severity_prediction/data/severity_test.csv")

    y_train = train_df['urgency_level'].values
    y_test = test_df['urgency_level'].values

    # 1. P(severity | category) Crosstab & Max Conditional Probability Audit
    ct_cat = pd.crosstab(train_df['category_id'], train_df['urgency_level'], normalize='index')
    max_p_cat = ct_cat.max().max()

    print("\n--- Conditional Probability P(severity | category) ---")
    print(ct_cat.round(4))
    print(f"Max P(severity | category) across all classes: {max_p_cat:.4f} (Expected: 0.25)")

    # 2. P(severity | department) Crosstab
    ct_dept = pd.crosstab(train_df['department_code'], train_df['urgency_level'], normalize='index')
    max_p_dept = ct_dept.max().max()

    print("\n--- Conditional Probability P(severity | department) ---")
    print(ct_dept.round(4))
    print(f"Max P(severity | department) across all classes: {max_p_dept:.4f} (Expected: 0.25)")

    # 3. Category-Only Baseline
    ohe_cat = OneHotEncoder(handle_unknown='ignore', sparse_output=False)
    X_tr_cat = ohe_cat.fit_transform(train_df[['category_id']])
    X_te_cat = ohe_cat.transform(test_df[['category_id']])

    clf_cat = DecisionTreeClassifier(random_state=42)
    clf_cat.fit(X_tr_cat, y_train)
    cat_preds = clf_cat.predict(X_te_cat)
    cat_acc = accuracy_score(y_test, cat_preds)
    cat_f1 = f1_score(y_test, cat_preds, average='macro')

    # 4. Department-Only Baseline
    ohe_dept = OneHotEncoder(handle_unknown='ignore', sparse_output=False)
    X_tr_dept = ohe_dept.fit_transform(train_df[['department_code']])
    X_te_dept = ohe_dept.transform(test_df[['department_code']])

    clf_dept = DecisionTreeClassifier(random_state=42)
    clf_dept.fit(X_tr_dept, y_train)
    dept_preds = clf_dept.predict(X_te_dept)
    dept_acc = accuracy_score(y_test, dept_preds)
    dept_f1 = f1_score(y_test, dept_preds, average='macro')

    # 5. Category + Department Combined Baseline
    X_tr_both = np.hstack([X_tr_cat, X_tr_dept])
    X_te_both = np.hstack([X_te_cat, X_te_dept])

    clf_both = DecisionTreeClassifier(random_state=42)
    clf_both.fit(X_tr_both, y_train)
    both_preds = clf_both.predict(X_te_both)
    both_acc = accuracy_score(y_test, both_preds)
    both_f1 = f1_score(y_test, both_preds, average='macro')

    print("\n--- BASELINE CHECK RESULTS ---")
    print(f"Category-Only Baseline        : Accuracy = {cat_acc:.4f} | Macro F1 = {cat_f1:.4f}")
    print(f"Department-Only Baseline      : Accuracy = {dept_acc:.4f} | Macro F1 = {dept_f1:.4f}")
    print(f"Category+Dept Combined        : Accuracy = {both_acc:.4f} | Macro F1 = {both_f1:.4f}")

    is_leakage_free = (cat_acc <= 0.30 and dept_acc <= 0.30)
    if is_leakage_free:
        print("\n[VERDICT: PASSED] Zero category/department target-construction leakage detected!")
    else:
        print("\n[WARNING] Category/department accuracy is elevated!")

    return {
        'max_p_cat': float(max_p_cat),
        'max_p_dept': float(max_p_dept),
        'category_acc': float(cat_acc),
        'department_acc': float(dept_acc),
        'combined_acc': float(both_acc),
        'is_leakage_free': is_leakage_free
    }

if __name__ == "__main__":
    run_critical_leakage_checks()
