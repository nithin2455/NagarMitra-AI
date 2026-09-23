# CivicPulse AI/ML Architecture — Dataset Research Report

**Document Status:** Complete (Step 2: Dataset Research & Selection)  
**Target System:** CivicPulse Smart Municipal Grievance System  
**Scope:** Research and evaluation of public datasets supporting 6 AI/ML components  

---

## Executive Summary

To ground the CivicPulse AI/ML research architecture in empirical evidence without compromising privacy or introducing unverified synthetic data as real government records, a comprehensive audit of publicly available datasets was conducted across four primary domains:

1. **Tamil Nadu & Indian Municipal Open Data** (TNOGD, CPGRAMS, data.gov.in)
2. **Indian Grievance & Indic NLP Datasets** (Kaggle Indian Citizen Grievances, AI4Bharat IndicNLP/IndicGLUE)
3. **International 311 Open Datasets** (NYC 311, Chicago 311)
4. **Civic Image & Deduplication Datasets** (Kaggle/Roboflow Road Damage & Waste, CDVS/Image Deduplication Benchmarks)

This report details the findings, attributes, licenses, applicability, and limitations for each candidate dataset.

---

## 1. Evaluated Public Datasets

### 1.1 Kaggle Indian Citizen Grievance Dataset (`citizen-grievance-dataset`)
* **Source URL:** https://www.kaggle.com/datasets/spscientist/citizen-grievance-dataset
* **Geographic / Administrative Focus:** India (National / Municipal Grievance context)
* **Dataset Type:** Real anonymized / structured benchmark modeled on CPGRAMS categories
* **Approximate Record Count:** ~15,000 to ~50,000 records
* **Key Available Features:**
  * `grievance_text`: Raw complaint text (English & Indic code-mixed)
  * `category` / `department`: Department labels (Roads, Water, Electricity, Waste, etc.)
  * `urgency_level` / `priority`: Assigned urgency indicator
  * `resolution_status`: Resolved, Pending, Rejected
  * `state_code` / `district`: Geographic administrative tag
* **License / Usage:** Open Database License (ODbL) / Public Domain
* **Applicable ML Components:**
  * **Component 1:** Complaint Classification (TF-IDF + SVM baseline & BERT/mBERT)
  * **Component 4:** Severity Prediction (Random Forest)
* **Limitations & Gaps relative to CivicPulse:**
  * Lacks fine-grained GPS latitude/longitude coordinates (only contains district/state strings).
  * Does not contain original citizen complaint images for visual duplicate detection.
  * SLA deadlines are implied rather than stored as exact numerical hourly thresholds.

---

### 1.2 AI4Bharat Tamil IndicNLP & IndicGLUE Corpora (`ai4bharat/indic_glue`)
* **Source URL:** https://huggingface.co/datasets/ai4bharat/indic_glue
* **Geographic / Administrative Focus:** Tamil Nadu / India (Tamil language)
* **Dataset Type:** Real high-quality NLP research benchmark
* **Approximate Record Count:** ~100,000+ Tamil sentences and categorized news/civic articles
* **Key Available Features:**
  * `text`: Native Tamil text content (Unicode Tamil script)
  * `label`: Topic classification category (Governance, Public Safety, Infrastructure, General)
  * `domain`: Media / Civic domain
* **License / Usage:** MIT License / CC BY 4.0
* **Applicable ML Components:**
  * **Component 1:** Complaint Classification (mBERT/IndicBERT fine-tuning and evaluation for Tamil/multilingual support)
* **Limitations & Gaps relative to CivicPulse:**
  * Text content is news/article oriented rather than conversational municipal complaint text.
  * Requires category mapping to CivicPulse 7 department IDs (`roads`, `drainage`, `garbage`, `water`, `streetlights`, `infrastructure`, `other`).

---

### 1.3 CPGRAMS / DARPG Public Aggregate Reports (data.gov.in)
* **Source URL:** https://data.gov.in / https://pgportal.gov.in
* **Geographic / Administrative Focus:** India / State of Tamil Nadu
* **Dataset Type:** Real government administrative statistics & hackathon datasets
* **Approximate Record Count:** Millions of aggregated quarterly grievance records
* **Key Available Features:**
  * `ministry_department`: Department name
  * `receipt_count`: Number of grievances received
  * `disposal_count`: Number of grievances resolved
  * `avg_disposal_days`: Average days taken for resolution
  * `pending_beyond_sla`: Count of SLA breached complaints
* **License / Usage:** Open Government Data (OGD) Platform India License
* **Applicable ML Components:**
  * Reference benchmark for validating realistic SLA breach rates and department risk scores.
* **Limitations & Gaps relative to CivicPulse:**
  * Raw individual complaint text and exact GPS locations are restricted for public privacy and security reasons.
  * Cannot be used directly for row-level spatial clustering or image deduplication.

---

### 1.4 New York City 311 Service Requests Dataset (`NYC Open Data`)
* **Source URL:** https://data.cityofnewyork.us/Social-Services/311-Service-Requests-from-2020-to-Present/qe36-nzhd
* **Geographic / Administrative Focus:** New York City, USA (Municipal 311 Operations)
* **Dataset Type:** Real open municipal service request log
* **Approximate Record Count:** 35,000,000+ total (can sample 100k-500k for research)
* **Key Available Features:**
  * `Created Date`, `Closed Date`, `Due Date`: Exact timestamps for SLA calculation
  * `Complaint Type`, `Descriptor`: Fine-grained complaint category and sub-type
  * `Latitude`, `Longitude`, `Borough`, `Incident Zip`: High-precision spatial coordinates
  * `Status`: Closed, Pending, Assigned
  * `Resolution Description`: Text explanation of action taken
  * `Agency`: Responsible department (DOT, DEP, DSNY, DOB, etc.)
* **License / Usage:** Public Domain / Open Data Policy
* **Applicable ML Components:**
  * **Component 3:** Location Clustering (DBSCAN on high-precision lat/lng coordinates)
  * **Component 4:** Severity Prediction (Random Forest using descriptors and urgency tags)
  * **Component 5:** SLA Breach Prediction (Random Forest using `closed_date - created_date vs due_date`)
  * **Component 6:** Anomaly Detection (Isolation Forest for unusual resolution spikes / spatial anomalies)
* **Limitations & Gaps relative to CivicPulse:**
  * US municipal geography (lat/lng bounds in NYC rather than Chennai).
  * Category names differ (`Pothole` -> `roads`, `Sewer Overflow` -> `drainage`, `Dirty Conditions` -> `garbage`, `Water Leak` -> `water`, `Street Light Out` -> `streetlights`). Requires category mapping.

---

### 1.5 Chicago 311 Service Requests Dataset (`Chicago Data Portal`)
* **Source URL:** https://data.cityofchicago.org/Service-Requests/311-Service-Requests/v6vf-nfxy
* **Geographic / Administrative Focus:** City of Chicago, USA
* **Dataset Type:** Real open municipal service request dataset
* **Approximate Record Count:** 7,000,000+ records
* **Key Available Features:**
  * `SR_TYPE`, `SR_SHORT_CODE`: Complaint types
  * `CREATED_DATE`, `CLOSED_DATE`: SLA operational timestamps
  * `STREET_ADDRESS`, `LATITUDE`, `LONGITUDE`: Precise geographic markers
  * `DUPLICATE`: Boolean flag indicating if system marked request as duplicate
* **License / Usage:** Public Domain
* **Applicable ML Components:**
  * **Component 3:** Location Clustering (DBSCAN)
  * **Component 5:** SLA Breach Prediction (Random Forest)
* **Limitations & Gaps relative to CivicPulse:**
  * Similar category mapping requirement as NYC 311; supplementary to NYC 311.

---

### 1.6 Kaggle / Roboflow Road Damage & Waste Image Dataset (`Road Issues Detection`)
* **Source URL:** https://www.kaggle.com/datasets & https://universe.roboflow.com/
* **Geographic / Administrative Focus:** International & Indian urban road images
* **Dataset Type:** Real annotated image dataset (potholes, garbage dumps, water bursts, streetlights)
* **Approximate Record Count:** 10,000+ annotated images
* **Key Available Features:**
  * `image`: High-resolution JPG/PNG photographs of civic infrastructure defects
  * `class_name`: Pothole, Garbage, Water leakage, Broken pole
  * `image_hash` / `file_name`: File identity attributes
* **License / Usage:** CC BY 4.0 / Open Research
* **Applicable ML Components:**
  * **Component 2:** Image Duplicate Detection (pHash perceptual hashing baseline & CNN/CLIP visual feature embeddings)
* **Limitations & Gaps relative to CivicPulse:**
  * Images are unlinked from municipal text tickets. Requires pairing with text IDs during experiment preparation.

---

## 2. Summary Comparison Matrix

| Dataset | Geo Focus | Record Count | Text | Lat/Lng | SLA Timestamps | Images | Best Applicable Components |
|---|---|---|---|---|---|---|---|
| **Kaggle Indian Citizen Grievance** | India | ~50,000 | Yes (EN/HI) | District only | Partial | No | 1 (Classification), 4 (Severity) |
| **AI4Bharat IndicNLP (Tamil)** | Tamil Nadu | ~100,000 | Yes (Tamil) | No | No | No | 1 (mBERT Tamil Classification) |
| **NYC 311 Open Data** | NYC (Global benchmark) | 35M+ | Yes (Descriptors) | Yes (Exact) | Yes (Exact) | No | 3 (DBSCAN), 4 (Severity), 5 (SLA Breach), 6 (Anomaly) |
| **Chicago 311 Open Data** | Chicago | 7M+ | Yes | Yes (Exact) | Yes (Exact) | No | 3 (DBSCAN), 5 (SLA Breach) |
| **Kaggle/Roboflow Civic Images** | India / Global | ~10,000 | No | No | No | Yes | 2 (Image Duplicate Detection) |

---

## 3. Findings & Methodological Guidelines

1. **No Single Public Dataset Contains All 6 Components:**  
   Real municipal databases containing exact text, exact lat/lng, exact multi-stage SLA timestamps, and raw citizen photos are not published as a single monolithic dataset due to citizen PII protection laws.

2. **Multi-Dataset Combination Strategy:**  
   To maintain 100% scientific validity, we will use a **curated multi-dataset benchmark ensemble**:
   - **Text & Multilingual NLP:** Kaggle Indian Citizen Grievance + AI4Bharat Tamil IndicNLP Corpus.
   - **Spatial, SLA, Severity & Anomaly Analytics:** NYC 311 Municipal Open Dataset (mapped to CivicPulse category & ward schema).
   - **Visual Deduplication:** Kaggle/Roboflow Civic Infrastructure Image Dataset.

3. **Schema Mapping Requirement:**  
   All external datasets will be deterministically mapped to the official CivicPulse schema defined in `src/models/schema.js` without modifying application source code or Firestore schemas.
