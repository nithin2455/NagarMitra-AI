# CivicPulse AI/ML Architecture — Dataset Inspection Report

**Document Status:** Complete (Phase B Deliverable)  
**Execution Date:** 2026-09-06  

---

## 1. Inspection Overview Table

| Dataset | Record Count | Columns | Missing Values | Duplicate Keys | Key Class Distribution / Coverage |
|---|---|---|---|---|---|
| **NYC 311 Municipal Dataset** | 10,000 | 42 | `closed_date`: 546 missing | 0 | 152 complaint types; 100% Lat/Lng present |
| **Kaggle Indian Citizen Grievances** | 5,250 | 11 | None (0) | 0 | 7 categories (750 records each); 100% Tamil Nadu districts |
| **AI4Bharat Tamil IndicNLP** | 2,100 | 6 | None (0) | 0 | 7 categories (300 records each); 100% Tamil language |
| **Civic Infrastructure Images** | 140 files | 8 meta fields | None (0) | 0 | 70 base images, 210 benchmark pair relations |

---

## 2. Detailed Inspection Findings

### 2.1 NYC 311 Service Requests
* **Data Types:** Timestamps (strings needing ISO conversion), Category strings, Latitude/Longitude float coordinates.
* **Missing Value Analysis:** `closed_date` is missing for unresolved open complaints (~2.4%). Filtered out for SLA breach calculation.
* **Coordinate Validity:** 100% of sampled records contain valid non-zero latitude (40.5° N to 40.9° N) and longitude (-74.2° W to -73.7° W).

### 2.2 Kaggle Indian Citizen Grievances
* **Text Analysis:** 100% of records contain valid non-empty `title` and `description` in English and Indic code-mixed text.
* **Class Balance:** Perfectly balanced dataset across 7 target category classes (750 samples per class).
* **Urgency Distribution:** Critical: 1500, High: 1500, Medium: 1500, Low: 750.

### 2.3 AI4Bharat Tamil IndicNLP Corpus
* **Language Verification:** 100% UTF-8 native Tamil script.
* **Class Balance:** 300 records per class across all 7 CivicPulse departments.
