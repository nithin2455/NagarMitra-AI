"""
CivicPulse AI Component 1 — Complaint Classification Training Script
Model Architecture: TF-IDF Vectorizer + Calibrated Linear Classifier (Platt Sigmoid / Logistic Loss)
Target Departments: roads, drainage, garbage, water, streetlights, infrastructure, other
"""

import os
import sys
import json
import random
import numpy as np
import pandas as pd

import sklearn
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import SGDClassifier
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    confusion_matrix
)
import joblib

# Set fixed random seeds for 100% reproducibility
random.seed(42)
np.random.seed(42)

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SPLITS_DIR = os.path.join(BASE_DIR, "data", "splits")
ARTIFACTS_DIR = os.path.join(os.path.dirname(__file__), "artifacts")
DOCS_DIR = os.path.join(BASE_DIR, "docs", "ai-ml")

os.makedirs(ARTIFACTS_DIR, exist_ok=True)
os.makedirs(DOCS_DIR, exist_ok=True)

# CivicPulse Category & Department Metadata Mapping
DEPARTMENT_META = {
    "roads": {
        "id": "roads",
        "name": "Road Damage & Potholes",
        "departmentCode": "DEPT_ROADS",
        "departmentName": "Roads & Infrastructure"
    },
    "drainage": {
        "id": "drainage",
        "name": "Drainage & Sewage Overflow",
        "departmentCode": "DEPT_DRAINAGE",
        "departmentName": "Drainage & Sewerage"
    },
    "garbage": {
        "id": "garbage",
        "name": "Garbage & Waste Disposal",
        "departmentCode": "DEPT_SANITATION",
        "departmentName": "Sanitation & Solid Waste"
    },
    "water": {
        "id": "water",
        "name": "Water Supply Contamination / Burst",
        "departmentCode": "DEPT_WATER",
        "departmentName": "Water Supply & Quality"
    },
    "streetlights": {
        "id": "streetlights",
        "name": "Streetlights & Electrical Hazards",
        "departmentCode": "DEPT_ELECTRICITY",
        "departmentName": "Electricity & Streetlights"
    },
    "infrastructure": {
        "id": "infrastructure",
        "name": "Public Infrastructure Damage",
        "departmentCode": "DEPT_WORKS",
        "departmentName": "Public Works & Infrastructure"
    },
    "other": {
        "id": "other",
        "name": "Other / New Issue",
        "departmentCode": "DEPT_GENERAL",
        "departmentName": "General Municipal Operations"
    }
}

print("1. Loading train, validation, and test datasets from data/splits/...", flush=True)
train_df = pd.read_csv(os.path.join(SPLITS_DIR, "classification_train.csv"))
val_df = pd.read_csv(os.path.join(SPLITS_DIR, "classification_val.csv"))
test_df = pd.read_csv(os.path.join(SPLITS_DIR, "classification_test.csv"))

print(f"   Train samples: {len(train_df):,}", flush=True)
print(f"   Validation samples: {len(val_df):,}", flush=True)
print(f"   Test samples: {len(test_df):,}", flush=True)

def preprocess_text(text):
    if pd.isna(text) or not str(text).strip():
        return ""
    return " ".join(str(text).split())

train_text = train_df['clean_text'].apply(preprocess_text)
val_text = val_df['clean_text'].apply(preprocess_text)
test_text = test_df['clean_text'].apply(preprocess_text)

y_train = train_df['category_id']
y_val = val_df['category_id']
y_test = test_df['category_id']

print("\n2. Fitting TF-IDF Vectorizer ONLY on training data...", flush=True)
vectorizer = TfidfVectorizer(
    ngram_range=(1, 2),
    max_features=5000,
    sublinear_tf=True,
    strip_accents='unicode'
)
X_train = vectorizer.fit_transform(train_text)
X_val = vectorizer.transform(val_text)
X_test = vectorizer.transform(test_text)

print(f"   TF-IDF Vocabulary Size: {len(vectorizer.vocabulary_):,}", flush=True)

print("\n3. Training Calibrated Linear Classifier (Logistic Loss / Platt Scaling)...", flush=True)
# SGDClassifier with loss='log_loss' is a probabilistic linear classifier (modified Huber / Logistic SVM) that produces calibrated probabilities via predict_proba
clf = SGDClassifier(loss='log_loss', alpha=1e-4, max_iter=1000, random_state=42)
clf.fit(X_train, y_train)

print("\n4. Evaluating Model on Validation & Untouched Test Splits...", flush=True)
val_preds = clf.predict(X_val)
val_acc = accuracy_score(y_val, val_preds)
val_f1 = f1_score(y_val, val_preds, average='weighted')
print(f"   Validation Accuracy: {val_acc*100:.2f}% | Weighted F1: {val_f1:.4f}", flush=True)

# Final Evaluation on Untouched Test Set
test_preds = clf.predict(X_test)
test_probs = clf.predict_proba(X_test)

test_acc = float(accuracy_score(y_test, test_preds))
test_prec_macro = float(precision_score(y_test, test_preds, average='macro'))
test_rec_macro = float(recall_score(y_test, test_preds, average='macro'))
test_f1_macro = float(f1_score(y_test, test_preds, average='macro'))

test_prec_weighted = float(precision_score(y_test, test_preds, average='weighted'))
test_rec_weighted = float(recall_score(y_test, test_preds, average='weighted'))
test_f1_weighted = float(f1_score(y_test, test_preds, average='weighted'))

dept_labels = ["roads", "drainage", "garbage", "water", "streetlights", "infrastructure", "other"]
cm = confusion_matrix(y_test, test_preds, labels=dept_labels)

# Per-Class Metrics
per_class_metrics = {}
for d in dept_labels:
    y_true_b = (y_test == d).astype(int)
    y_pred_b = (test_preds == d).astype(int)
    per_class_metrics[d] = {
        "category_name": DEPARTMENT_META[d]["name"],
        "department_name": DEPARTMENT_META[d]["departmentName"],
        "support": int(y_true_b.sum()),
        "precision": float(precision_score(y_true_b, y_pred_b, zero_division=0)),
        "recall": float(recall_score(y_true_b, y_pred_b, zero_division=0)),
        "f1_score": float(f1_score(y_true_b, y_pred_b, zero_division=0))
    }

print("\n--- TEST EVALUATION SUMMARY ---", flush=True)
print(f"   Test Accuracy: {test_acc*100:.2f}%", flush=True)
print(f"   Macro Precision: {test_prec_macro:.4f}", flush=True)
print(f"   Macro Recall: {test_rec_macro:.4f}", flush=True)
print(f"   Macro F1: {test_f1_macro:.4f}", flush=True)
print(f"   Weighted F1: {test_f1_weighted:.4f}", flush=True)

print("\n5. Saving Trained Model & Vectorizer Artifacts...", flush=True)
joblib.dump(vectorizer, os.path.join(ARTIFACTS_DIR, "tfidf_vectorizer.joblib"))
joblib.dump(clf, os.path.join(ARTIFACTS_DIR, "svm_classifier.joblib"))

meta_data = {
    "model_name": "TF-IDF + Calibrated Linear Classifier (SGD Log-Loss)",
    "version": "1.0.0",
    "python_version": sys.version.split()[0],
    "sklearn_version": sklearn.__version__,
    "trained_at": "2026-09-07",
    "categories": list(clf.classes_),
    "metrics": {
        "test_accuracy": test_acc,
        "macro_precision": test_prec_macro,
        "macro_recall": test_rec_macro,
        "macro_f1": test_f1_macro,
        "weighted_precision": test_prec_weighted,
        "weighted_recall": test_rec_weighted,
        "weighted_f1": test_f1_weighted
    },
    "department_meta": DEPARTMENT_META
}

with open(os.path.join(ARTIFACTS_DIR, "model_meta.json"), 'w', encoding='utf-8') as f:
    json.dump(meta_data, f, indent=2)

print(f"   Saved artifacts to {ARTIFACTS_DIR}", flush=True)

print("\n6. Writing Detailed Results to docs/ai-ml/complaint-classification-results.md...", flush=True)
results_md_path = os.path.join(DOCS_DIR, "complaint-classification-results.md")

with open(results_md_path, 'w', encoding='utf-8') as f:
    f.write(f"""# CivicPulse AI Component 1 — Complaint Classification Results

**Document Status:** Complete (Trained & Evaluated)  
**Execution Timestamp:** 2026-09-07  
**Model Architecture:** TF-IDF Vectorizer + Calibrated Probabilistic Linear Classifier (Logistic Loss)  
**Model Version:** 1.0.0  
**Evaluated Test Samples:** {len(y_test):,} records  

---

## 1. Overall Test Metrics

| Metric | Calculated Value | Percentage / Scale |
|---|---|---|
| **Accuracy** | {test_acc:.4f} | **{test_acc*100:.2f}%** |
| **Macro Precision** | {test_prec_macro:.4f} | {test_prec_macro*100:.2f}% |
| **Macro Recall** | {test_rec_macro:.4f} | {test_rec_macro*100:.2f}% |
| **Macro F1-Score** | {test_f1_macro:.4f} | {test_f1_macro*100:.2f}% |
| **Weighted Precision** | {test_prec_weighted:.4f} | {test_prec_weighted*100:.2f}% |
| **Weighted Recall** | {test_rec_weighted:.4f} | {test_rec_weighted*100:.2f}% |
| **Weighted F1-Score** | {test_f1_weighted:.4f} | **{test_f1_weighted*100:.2f}%** |

---

## 2. Per-Class Department Performance Breakdown

| Department Key | Category Name | Assigned Department | Test Support | Precision | Recall | F1-Score |
|---|---|---|---|---|---|---|
| `roads` | {per_class_metrics['roads']['category_name']} | {per_class_metrics['roads']['department_name']} | {per_class_metrics['roads']['support']} | {per_class_metrics['roads']['precision']:.4f} | {per_class_metrics['roads']['recall']:.4f} | **{per_class_metrics['roads']['f1_score']:.4f}** |
| `drainage` | {per_class_metrics['drainage']['category_name']} | {per_class_metrics['drainage']['department_name']} | {per_class_metrics['drainage']['support']} | {per_class_metrics['drainage']['precision']:.4f} | {per_class_metrics['drainage']['recall']:.4f} | **{per_class_metrics['drainage']['f1_score']:.4f}** |
| `garbage` | {per_class_metrics['garbage']['category_name']} | {per_class_metrics['garbage']['department_name']} | {per_class_metrics['garbage']['support']} | {per_class_metrics['garbage']['precision']:.4f} | {per_class_metrics['garbage']['recall']:.4f} | **{per_class_metrics['garbage']['f1_score']:.4f}** |
| `water` | {per_class_metrics['water']['category_name']} | {per_class_metrics['water']['department_name']} | {per_class_metrics['water']['support']} | {per_class_metrics['water']['precision']:.4f} | {per_class_metrics['water']['recall']:.4f} | **{per_class_metrics['water']['f1_score']:.4f}** |
| `streetlights` | {per_class_metrics['streetlights']['category_name']} | {per_class_metrics['streetlights']['department_name']} | {per_class_metrics['streetlights']['support']} | {per_class_metrics['streetlights']['precision']:.4f} | {per_class_metrics['streetlights']['recall']:.4f} | **{per_class_metrics['streetlights']['f1_score']:.4f}** |
| `infrastructure` | {per_class_metrics['infrastructure']['category_name']} | {per_class_metrics['infrastructure']['department_name']} | {per_class_metrics['infrastructure']['support']} | {per_class_metrics['infrastructure']['precision']:.4f} | {per_class_metrics['infrastructure']['recall']:.4f} | **{per_class_metrics['infrastructure']['f1_score']:.4f}** |
| `other` | {per_class_metrics['other']['category_name']} | {per_class_metrics['other']['department_name']} | {per_class_metrics['other']['support']} | {per_class_metrics['other']['precision']:.4f} | {per_class_metrics['other']['recall']:.4f} | **{per_class_metrics['other']['f1_score']:.4f}** |

---

## 3. Confusion Matrix (7x7)

```text
Labels: [roads, drainage, garbage, water, streetlights, infrastructure, other]
{cm}
```

---

## 4. Model Artifacts & Reproduction Commands

* **Vectorizer Artifact:** `ml/complaint_classifier/artifacts/tfidf_vectorizer.joblib`
* **Classifier Artifact:** `ml/complaint_classifier/artifacts/svm_classifier.joblib`
* **Metadata & Config:** `ml/complaint_classifier/artifacts/model_meta.json`
* **Training Script:** `python ml/complaint_classifier/train.py`
* **Prediction Script:** `python ml/complaint_classifier/predict.py`
* **API Service:** `python ml/complaint_classifier/api.py` (Port 8000)
""")

print(f"Results written to {results_md_path}", flush=True)
print("Training Complete!", flush=True)
