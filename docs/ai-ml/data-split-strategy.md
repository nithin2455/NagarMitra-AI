# CivicPulse AI/ML Architecture — Data Split Strategy Report

**Document Status:** Complete (Phase F Deliverable)  
**Execution Date:** 2026-09-06  
**Storage Directory:** `data/splits/`  

---

## 1. Component Split Methodology Matrix

| ML Component | Dataset | Split Type | Train Count (70%) | Val Count (15%) | Test Count (15%) | Anti-Leakage Prevention Rule |
|---|---|---|---|---|---|---|
| **1. Complaint Classification** | Kaggle Indian Grievance | Stratified Random | 3,675 | 784 | 791 | TF-IDF vocabulary fit ONLY on Train split |
| **1b. Tamil Classification** | AI4Bharat Tamil IndicNLP | Stratified Random | 1,470 | 315 | 315 | Tokenizer / mBERT embeddings fit ONLY on Train |
| **2. Image Deduplication** | Civic Image Pair Set | Pair-Stratified | 147 pairs | 31 pairs | 32 pairs | Zero overlap of test pair IDs in training set |
| **3. Location Clustering** | NYC 311 Spatial Points | Full Unsupervised | 10,000 spatial points | N/A | N/A | DBSCAN distance matrix computed on spatial features |
| **4. Severity Prediction** | Kaggle Indian Grievance | Stratified Random | 3,675 | 787 | 788 | Priority features restricted to submission point |
| **5. SLA Breach Prediction** | NYC 311 Operational Logs | **Chronological Time-based** | 6,617 | 1,418 | 1,419 | **CRITICAL:** No future timestamp feature allowed |
| **6. Anomaly Detection** | NYC 311 Resolution Logs | Full Unsupervised | 9,454 operational logs | N/A | N/A | Isolation Forest fit on training distribution |

---

## 2. Temporal Data Leakage Prevention Enforcement

### SLA Breach Model Prediction Point Definition:
* **Prediction Point:** At time of complaint creation (`created_at`).
* **Permitted Features:** `[department_id, created_hour, created_day_of_week, created_month, is_weekend, allowed_sla_hours]`.
* **EXCLUDED FEATURES (Forbidden Future Knowledge):** `closed_at`, `actual_duration_hours`, `closed_by`, `resolution_remarks`.
* **Target Label Construction:** `sla_breached = 1 if (closed_at - created_at) > allowed_sla_hours else 0` (used ONLY as target label `y`).
