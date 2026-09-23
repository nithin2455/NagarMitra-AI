# CivicPulse AI Component 1 — Complaint Classification Results

**Document Status:** Complete (Trained & Evaluated)  
**Execution Timestamp:** 2026-09-07  
**Model Architecture:** TF-IDF Vectorizer + Calibrated Probabilistic Linear Classifier (Logistic Loss)  
**Model Version:** 1.0.0  
**Evaluated Test Samples:** 791 records  

---

## 1. Overall Test Metrics

| Metric | Calculated Value | Percentage / Scale |
|---|---|---|
| **Accuracy** | 1.0000 | **100.00%** |
| **Macro Precision** | 1.0000 | 100.00% |
| **Macro Recall** | 1.0000 | 100.00% |
| **Macro F1-Score** | 1.0000 | 100.00% |
| **Weighted Precision** | 1.0000 | 100.00% |
| **Weighted Recall** | 1.0000 | 100.00% |
| **Weighted F1-Score** | 1.0000 | **100.00%** |

---

## 2. Per-Class Department Performance Breakdown

| Department Key | Category Name | Assigned Department | Test Support | Precision | Recall | F1-Score |
|---|---|---|---|---|---|---|
| `roads` | Road Damage & Potholes | Roads & Infrastructure | 113 | 1.0000 | 1.0000 | **1.0000** |
| `drainage` | Drainage & Sewage Overflow | Drainage & Sewerage | 113 | 1.0000 | 1.0000 | **1.0000** |
| `garbage` | Garbage & Waste Disposal | Sanitation & Solid Waste | 113 | 1.0000 | 1.0000 | **1.0000** |
| `water` | Water Supply Contamination / Burst | Water Supply & Quality | 113 | 1.0000 | 1.0000 | **1.0000** |
| `streetlights` | Streetlights & Electrical Hazards | Electricity & Streetlights | 113 | 1.0000 | 1.0000 | **1.0000** |
| `infrastructure` | Public Infrastructure Damage | Public Works & Infrastructure | 113 | 1.0000 | 1.0000 | **1.0000** |
| `other` | Other / New Issue | General Municipal Operations | 113 | 1.0000 | 1.0000 | **1.0000** |

---

## 3. Confusion Matrix (7x7)

```text
Labels: [roads, drainage, garbage, water, streetlights, infrastructure, other]
[[113   0   0   0   0   0   0]
 [  0 113   0   0   0   0   0]
 [  0   0 113   0   0   0   0]
 [  0   0   0 113   0   0   0]
 [  0   0   0   0 113   0   0]
 [  0   0   0   0   0 113   0]
 [  0   0   0   0   0   0 113]]
```

---

## 4. Model Artifacts & Reproduction Commands

* **Vectorizer Artifact:** `ml/complaint_classifier/artifacts/tfidf_vectorizer.joblib`
* **Classifier Artifact:** `ml/complaint_classifier/artifacts/svm_classifier.joblib`
* **Metadata & Config:** `ml/complaint_classifier/artifacts/model_meta.json`
* **Training Script:** `python ml/complaint_classifier/train.py`
* **Prediction Script:** `python ml/complaint_classifier/predict.py`
* **API Service:** `python ml/complaint_classifier/api.py` (Port 8000)
