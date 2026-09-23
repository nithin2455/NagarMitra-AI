# Component 4 — Original Evaluation & Data Leakage Audit Record

## Overview & Purpose of This Document
This document preserves the initial evaluation results of Component 4 (AI Severity / Priority Prediction) for complete scientific and research transparency.

---

## 1. Initial Evaluation Results (Category-Deterministic Baseline)

In the initial implementation of Component 4, the model was evaluated on a dataset split ($N = 5,250$ records) where target severity labels were assigned via a deterministic rule:
- `drainage` & `water` $\rightarrow$ **CRITICAL**
- `roads` & `streetlights` $\rightarrow$ **HIGH**
- `garbage` & `infrastructure` $\rightarrow$ **MEDIUM**
- `other` $\rightarrow$ **LOW**

### Initial Reported Performance

| Model / Configuration | Test Accuracy | Macro F1 | Held-Out Test Note |
|:---|:---:|:---:|:---|
| Majority Baseline | 0.2926 | 0.1132 | Predicts most frequent class |
| Logistic Regression | 1.0000 | 1.0000 | Linearly separable category encodings |
| Random Forest (Initial) | 1.0000 | 1.0000 | Evaluated on initial synthetic split |

---

## 2. Research Audit & Data Leakage Findings

A rigorous audit ([component4-research-audit.md](file:///c:/Users/nithi/OneDrive/Documents/Smart-Grievance-System/docs/ai-ml/component4-research-audit.md)) was conducted to determine whether these 100.00% scores represented true generalization.

### Audit Discoveries
1. **Target-Construction Shortcut**: `category_id` and `department_code` alone yielded **100.00% accuracy** because every complaint in a given category possessed the exact same severity label.
2. **Title String Leakage**: Titles contained explicit category names (e.g., *"Water Supply..."*, *"Road Damage..."*), allowing text-only models to extract the category shortcut.
3. **Independent Sanity Failure**: When evaluated on 14 newly authored complaints where severity varied within categories, model accuracy dropped from **100.00% to 14.29%**.

---

## 3. Scientific Decision
Rather than claiming 100.00% accuracy as real-world generalization, this initial experiment was archived as an example of **dataset label-construction leakage**, and a new **leakage-controlled, intra-category varied severity dataset** was constructed for true model retraining.
