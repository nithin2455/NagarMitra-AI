"""
@file single_feature_baseline.py
@description Single-Feature Baseline Evaluation for Component 4 Audit.
Evaluates single-feature models to isolate label-construction leakage.
"""

import pandas as pd
import numpy as np
from sklearn.metrics import accuracy_score, f1_score
from sklearn.preprocessing import OneHotEncoder
from sklearn.tree import DecisionTreeClassifier
from sklearn.feature_extraction.text import TfidfVectorizer

def run_single_feature_baselines():
    print("=== CIVICPULSE COMPONENT 4 AUDIT: SINGLE-FEATURE BASELINE TEST ===")

    train_df = pd.read_csv("ml/severity_prediction/data/severity_train_clean.csv")
    test_df = pd.read_csv("ml/severity_prediction/data/severity_test_clean.csv")

    y_train = train_df['urgency_level'].values
    y_test = test_df['urgency_level'].values

    single_experiments = []

    # 1. Category ID Only
    ohe_cat = OneHotEncoder(handle_unknown='ignore', sparse_output=False)
    X_tr_cat = ohe_cat.fit_transform(train_df[['category_id']])
    X_te_cat = ohe_cat.transform(test_df[['category_id']])

    clf_cat = DecisionTreeClassifier(random_state=42)
    clf_cat.fit(X_tr_cat, y_train)
    preds_cat = clf_cat.predict(X_te_cat)
    single_experiments.append(('1. Category ID Only', accuracy_score(y_test, preds_cat), f1_score(y_test, preds_cat, average='macro')))

    # 2. Department Code Only
    ohe_dept = OneHotEncoder(handle_unknown='ignore', sparse_output=False)
    X_tr_dept = ohe_dept.fit_transform(train_df[['department_code']])
    X_te_dept = ohe_dept.transform(test_df[['department_code']])

    clf_dept = DecisionTreeClassifier(random_state=42)
    clf_dept.fit(X_tr_dept, y_train)
    preds_dept = clf_dept.predict(X_te_dept)
    single_experiments.append(('2. Department Code Only', accuracy_score(y_test, preds_dept), f1_score(y_test, preds_dept, average='macro')))

    # 3. Urgency Keyword Count Only
    URGENCY_KEYWORDS = ['danger', 'hazard', 'immediate', 'sewage', 'collapse', 'cholera', 'accident', 'sparking', 'pothole', 'burst', 'flood']
    def get_kw_count(df):
        text = df['title'].fillna('') + ' ' + df['description'].fillna('')
        return text.apply(lambda s: sum(1 for kw in URGENCY_KEYWORDS if kw in s.lower())).values.reshape(-1, 1)

    X_tr_kw = get_kw_count(train_df)
    X_te_kw = get_kw_count(test_df)

    clf_kw = DecisionTreeClassifier(max_depth=4, random_state=42)
    clf_kw.fit(X_tr_kw, y_train)
    preds_kw = clf_kw.predict(X_te_kw)
    single_experiments.append(('3. Urgency Keyword Count Only', accuracy_score(y_test, preds_kw), f1_score(y_test, preds_kw, average='macro')))

    # 4. TF-IDF Title Only
    tfidf_title = TfidfVectorizer(max_features=50)
    X_tr_title = tfidf_title.fit_transform(train_df['title'].fillna('')).toarray()
    X_te_title = tfidf_title.transform(test_df['title'].fillna('')).toarray()

    clf_title = DecisionTreeClassifier(random_state=42)
    clf_title.fit(X_tr_title, y_train)
    preds_title = clf_title.predict(X_te_title)
    single_experiments.append(('4. TF-IDF Title Only', accuracy_score(y_test, preds_title), f1_score(y_test, preds_title, average='macro')))

    # 5. Support Count Only
    X_tr_supp = train_df[['support_count']].fillna(0).values
    X_te_supp = test_df[['support_count']].fillna(0).values

    clf_supp = DecisionTreeClassifier(max_depth=4, random_state=42)
    clf_supp.fit(X_tr_supp, y_train)
    preds_supp = clf_supp.predict(X_te_supp)
    single_experiments.append(('5. Support Count Only', accuracy_score(y_test, preds_supp), f1_score(y_test, preds_supp, average='macro')))

    print("\n--- SINGLE FEATURE BASELINE TEST RESULTS ---")
    for name, acc, f1 in single_experiments:
        print(f"  {name:35s}: Accuracy = {acc:.4f} | Macro F1 = {f1:.4f}")

if __name__ == "__main__":
    run_single_feature_baselines()
