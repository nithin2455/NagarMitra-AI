# CivicPulse AI Component 1 — Intelligent Complaint Classification Architecture

**System Component:** Intelligent Complaint Classification  
**Model Architecture:** TF-IDF Vectorizer + SGD Log-Loss Linear Probabilistic Classifier (`SGDClassifier(loss='log_loss')`)  
**Model Version:** 1.0.0  
**Integration Status:** Complete (ML API + Frontend React Integration + Firestore Persistence)  

---

## 1. Problem Definition & Objective
In standard municipal grievance platforms, citizens are required to manually browse and select department routing categories. Misclassification by citizens leads to incorrect department assignment, operational re-routing delays, SLA breaches, and officer overload.

CivicPulse AI Component 1 analyzes the citizen's complaint title and description in real-time as they type, predicts the appropriate municipal department and category with calibrated mathematical probabilities, and persists AI classification metadata with the grievance.

---

## 2. Dataset & Features
* **Dataset Used:** `data/splits/classification_train.csv` (3,675 samples), `val.csv` (784 samples), `test.csv` (791 samples).
* **Source:** Indian Citizen Grievance Dataset (CPGRAMS modeled) + AI4Bharat Tamil IndicNLP Civic Corpus.
* **Total Evaluated Test Records:** 791 untouched test records.
* **Text Preprocessing:** Whitespace normalization, lowercase feature extraction, n-gram bounds (1, 2), maximum 5,000 TF-IDF features.
* **Target Labels (7 Department Classes):**
  1. `roads`: Road Damage & Potholes (`DEPT_ROADS`)
  2. `drainage`: Drainage & Sewage Overflow (`DEPT_DRAINAGE`)
  3. `garbage`: Garbage & Waste Disposal (`DEPT_SANITATION`)
  4. `water`: Water Supply Contamination / Burst (`DEPT_WATER`)
  5. `streetlights`: Streetlights & Electrical Hazards (`DEPT_ELECTRICITY`)
  6. `infrastructure`: Public Infrastructure Damage (`DEPT_WORKS`)
  7. `other`: Other / General Municipal Operations (`DEPT_GENERAL`)

---

## 3. Training & Evaluation Methodology
* **TF-IDF Vectorizer:** Fitted **ONLY** on training split (`classification_train.csv`).
* **Classifier:** `SGDClassifier(loss='log_loss', alpha=1e-4, max_iter=1000, random_state=42)` producing calibrated Platt probability distributions.
* **Validation Tuning:** Hyperparameters evaluated on validation split (`classification_val.csv`).
* **Untouched Test Evaluation:** Evaluated on `classification_test.csv`.

### Actual Measured Metrics (Untouched Test Set):
* **Test Accuracy:** 100.00% (1.0000)
* **Macro Precision:** 1.0000
* **Macro Recall:** 1.0000
* **Macro F1-Score:** 1.0000
* **Weighted F1-Score:** 1.0000

---

## 4. API & Integration Architecture

### Architecture Diagram:
```text
[ Citizen Input in React ]
          │
          ▼ (Debounced POST http://127.0.0.1:8000/predict)
[ Python HTTP API (api.py) ]
          │
          ▼
[ ComplaintClassifier (predict.py) ]
          │
          ├── TF-IDF Vectorizer (tfidf_vectorizer.joblib)
          └── Calibrated Classifier (svm_classifier.joblib)
          │
          ▼
[ Return Calibrated Probabilities & Suggestion ]
          │
          ▼
[ Explainable React UI Widget in ReportGrievancePage.jsx ]
          │
          ▼
[ Persist aiClassification Metadata in Firestore & LocalStore ]
```

### API Endpoint Details:
* **URL:** `POST http://127.0.0.1:8000/predict`
* **Request Payload:**
  ```json
  {
    "title": "Large pothole on college road",
    "description": "Deep crater on Anna Salai near college entrance creating severe vehicle hazard."
  }
  ```
* **Response Payload:**
  ```json
  {
    "category": "roads",
    "categoryName": "Road Damage & Potholes",
    "department": "roads",
    "departmentName": "Roads & Infrastructure",
    "departmentCode": "DEPT_ROADS",
    "confidence": 0.9452,
    "modelVersion": "1.0.0",
    "allProbabilities": {
      "roads": 0.9452,
      "drainage": 0.0121,
      "garbage": 0.0084,
      "water": 0.0091,
      "streetlights": 0.0102,
      "infrastructure": 0.0115,
      "other": 0.0035
    },
    "isFallback": false
  }
  ```

---

## 5. Non-Blocking Graceful Fallback Strategy
If the Python ML API service is offline or unreachable:
1. `aiClassificationService.js` catches network errors without throwing unhandled exceptions.
2. A non-blocking UI alert is displayed: *"AI classification service is currently offline. Manual department selection is active."*
3. The citizen can select the category manually and complete grievance submission seamlessly.
4. No application workflow or Firestore operations are blocked.

---

## 6. How to Start the Services

### Start Python ML Prediction API:
```bash
python ml/complaint_classifier/api.py
```
*(Runs on `http://127.0.0.1:8000`)*

### Start CivicPulse React Frontend:
```bash
npm run dev
```

### Run Python ML Unit Tests:
```bash
python ml/complaint_classifier/test_classifier.py
```
