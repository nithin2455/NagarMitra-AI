# CivicPulse AI/ML Architecture — Component to Dataset Mapping Report

**Document Status:** Complete (Step 2: Dataset Research & Selection)  
**Target System:** CivicPulse Smart Municipal Grievance System  
**Scope:** Mapping 6 AI/ML Architecture Components to Selected Datasets and Feature Engineering Strategies  

---

## Executive Summary

This document establishes the formal mapping between the 6 core components of the CivicPulse AI/ML research architecture and the public datasets evaluated in `docs/ai-ml/dataset-research.md`. It outlines the required attributes, primary/backup datasets, missing field solutions, and feature alignment strategies to ensure high scientific rigor without altering the existing CivicPulse application code or Firestore schemas.

---

## Component-to-Dataset Mapping Breakdown

### Component 1: Complaint Classification (TF-IDF + SVM Baseline vs. BERT / mBERT)

* **Operational Target:** Automatically categorize incoming citizen complaint text into one of CivicPulse's 7 official departments (`roads`, `drainage`, `garbage`, `water`, `streetlights`, `infrastructure`, `other`).
* **Required Input Attributes:** Raw text string (`title` + `description`), ground truth category label (`categoryId`).
* **Candidate Datasets:**
  * **Primary:** Kaggle Indian Citizen Grievance Dataset (`citizen-grievance-dataset`)
  * **Multilingual Benchmark:** AI4Bharat IndicNLP Tamil News/Civic Corpus (`ai4bharat/indic_glue`)
  * **Backup / Large-Scale:** NYC 311 `Descriptor` / `Complaint Type` Text Subset
* **Missing Fields & Gaps:**
  * External category names do not match CivicPulse 7 department IDs (e.g. `Pothole` -> `roads`, `Sewage Overflow` -> `drainage`, `Litter Trash` -> `garbage`, `Pipe Burst` -> `water`, `Dark Streetlight` -> `streetlights`, `Damaged Bus Stop` -> `infrastructure`).
* **Alignment & Feature Engineering Strategy:**
  * Define a deterministic category lookup dictionary mapping external category strings to CivicPulse department keys (`roads`, `drainage`, `garbage`, `water`, `streetlights`, `infrastructure`, `other`).
  * Concatenate complaint `title` and `description` into a single normalized text field.
  * Evaluate baseline using TF-IDF (1-3 n-grams) + Linear SVM.
  * Evaluate advanced model using fine-tuned `bert-base-uncased` (English) and `mBERT`/`IndicBERT` (Tamil & English code-mixed).

---

### Component 2: Image Duplicate Detection (pHash vs. CNN / CLIP Visual Embeddings)

* **Operational Target:** Detect whether a newly uploaded complaint image is a duplicate or near-duplicate of an existing open grievance (e.g. rotated, re-cropped, lighting-altered, or same defect photo submitted multiple times).
* **Required Input Attributes:** High-resolution image binary / file path (`mediaUrl`), image ID, ground truth pair similarity label (duplicate / unique).
* **Candidate Datasets:**
  * **Primary:** Kaggle / Roboflow Municipal Road Damage & Waste Image Dataset (`Road Issues Detection`)
  * **Deduplication Benchmark:** MirFlickr / CDVS Image Deduplication Benchmark
* **Missing Fields & Gaps:**
  * Raw image datasets lack pre-labeled visual duplicate pairs specifically created for municipal complaint workflows.
* **Alignment & Feature Engineering Strategy:**
  * Construct a controlled evaluation pair set from the municipal image dataset:
    - **Exact Duplicates:** Unmodified original photos.
    - **Near-Duplicates:** Controlled spatial/photometric transformations (brightness alteration ±20%, crop 90%, rotation ±5°, resizing).
    - **Non-Duplicates:** Photos of distinct defects within the same department.
  * Compare **pHash (Perceptual Hash - DCT method)** hamming distance baseline against **ResNet-50 / CLIP visual feature vector cosine similarity**.

---

### Component 3: Location Clustering (DBSCAN)

* **Operational Target:** Group localized geographic clusters of complaints (e.g. multiple pothole or sewage reports within 50–100 meters) to detect major spatial hotspots and recommend bulk officer dispatch.
* **Required Input Attributes:** Spatial coordinates (`latitude`, `longitude`), timestamp (`createdAt`), category (`categoryId`).
* **Candidate Datasets:**
  * **Primary:** NYC 311 Service Request Dataset (`Latitude`, `Longitude` high-precision spatial records)
  * **Backup / Local Validation:** Chicago 311 Service Request Dataset (`LATITUDE`, `LONGITUDE`)
* **Missing Fields & Gaps:**
  * NYC/Chicago lat/lng points fall within US geographic bounds (e.g., 40.7128° N, 74.0060° W for NYC), whereas CivicPulse operates in Indian/Chennai context (e.g. 13.0827° N, 80.2707° E).
* **Alignment & Feature Engineering Strategy:**
  * Convert lat/lng coordinates to standard Haversine spatial distance metric (in meters).
  * Run DBSCAN with `eps = 0.05 km` (50 meters) and `min_samples = 3` to detect spatial defect density.
  * For local visualization testing, apply an isometric coordinate offset transformation mapping relative spatial point distributions onto Chennai municipal ward boundaries without altering algorithm physics.

---

### Component 4: Severity Prediction (Random Forest)

* **Operational Target:** Predict the initial risk severity level (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`) for a new complaint based on text urgency keywords, department risk score, and historical complaint density.
* **Required Input Attributes:** Category base risk score (`baseRiskScore`), text complaint urgency features, location density, user support count (`supportCount`).
* **Candidate Datasets:**
  * **Primary:** Kaggle Indian Citizen Grievance Dataset (`urgency_level` ground truth)
  * **Secondary Benchmark:** NYC 311 `Impact/Urgency` descriptor dataset
* **Missing Fields & Gaps:**
  * Numerical severity labels are formatted differently across datasets (e.g. High/Medium/Low vs 1-5 scale).
* **Alignment & Feature Engineering Strategy:**
  * Map ground truth urgency tags into CivicPulse's 4-tier `SEVERITY_LEVELS` (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`).
  * Feature Vector: `[category_base_risk_score, text_urgency_score, support_count, spatial_cluster_flag]`.
  * Train and evaluate Random Forest Classifier against Decision Tree baseline.

---

### Component 5: SLA Breach Prediction (Random Forest)

* **Operational Target:** Predict early (upon submission or assignment) whether a grievance is at high risk of breaching its SLA resolution deadline (`resolutionSlaHours`), enabling proactive officer reassignment or early warning generation.
* **Required Input Attributes:** Created timestamp (`createdAt`), Category SLA hours (`defaultResolutionHours`), Department ID (`departmentId`), Day of week / hour of day, Assigned officer workload.
* **Candidate Datasets:**
  * **Primary:** NYC 311 Service Requests (`Created Date`, `Closed Date`, `Due Date`, `Agency`)
  * **Backup:** Chicago 311 Service Requests (`CREATED_DATE`, `CLOSED_DATE`)
* **Missing Fields & Gaps:**
  * SLA breach target variable is not explicitly pre-calculated in raw public datasets.
* **Alignment & Feature Engineering Strategy:**
  * Compute Target Variable: `sla_breached = 1 if (closed_date - created_date) > allocated_sla_hours else 0`.
  * Extract temporal features: `hour_of_day`, `day_of_week`, `is_weekend`, `department_code`, `category_id`.
  * Train Random Forest Classifier with class weight balancing (to handle SLA breach imbalance).

---

### Component 6: Anomaly Detection (Isolation Forest)

* **Operational Target:** Identify anomalous complaint patterns, such as sudden artificial spikes in single-user submissions, unnatural officer resolution speed (e.g. closing tickets in 2 minutes), or unusual spatial clusters.
* **Required Input Attributes:** Resolution time duration (`resolution_time_minutes`), filing frequency per user/ward, evidence verification score.
* **Candidate Datasets:**
  * **Primary:** NYC 311 Service Requests (Resolution duration distribution & ticket submission rates)
  * **Supplementary:** CivicPulse execution log metrics (Audit logs)
* **Missing Fields & Gaps:**
  * Public datasets do not explicitly label fraudulent or malicious administrative behavior.
* **Alignment & Feature Engineering Strategy:**
  * Feature Engineering: `[resolution_time_hours, user_submission_rate_24h, spatial_distance_from_ward_center, follow_up_count]`.
  * Train **Isolation Forest** (unsupervised anomaly detection) with contamination parameter `contamination = 0.03` (3% anomaly rate).
  * Evaluate decision boundaries and feature attribution for detected outlier records.

---

## Summary Mapping Table

| Component | AI/ML Technique | Primary Selected Dataset | Target Field / Variable | Key Feature Engineering |
|---|---|---|---|---|
| **1. Classification** | TF-IDF + SVM vs. BERT/mBERT | Kaggle Indian Grievances + IndicNLP Tamil | `categoryId` (7 classes) | Deterministic category dictionary mapping, text concatenation |
| **2. Image Deduplication** | pHash vs. CNN/CLIP | Kaggle/Roboflow Road/Waste Images | `is_duplicate` (0/1) | Synthetic near-duplicate image pair generation |
| **3. Location Clustering** | DBSCAN | NYC 311 Spatial Subset | Spatial Cluster ID | Haversine metric, `eps = 50m`, `min_samples = 3` |
| **4. Severity Prediction** | Random Forest | Kaggle Indian Grievances | `severity` (4 tiers) | Feature vector: `[base_risk, text_urgency, support_count]` |
| **5. SLA Breach Prediction** | Random Forest | NYC 311 Operational Timestamps | `sla_breached` (0/1) | Target: `(closed_date - created_date) > sla_hours` |
| **6. Anomaly Detection** | Isolation Forest | NYC 311 Resolution Logs | Anomaly Score (-1 / 1) | Features: `[resolution_duration, submission_rate, spatial_offset]` |

---

## Final Dataset Selection Recommendation

To ensure **100% scientific validity**, **reproducibility**, and **alignment with Indian municipal context**:

1. **Text & Multilingual Foundation:** Combine **Kaggle Indian Citizen Grievance Dataset** (for English/Indic text complaints) with **AI4Bharat IndicNLP Tamil Corpus** (for mBERT Tamil model validation).
2. **Operational, SLA, Spatial & Anomaly Analytics Foundation:** Use a structured 100,000-record sample of the **NYC 311 Municipal Open Dataset**, mapped directly to CivicPulse's 7 department categories (`roads`, `drainage`, `garbage`, `water`, `streetlights`, `infrastructure`, `other`) and SLA durations (`18h`, `24h`, `36 hours`, `72 hours`, `168 hours`).
3. **Visual Deduplication Foundation:** Use the **Kaggle/Roboflow Municipal Road Damage & Waste Image Dataset** evaluated across pHash and CLIP embeddings.

This combination covers **all 6 ML components**, requires **zero synthetic fake data claims**, maintains **strict department isolation**, and preserves the existing CivicPulse application code and database schemas.
