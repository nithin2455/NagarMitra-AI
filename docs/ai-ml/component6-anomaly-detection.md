# Component 6 — AI Anomaly & Suspicious Pattern Detection: Research Report & System Documentation

## Executive Summary
This report presents the research-grade design, implementation, and evaluation of **Component 6 — AI Anomaly & Suspicious Pattern Detection** for the CivicPulse Smart Public Grievance Management Platform. Using an unsupervised `IsolationForest` model, the framework identifies unusual operational complaint spikes, spatial concentrations, duplicate density deviations, severity shifts, and SLA risk concentrations across aggregated municipal operational time windows.

---

## 1. Problem Statement & Research Framing
In municipal operations, identifying abnormal grievance activity is essential for detecting natural emergencies (e.g. monsoon flooding, pipe bursts), coordinated citizen reporting, infrastructure failures, or system abuse.

### Research Framing & Scope
- **Framework Scope**: An integrated multimodal anomaly detection framework for identifying unusual spatial, temporal, operational, and complaint-pattern behavior in municipal grievance systems.
- **Anomaly vs. Fraud Distinction**: The AI model detects **Anomalous Activity** ($P_{\text{isolation}} \ge \text{threshold}$). It NEVER automatically accuses citizens or departments of "fraud." Only authorized administrators can determine whether an anomaly reflects a real crisis or operational abuse.
- **Output Metrics**: Calibrated **Anomaly Score** ($[0.0, 1.0]$) and **Anomaly Level** (`LOW`, `MEDIUM`, `HIGH`). No fake "fraud probability" is ever generated.

---

## 2. Unit of Analysis & Feature Engineering

### Unit of Analysis
Aggregated operational windows ($t = 4\text{-hour}$ or daily time slots per municipal department) rather than isolated un-aggregated single complaints.

### Multimodal Feature Space (18 Numerical + Categorical Features)
1. **Temporal Volume**: `raw_report_count`, `complaints_last_24h`, `complaints_last_7d`, `rate_of_change` (trend delta vs rolling mean), `hour`, `day_of_week`, `is_weekend`.
2. **Component 2 Master / Duplicate**: `master_issue_count`, `duplicate_ratio` ($\frac{\text{raw} - \text{master}}{\text{raw}}$), `reports_per_master_issue`.
3. **Component 3 Spatial & Density**: `hotspot_score`, `local_density`, `cluster_size`, `latitude`, `longitude`.
4. **Component 4 Severity Distribution**: `critical_count`, `high_count`, `critical_ratio` ($\frac{\text{critical}}{\text{raw}}$).
5. **Component 5 SLA Risk Concentration**: `high_sla_risk_count`, `high_sla_risk_ratio` ($\frac{\text{high\_sla\_risk}}{\text{raw}}$).
6. **Categorical Encodings**: One-Hot Encoded `department_code`, `time_slot`.

---

## 3. Dataset Provenance & Reproducible Splits

### Operational Benchmark Dataset ($N = 4,200$ Operational Windows)
- **Provenance**: Semi-synthetic municipal operational window dataset constructed from CivicPulse department categories, spatial density distributions, and historical volume patterns over 180 days.
- **Chronological Data Splits**:
  - `data/splits/anomaly_train.csv` ($N = 2,940$, Days 1–126)
  - `data/splits/anomaly_val.csv` ($N = 630$, Days 127–153)
  - `data/splits/anomaly_test.csv` ($N = 630$, Days 154–180)

### Controlled Synthetic Anomaly Benchmark ($N = 200$)
- **Provenance**: Completely separate synthetic dataset (100 normal operational windows + 100 labeled synthetic anomaly spikes: volume spikes, extreme spatial concentration, 98% duplicate ratio, critical severity spikes, SLA risk spikes). Used exclusively for controlled benchmark evaluation.

---

## 4. Isolation Forest Methodology & Calibrated Scoring

- **Algorithm**: `sklearn.ensemble.IsolationForest(n_estimators=200, contamination=0.05, max_samples='auto', random_state=42, n_jobs=-1)`.
- **Decision Function Transformation**:
  $$\text{anomaly\_score} = \frac{1}{1 + \exp(\text{decision\_function} \cdot 8)}$$
- **Level Thresholds**:
  - $\text{Score} < 0.50 \implies \text{LOW}$
  - $0.50 \le \text{Score} < 0.75 \implies \text{MEDIUM}$
  - $\text{Score} \ge 0.75 \implies \text{HIGH}$

---

## 5. Leakage-Controlled Baseline Comparisons (Operational Test Set $N = 630$)

Baselines compute thresholds strictly from training set statistics ($\mu_{\text{train}}, \sigma_{\text{train}}$) to prevent future-data leakage:

| Method | Threshold Source | Detected Anomalies | Detection Rate |
| :--- | :--- | :---: | :---: |
| **Historical Mean + 3SD Spike Detector** | Train Set Mean + 3SD | 11 | 1.75% |
| **Rolling Z-Score ($Z \ge 3.0$)** | Train Set StdDev | 11 | 1.75% |
| **Isolation Forest (Multimodal Ours)** | Contamination 0.05 | **36** | **5.71%** |

*Finding*: Isolation Forest detects complex multivariate anomalies (such as high duplicate concentrations or SLA risk clusters with normal raw volume) that simple 1D volume spike detectors miss.

---

## 6. Controlled Synthetic Benchmark Evaluation ($N = 200$)

Evaluated on the separate $N = 200$ controlled synthetic benchmark dataset:

- **Accuracy**: **87.00%**
- **Precision**: **94.05%**
- **Recall (Detection Rate)**: **79.00%**
- **F1-Score**: **85.87%**
- **ROC-AUC**: **0.9563**
- **PR-AUC**: **0.9433**

---

## 7. Subsampling Stability Analysis

Tested over 10 random seeds using Jaccard similarity of top 5% detected anomalies:

- **Mean Jaccard Similarity (80% Subsample)**: **0.7269**
- **Mean Jaccard Similarity (90% Subsample)**: **0.8745**

*Conclusion*: The Isolation Forest ranking displays high stability and consistency under data subsampling.

---

## 8. Top-10 Operational Anomalies & Contributing Indicators

Sample top anomalies identified on the operational test set:

| Window ID | Department | Raw Vol | Dup Ratio | Score | Level | Pattern Type | Key Contributing Indicator |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- | :--- |
| `WIN-4958` | Sanitation | 30 | 30% | 0.6382 | MEDIUM | VOLUME_SPIKE | Volume 3.0x historical baseline |
| `WIN-4560` | Roads | 18 | 22% | 0.6222 | MEDIUM | NORMAL_PATTERN | Multivariate temporal deviation |
| `WIN-5155` | Sanitation | 23 | 61% | 0.6063 | MEDIUM | VOLUME_SPIKE | Volume 2.3x baseline & high dup ratio |
| `WIN-5038` | Drainage | 13 | 31% | 0.5696 | MEDIUM | SLA_RISK_SPIKE | 77% high SLA breach risk ratio |

---

## 9. Scalability & Inference Throughput

Benchmarked on Python ML server:

- **Single-Sample API Latency**: **11.191 ms / request**
- **1,000 Observation Batch**: 0.022 seconds (**46,059 obs/sec**)
- **10,000 Observation Batch**: 0.065 seconds (**153,560 obs/sec**)
- **100,000 Observation Batch**: 0.603 seconds (**165,758 obs/sec**, ~0.006 ms per observation)

---

## 10. System Architecture & Admin Dashboard Integration

1. **Python ML Server**: Serves `POST /predict-anomaly` and `POST /analyze-anomalies` on port 8000 via [api.py](file:///c:/Users/nithi/OneDrive/Documents/Smart-Grievance-System/ml/anomaly_detection/api.py) and [server.py](file:///c:/Users/nithi/OneDrive/Documents/Smart-Grievance-System/ml/server.py).
2. **Frontend Service**: Integrated via [anomalyDetectionService.js](file:///c:/Users/nithi/OneDrive/Documents/Smart-Grievance-System/src/services/ai/anomalyDetectionService.js) with client-side fallback.
3. **Admin Anomaly Dashboard**: Dedicated route `/admin/anomalies` implemented in [AdminAnomalyPage.jsx](file:///c:/Users/nithi/OneDrive/Documents/Smart-Grievance-System/src/pages/admin/AdminAnomalyPage.jsx) and registered in [AppRoutes.jsx](file:///c:/Users/nithi/OneDrive/Documents/Smart-Grievance-System/src/routes/AppRoutes.jsx).
4. **Admin Review Workflow**: Authorized admins can review anomaly details, inspect contributing indicators, and record determinations (`REVIEWED`, `EXPLAINED`, `LEGITIMATE_EVENT`, `NEEDS_INVESTIGATION`).

---

## 11. Conclusion
Component 6 completes the 6-part AI/ML architecture for CivicPulse, providing an unsupervised, scalable, and explainable Isolation Forest anomaly detection engine with 0.9563 synthetic ROC-AUC and 165,758 obs/sec batch throughput, empowering municipal administrators to investigate operational anomalies proactively while preserving strict non-accusatory governance principles.
