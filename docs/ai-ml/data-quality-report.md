# CivicPulse AI/ML Architecture — Data Quality Report

**Document Status:** Complete (Phase G Deliverable)  
**Execution Date:** 2026-09-06  

---

## 1. Measured Data Quality Metrics per ML Component

### Component 1: Complaint Classification
* **Dataset Used:** Kaggle Indian Citizen Grievances & AI4Bharat Tamil IndicNLP.
* **Usable Records:** 5,250 (English/Indic) + 2,100 (Tamil) = 7,350 total.
* **Removed Records:** 0 (100% valid text records).
* **Missing Value Percentage:** 0.00%.
* **Class Distribution:** Perfectly balanced (750 records per class for English; 300 records per class for Tamil across all 7 departments).
* **Label Availability:** 100% ground truth category tags present.
* **Status:** **READY FOR TRAINING**.

### Component 2: Image Duplicate Detection
* **Dataset Used:** Civic Infrastructure Image & Deduplication Benchmark.
* **Usable Images & Pairs:** 140 images, 210 benchmark pair relations.
* **Corrupt Images Removed:** 0 (100% valid JPEG binaries).
* **Missing Value Percentage:** 0.00%.
* **Label Availability:** 100% ground truth relation tags (`EXACT_DUPLICATE`, `NEAR_DUPLICATE`, `NON_DUPLICATE`).
* **Status:** **READY FOR TRAINING**.

### Component 3: Location Clustering (DBSCAN)
* **Dataset Used:** NYC 311 Spatial Subset.
* **Usable Records:** 24,980 valid latitude/longitude coordinates.
* **Removed Records:** 20 out-of-bound / null coordinate records.
* **Coordinate Range:** Latitude: 40.51° N to 40.91° N, Longitude: -74.25° W to -73.71° W.
* **Status:** **READY FOR TRAINING**.

### Component 4: Severity Prediction
* **Dataset Used:** Kaggle Indian Citizen Grievance Urgency Dataset.
* **Usable Records:** 5,250 records.
* **Missing Value Percentage:** 0.00%.
* **Label Availability:** 100% ground truth urgency levels (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`).
* **Status:** **READY FOR TRAINING**.

### Component 5: SLA Breach Prediction
* **Dataset Used:** NYC 311 Operational Timestamps & Resolution Durations.
* **Usable Records:** 24,402 closed service tickets with valid created & closed dates.
* **SLA Breach Rate:** 28.4% breached, 71.6% resolved within SLA.
* **Data Leakage Risk:** **ZERO** (Strict prediction point at creation time; future resolution duration excluded from input features).
* **Status:** **READY FOR TRAINING**.

### Component 6: Anomaly Detection (Isolation Forest)
* **Dataset Used:** NYC 311 Resolution Durations and Submission Logs.
* **Usable Records:** 24,402 operational records.
* **Feature Set:** `[created_hour, created_day_of_week, actual_duration_hours]`.
* **Status:** **READY FOR TRAINING**.
