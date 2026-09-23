# Component 4 — Comprehensive Research Audit: Data Leakage, Dataset Validity & 100% Performance Audit

## Executive Summary
This document reports the comprehensive research audit of Component 4 (AI Severity / Priority Prediction using Random Forest).

The audit was conducted to investigate the initial reported performance of **100.00% Accuracy and 1.0000 Macro F1** across Random Forest, Logistic Regression, and feature ablation configurations.

### Audit Verdict: RED — Substantial Label-Construction Leakage & Dataset Artifact
The 100.00% test performance is **scientifically un-defensible for real-world deployment** because the underlying dataset was constructed using a deterministic rule mapping complaint categories directly to target severity labels:
- `drainage` & `water` $\rightarrow$ **100% CRITICAL**
- `roads` & `streetlights` $\rightarrow$ **100% HIGH**
- `garbage` & `infrastructure` $\rightarrow$ **100% MEDIUM**
- `other` $\rightarrow$ **100% LOW**

When evaluated on an independent, unseen sanity dataset where complaint severity genuinely varies within categories, model accuracy dropped from **100.00% to 14.29%**.

---

## 1. Dataset Provenance & Target Construction Analysis

### Dataset Metadata
- **Source Files**: `data/splits/severity_train.csv`, `severity_val.csv`, `severity_test.csv` ($N = 5,250$ records).
- **Format**: Structured CSV with fields `grievance_id`, `title`, `description`, `category_name`, `category_id`, `department_code`, `urgency_level`, `district`, `state`, `status`, `support_count`.

### Empirical Category vs Urgency Level Crosstab Audit

```
urgency_level   CRITICAL  HIGH  LOW  MEDIUM   All
category_id                                      
drainage             540     0    0       0   540  (100% CRITICAL)
water                510     0    0       0   510  (100% CRITICAL)
roads                  0   540    0       0   540  (100% HIGH)
streetlights           0   510    0       0   510  (100% HIGH)
garbage                0     0    0     540   540  (100% MEDIUM)
infrastructure         0     0    0     510   510  (100% MEDIUM)
other                  0     0  525       0   525  (100% LOW)
All                 1050  1050  525    1050  3675
```

**Finding**: `category_id` and `department_code` possess a $1.00$ Mutual Information score with `urgency_level`. The target label is a deterministic function of category.

---

## 2. Feature-to-Target Leakage Audit Table

| Feature Name | Feature Type | Available at Prediction Point? | Target-Derived? | Leakage Risk | Detailed Audit Finding |
|:---|:---:|:---:|:---:|:---:|:---|
| `category_id` | Categorical | Yes | Yes (Indirectly) | **CRITICAL** | Target was generated from category. Predicts target with 100% accuracy. |
| `department_code` | Categorical | Yes | Yes (Indirectly) | **CRITICAL** | Department maps 1-to-1 with category, inheriting target leakage. |
| `title` TF-IDF | Text | Yes | Yes (Template) | **HIGH** | Titles contain category strings (*"Water Supply..."*, *"Road Damage..."*). |
| `urgency_kw_count` | Linguistic | Yes | Partial | **MEDIUM** | Emergency words occur mostly in drainage/water complaint templates. |
| `support_count` | Operational | Yes | No | **LOW** | Low correlation with target ($28.3\%$ accuracy alone). |
| `master_issue_count` | Operational | Yes | No | **LOW** | Component 2 feature, safe at prediction point. |
| `hotspot_priority` | Operational | Yes | No | **LOW** | Component 3 feature, safe at prediction point. |

---

## 3. Single-Feature Baseline Experiment Results

To isolate the exact contribution of individual features, single-feature decision trees were evaluated on the held-out test split ($N = 745$):

| Single Feature Model | Held-Out Test Accuracy | Held-Out Test Macro F1 | Audit Interpretation |
|:---|:---:|:---:|:---|
| **1. Category ID Only** | **1.0000** | **1.0000** | **Direct Label Leakage Shortcut** |
| **2. Department Code Only** | **1.0000** | **1.0000** | **Direct Label Leakage Shortcut** |
| **3. TF-IDF Title Only** | **1.0000** | **1.0000** | **Category String Leakage in Titles** |
| 4. Urgency Keyword Count | 0.5557 | 0.3959 | Partial correlation with template words |
| 5. Support Count Only | 0.2832 | 0.2222 | Near-random majority baseline performance |

---

## 4. Explanation of 100% Model Performance

Both **Logistic Regression** and **Random Forest** achieved $1.0000$ Accuracy and $1.0000$ Macro F1 because:
1. `category_id` and `department_code` one-hot encodings form linearly separable hyperplane boundaries for the four severity classes.
2. TF-IDF features extract category name tokens from titles (*"Garbage"*, *"Road"*, *"Water"*), giving text-only models access to the exact category shortcut even when categorical features are removed!

---

## 5. Independent Unseen Sanity Test Results

To evaluate true real-world generalization, the trained model was tested on **14 newly authored complaints** where severity genuinely varies WITHIN categories (e.g. minor speed bump paint peeling vs Anna Salai road collapse; minor tap pressure drop vs industrial chemical water poisoning).

### Sanity Test Results Table

| Complaint ID | Category | Description Excerpt | True Human Severity | AI Predicted Severity | Confidence | Match Status |
|:---|:---:|:---|:---:|:---:|:---:|:---:|
| SANITY-01 | roads | Minor cosmetic paint peeling on speed breaker | LOW | **HIGH** | 42.0% | **MISMATCH** |
| SANITY-02 | roads | Catastrophic Anna Salai highway cave-in | CRITICAL | **HIGH** | 56.3% | **MISMATCH** |
| SANITY-03 | water | Slight tap water pressure drop in morning | LOW | **CRITICAL** | 50.0% | **MISMATCH** |
| SANITY-04 | water | Chemical effluent poisoning drinking supply | CRITICAL | **CRITICAL** | 81.6% | **MATCH** |
| SANITY-05 | drainage | Leaves on storm drain grate | LOW | **CRITICAL** | 44.5% | **MISMATCH** |
| SANITY-06 | drainage | Sewage main burst flooding hospital basement | CRITICAL | **CRITICAL** | 60.5% | **MATCH** |
| SANITY-07 | streetlights | Garden light flickering in public park | LOW | **MEDIUM** | 59.5% | **MISMATCH** |
| SANITY-08 | streetlights | 11kV live electrical wire lying across school gate | CRITICAL | **HIGH** | 54.0% | **MISMATCH** |
| SANITY-09 | garbage | Paper litter near park bench | LOW | **MEDIUM** | 75.5% | **MISMATCH** |
| SANITY-10 | garbage | Burning toxic medical waste near apartments | CRITICAL | **MEDIUM** | 61.5% | **MISMATCH** |
| SANITY-11 | infrastructure | Faded advertisement poster on shelter | LOW | **MEDIUM** | 69.5% | **MISMATCH** |
| SANITY-12 | infrastructure | Collapse of busy flyover bridge pillar | CRITICAL | **MEDIUM** | 51.5% | **MISMATCH** |
| SANITY-13 | other | Small tree branch touching compound wall | LOW | **MEDIUM** | 39.5% | **MISMATCH** |
| SANITY-14 | other | Rabid dogs attacking children outside school | CRITICAL | **MEDIUM** | 39.5% | **MISMATCH** |

### Sanity Accuracy Summary
- **Independent Unseen Sanity Accuracy**: **14.29% (2 / 14 correct)**
- **Diagnostic Finding**: The model predicts severity based strictly on category rules rather than understanding complaint urgency. For instance, any pothole complaint—no matter how minor—is classified as `HIGH`, while any water/sewage complaint—no matter how small—is classified as `CRITICAL`.

---

## 6. Recommended Research Corrections

To transform Component 4 into a scientifically valid, paper-ready severity model:

1. **Reconstruct Target Severity Labels Independently**:
   - Re-annotate complaint severity based on **text urgency cues** and **impact scale** (e.g. affect on life/health, structural risk, population affected) rather than static category rules.
2. **Feature Sanitization**:
   - Remove category and department features from severity prediction input, or use residual severity modeling ($\text{Severity}_{\text{actual}} - \text{Severity}_{\text{category\_base}}$).
3. **Preserve Comparative Reporting**:
   - In research papers, clearly document both:
     - *Original Dataset Evaluation*: 100.00% (Category-rule artifact)
     - *Leakage-Controlled Evaluation*: Realistic held-out F1 score on intra-category varied severity dataset.
