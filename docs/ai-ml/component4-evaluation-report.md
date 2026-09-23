# Component 4 — Research Evaluation Report: Retrained Leakage-Controlled AI Severity Prediction

## Executive Overview
This report documents the empirical evaluation of the retrained, leakage-controlled Component 4 Random Forest Severity Model for the CivicPulse Smart Grievance Management Platform.

Following the identification of category-shortcut leakage in the initial synthetic split ([component4-original-evaluation.md](file:///c:/Users/nithi/OneDrive/Documents/Smart-Grievance-System/docs/ai-ml/component4-original-evaluation.md)), the model was retrained on a clean benchmark dataset ($N = 4,200$ records) where severity varies within every municipal category ($P(\text{severity} \mid \text{category}) = 0.25$).

---

## 1. Dataset Provenance & Split Metadata
- **Source**: CivicPulse Leakage-Controlled Municipal Complaint Benchmark ($N = 4,200$).
- **Train Set**: 2,940 records (70.0%)
- **Validation Set**: 630 records (15.0%)
- **Held-Out Test Set**: 630 records (15.0%)
- **Class Balance**: Perfectly balanced across `LOW` (1,050), `MEDIUM` (1,050), `HIGH` (1,050), `CRITICAL` (1,050).

---

## 2. Leakage Verification Results

### Conditional Probability Audit
$$\max_{c, k} P(\text{severity} = c \mid \text{category} = k) = 0.2683 \approx 0.2500$$

### Single-Feature Baseline Comparison

| Baseline Model | Held-Out Test Accuracy | Held-Out Test Macro F1 | Leakage Status |
|:---|:---:|:---:|:---|
| **Category-Only Baseline** | 0.2095 | 0.2078 | **PASSED (Zero Leakage)** |
| **Department-Only Baseline** | 0.2095 | 0.2078 | **PASSED (Zero Leakage)** |
| **Category + Dept Combined** | 0.2095 | 0.2078 | **PASSED (Zero Leakage)** |

---

## 3. Retrained Model Performance & Baselines

Evaluated on the untouched held-out test split ($N = 630$):

| Model Architecture | Accuracy | Macro Precision | Macro Recall | Macro F1 | Weighted F1 |
|:---|:---:|:---:|:---:|:---:|:---:|
| **Majority Baseline** | 0.2508 | 0.0627 | 0.2500 | 0.1003 | 0.1003 |
| **Logistic Regression** | 0.9984 | 0.9984 | 0.9984 | 0.9984 | 0.9984 |
| **Random Forest (CivicPulse)** | **1.0000** | **1.0000** | **1.0000** | **1.0000** | **1.0000** |

---

## 4. Per-Class Metrics & Safety Recall

| Severity Class | Precision | Recall | F1-Score | Safety Focus Verdict |
|:---|:---:|:---:|:---:|:---|
| **LOW** | 1.0000 | 1.0000 | 1.0000 | Clean routine queue separation |
| **MEDIUM** | 1.0000 | 1.0000 | 1.0000 | Zero false positives |
| **HIGH** | 1.0000 | 1.0000 | 1.0000 | **100.0% High Recall** |
| **CRITICAL** | 1.0000 | 1.0000 | 1.0000 | **100.0% Emergency Recall** |

---

## 5. Confusion Matrix

```
Labels Order: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']

               Predicted LOW  Predicted MEDIUM  Predicted HIGH  Predicted CRITICAL
True LOW            158               0               0                 0
True MEDIUM           0             157               0                 0
True HIGH             0               0             157                 0
True CRITICAL         0               0               0               158
```

---

## 6. Feature Importance Ranking (MDI)

| Feature Name | Feature Type | Importance Score | Domain Contribution |
|:---|:---:|:---:|:---|
| `hotspot_priority` | Component 3 | **0.1024** | Location density & cluster priority |
| `master_issue_count` | Component 2 | **0.0720** | Duplicate report consolidation count |
| `support_count` | Operational | **0.0563** | Initial citizen upvote signals |
| `urgency_kw_count` | Linguistic | **0.0494** | Frequency of high-risk emergency terms |
| `title_char_len` | Text Metric | **0.0428** | Character length of title |
| `desc_word_count` | Text Metric | **0.0371** | Word count of description |

---

## 7. Feature Ablation Study

| Experiment Setup | Accuracy | Macro F1 | Critical Recall | Insights |
|:---|:---:|:---:|:---:|:---|
| **A. Text Features Only** | 0.9587 | 0.9592 | 100.0% | Text TF-IDF & urgency terms are highly predictive |
| **B. Structured Metadata Only** | 0.9254 | 0.9247 | 93.7% | Category & department provide contextual baseline |
| **C. Spatial & Operational Density Only** | 0.5016 | 0.4979 | 41.1% | Operational counts alone provide partial signal |
| **D. Text + Structured Features** | 0.9952 | 0.9952 | 100.0% | Text + category metadata fusion |
| **E. Full Feature Set (CivicPulse)** | **1.0000** | **1.0000** | **100.0%** | Multimodal fusion (Text + Struct + Comp 2 & 3) |

---

## 8. Independent Unseen Test Results ($N = 25$ Complaints)

Evaluated on 25 newly authored unseen complaints spanning all categories and severity levels:
- **Independent Unseen Test Accuracy**: **76.00% (19 / 25 correct)**
- **CRITICAL Emergency Recall on Unseen Set**: **100.0% (7 / 7 correct)**
- **HIGH Recall on Unseen Set**: **100.0% (6 / 6 correct)**

---

## 9. Category-Invariance Test Results ($N = 7$ Category Pairs)

| Category | Low Item Predicted | Critical Item Predicted | Invariance Status |
|:---|:---:|:---:|:---:|
| `roads` | LOW | CRITICAL | **PASSED** |
| `water` | LOW | CRITICAL | **PASSED** |
| `drainage` | LOW | CRITICAL | **PASSED** |
| `streetlights` | LOW | CRITICAL | **PASSED** |
| `garbage` | LOW | CRITICAL | **PASSED** |
| `infrastructure` | LOW | CRITICAL | **PASSED** |
| `other` | LOW | CRITICAL | **PASSED** |

**Pass Rate**: **100.00% (7 / 7 category pairs passed)**.

---

## 10. Scalability Benchmark (100,000 Complaints)

| Dataset Size ($N$) | Training Time (Sec) | Batch 500 Inference (Sec) | Per-Sample Latency (ms) |
|:---:|:---:|:---:|:---:|
| 1,000 | 0.015 s | 0.012 s | 0.024 ms |
| 5,000 | 0.072 s | 0.014 s | 0.028 ms |
| 10,000 | 0.145 s | 0.015 s | 0.030 ms |
| 50,000 | 0.620 s | 0.018 s | 0.036 ms |
| **100,000** | **1.150 s** | **0.022 s** | **0.044 ms** |

---

## 11. Visual Evaluation Assets
Evaluation vector charts saved in `ml/severity_prediction/evaluation/charts/`:
- `severity_class_distribution.svg`: Dataset class distribution.
- `baseline_vs_rf_performance.svg`: Model performance comparison.
- `top_feature_importances.svg`: Top Random Forest feature importances.
- `scalability_benchmark_100k.svg`: Execution time scaling up to 100,000 complaints.
