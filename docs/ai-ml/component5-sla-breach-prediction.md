# Component 5 — AI SLA Breach Prediction: Research Report & System Documentation

## Executive Summary
This report presents the research-grade design, implementation, and evaluation of **Component 5 — AI SLA Breach Prediction** for the CivicPulse Smart Public Grievance Management Platform. Using a calibrated `RandomForestClassifier` trained strictly on submission-time ($t = 0$) features, the system predicts whether a newly submitted municipal complaint will breach its response SLA window before any officer interaction occurs.

---

## 1. Problem Statement & Prediction Point
In municipal grievance systems, reactive SLA tracking only alerts administrators *after* a response deadline has passed. Component 5 solves this by converting SLA management into a **proactive risk prediction problem**:

- **Prediction Point**: $t = 0$ (the exact moment a citizen clicks "Submit Grievance").
- **Target Variable**: `response_sla_breached` (Binary classification: `0` = Response Met, `1` = Response Breached).
- **Definition**: Response SLA breach occurs if actual officer acknowledgment time (`seenAt`) exceeds `responseSlaDue` (`createdAt + responseSlaHours`).

---

## 2. Benchmark Dataset Provenance & Data Splits

- **Total Dataset Size**: $N = 4,200$ municipal records.
- **Partitioning Strategy**: Reproducible stratified splits:
  - `data/splits/sla_train.csv` ($N = 2,940$, 70%)
  - `data/splits/sla_val.csv` ($N = 630$, 15%)
  - `data/splits/sla_test.csv` ($N = 630$, 15%)
- **Target Distribution**:
  - Breached ($y = 1$): 3,166 records (75.38%)
  - Non-Breached ($y = 0$): 1,034 records (24.62%)

---

## 3. Machine Learning Methodology

### Feature Pipeline
1. **Temporal Features**: `created_hour`, `created_day_of_week`, `created_month`, `is_weekend`, `is_working_hours` (8 AM–6 PM Mon–Fri).
2. **Text / NLP Features**: TF-IDF unigrams & bigrams (50 features max), word count, urgency keyword frequency.
3. **Spatial & Density Features**: `latitude`, `longitude`, `hotspot_score_at_submission` (Comp 3), `density_score_at_submission`, `is_hotspot_area`.
4. **Multi-Component Features**: `master_issue_count_at_submission` (Comp 2), `support_count_at_submission`, `predicted_severity` (Comp 4), severity class probabilities.
5. **Categorical Encodings**: One-Hot Encoded `category_id`, `department_id`, `predicted_severity`.

### Model Hyperparameters & Calibration
- **Model**: `RandomForestClassifier(n_estimators=200, max_depth=12, min_samples_split=5, min_samples_leaf=2, class_weight='balanced', random_state=42, n_jobs=-1)`.
- **Calibration**: Platt Scaling (Logistic Regression fit on validation set raw predictions) to ensure well-calibrated probability outputs.
- **Risk Mapping**:
  - $P(\text{breach}) < 0.35 \implies \text{LOW RISK}$
  - $0.35 \le P(\text{breach}) < 0.65 \implies \text{MEDIUM RISK}$
  - $P(\text{breach}) \ge 0.65 \implies \text{HIGH RISK}$

---

## 4. Benchmark Model Comparison (Held-Out Test Set $N = 630$)

All models evaluated on the untouched held-out test set ($N = 630$):

| Model | Accuracy | Recall (Breach) | F1-Score | ROC-AUC | PR-AUC | Brier Score |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Majority Classifier** | 0.7556 | 1.0000 | 0.8608 | N/A | N/A | N/A |
| **SLA Hours Only** | 0.6968 | 0.7584 | 0.7908 | N/A | N/A | N/A |
| **Logistic Regression** | 0.8476 | 0.8382 | 0.8926 | 0.9237 | 0.9692 | 0.1082 |
| **Random Forest (Ours)** | **0.8619** | **0.9013** | **0.9079** | **0.9199** | **0.9748** | **0.0984** |

---

## 5. Decision Threshold Analysis

Selected decision threshold parameters evaluated on held-out test data:

| Threshold ($T$) | Accuracy | Precision | Recall (Breach) | F1-Score | False Positive Rate | False Negative Rate |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| 0.30 | 0.7762 | 0.7759 | 0.9895 | 0.8698 | 0.8831 | 0.0105 |
| 0.40 | 0.8460 | 0.8738 | 0.9307 | 0.9013 | 0.4156 | 0.0693 |
| **0.50 (Default)** | **0.8619** | **0.9147** | **0.9013** | **0.9079** | **0.2597** | **0.0987** |
| 0.60 | 0.8635 | 0.9333 | 0.8824 | 0.9071 | 0.1948 | 0.1176 |
| 0.70 | 0.8397 | 0.9496 | 0.8319 | 0.8869 | 0.1364 | 0.1681 |

---

## 6. Feature Importance Ranking (Top 10)

The Random Forest model identified the following top operational predictors of SLA breach:

1. `is_working_hours` (23.78%) — Submissions outside 8 AM–6 PM Mon–Fri are the single highest driver of officer acknowledgment delay.
2. `hotspot_score_at_submission` (8.60%) — High geographic complaint density (Component 3) correlates with department backlog.
3. `created_hour` (8.08%) — Submission hour of day.
4. `density_score_at_submission` (7.78%) — Normalized spatial cluster density.
5. `response_sla_hours` (6.99%) — Strict short SLA windows (e.g. 1–2h) are harder to fulfill.
6. `created_day_of_week` (4.71%) — Day of week.
7. `is_hotspot_area` (3.82%) — Binary DBSCAN cluster flag.
8. `is_weekend` (3.21%) — Weekend submission flag.
9. `latitude` (2.80%) & `longitude` (2.65%) — Geographic zone.

---

## 7. Feature Ablation Study

Evaluating performance across isolated feature subsets:

| Feature Subset | Accuracy | Breach Recall | F1-Score | ROC-AUC |
| :--- | :---: | :---: | :---: | :---: |
| **A. Text Only** | 0.6190 | 0.6261 | 0.7129 | 0.6489 |
| **B. Structured Only (Temporal/Dept)** | 0.7937 | 0.7731 | 0.8499 | 0.8901 |
| **C. Spatial Only (Hotspot/Coords)** | 0.5587 | 0.4769 | 0.6202 | 0.6470 |
| **D. Severity Only (Comp 4 Predict)** | 0.6127 | 0.6303 | 0.7109 | 0.6073 |
| **E. Full Multimodal (Ours)** | **0.8619** | **0.9013** | **0.9079** | **0.9199** |

---

## 8. Independent Unseen Stress Test ($N = 25$)

To evaluate qualitative stress performance, 25 un-synthesized complaint scenarios (off-hours sewage leaks, weekend electrical hazards, daytime minor garbage reports) were evaluated:

- **Overall Classification Accuracy**: **100.00%** (25/25 correctly categorized).
- **High-Risk Breach Recall Rate**: **100.00%** (19/19 high-risk off-hours/hotspot cases identified).

---

## 9. Batch Inference & Scalability Benchmark

Batch inference performance evaluated on Python ML server:

- **Single-Sample API Latency**: **67.08 ms / request**
- **1,000 Batch Inference**: 0.110 seconds (**9,077 req/sec**)
- **10,000 Batch Inference**: 0.186 seconds (**53,676 req/sec**)
- **100,000 Batch Inference**: 1.215 seconds (**82,328 req/sec**, sub-millisecond per complaint)

---

## 10. System Architecture & Workflow Integration

1. **Python ML Server**: Serves `POST /predict-sla-breach` on port 8000 via [api.py](file:///c:/Users/nithi/OneDrive/Documents/Smart-Grievance-System/ml/sla_prediction/api.py) and [server.py](file:///c:/Users/nithi/OneDrive/Documents/Smart-Grievance-System/ml/server.py).
2. **Frontend Service**: Integrated via [slaPredictionService.js](file:///c:/Users/nithi/OneDrive/Documents/Smart-Grievance-System/src/services/ai/slaPredictionService.js) with client-side fallback.
3. **Firestore Schema**: Stores `aiSlaPrediction` metadata on `createGrievance` in [grievanceService.js](file:///c:/Users/nithi/OneDrive/Documents/Smart-Grievance-System/src/services/firebase/grievanceService.js).
4. **Officer Action Station**: Displays an early-warning AI SLA Risk alert badge in [OfficerActionPage.jsx](file:///c:/Users/nithi/OneDrive/Documents/Smart-Grievance-System/src/pages/officer/OfficerActionPage.jsx) alongside the dual SLA clocks.

---

## 11. Conclusion
Component 5 successfully delivers a scientifically validated, leakage-controlled AI SLA Breach Prediction engine with 86.19% held-out test accuracy, 90.13% breach recall, and sub-millisecond batch throughput, providing municipal officers with proactive early warnings before SLA deadlines elapse.
