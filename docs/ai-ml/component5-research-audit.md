# Component 5 — AI SLA Breach Prediction: Research Leakage Audit Report

## Executive Summary
This document records the rigorous research audit performed for **Component 5 — AI SLA Breach Prediction** in the CivicPulse Smart Public Grievance Platform. The objective is to verify that the model predicts future SLA breach probability strictly at complaint submission time ($t = 0$), completely isolated from post-intake outcome variables.

---

## 1. Submission-Time ($t = 0$) Feature Isolation Audit

Every feature entering the `FeaturePreprocessor` and `RandomForestClassifier` was audited for availability prior to officer assignment or status updates.

| Feature Name | Feature Group | Available at Submission? | Audit Result | Notes |
| :--- | :--- | :---: | :---: | :--- |
| `description` | Text / NLP | YES | **PASSED** | Citizen input at submission |
| `word_count` | Text / NLP | YES | **PASSED** | Computed from intake description |
| `urgency_kw_count` | Text / NLP | YES | **PASSED** | Keyword frequency count at intake |
| `category_id` | Metadata | YES | **PASSED** | Selected or AI-predicted at intake |
| `department_id` | Operational | YES | **PASSED** | Deterministically routed at intake |
| `created_hour` | Temporal | YES | **PASSED** | Intake timestamp hour (0–23) |
| `created_day_of_week` | Temporal | YES | **PASSED** | Intake day of week (0–6) |
| `created_month` | Temporal | YES | **PASSED** | Intake month (1–12) |
| `is_weekend` | Temporal | YES | **PASSED** | Derived from intake timestamp |
| `is_working_hours` | Temporal | YES | **PASSED** | 8 AM–6 PM Mon–Fri flag at intake |
| `response_sla_hours` | Governance | YES | **PASSED** | Allowed SLA policy duration |
| `predicted_severity` | Component 4 AI | YES | **PASSED** | Intake severity prediction |
| `prob_low` .. `prob_critical` | Component 4 AI | YES | **PASSED** | Component 4 class probabilities |
| `master_issue_count_at_submission` | Component 2 AI | YES | **PASSED** | Known duplicate count at intake |
| `support_count_at_submission` | Component 2 AI | YES | **PASSED** | Upvotes existing at intake |
| `hotspot_score_at_submission` | Component 3 AI | YES | **PASSED** | Spatial density score at intake |
| `density_score_at_submission` | Component 3 AI | YES | **PASSED** | Normalized DBSCAN density at intake |
| `is_hotspot_area` | Component 3 AI | YES | **PASSED** | Binary spatial cluster flag at intake |
| `latitude`, `longitude` | Spatial | YES | **PASSED** | Geolocation coordinates |

---

## 2. Audit of Forbidden Post-Submission Outcome Fields

The following fields were verified to be **EXCLUDED** from the model feature space. They are stored only for ground-truth labeling of historical training data:

- `seenAt` (Officer acknowledgment timestamp) -> **EXCLUDED**
- `actual_response_hours` (Response duration taken) -> **EXCLUDED**
- `verifiedResolvedAt` (Admin resolution sign-off timestamp) -> **EXCLUDED**
- `actual_resolution_hours` (Resolution duration taken) -> **EXCLUDED**
- `response_breached` / `resolution_breached` / `sla_breached` -> **EXCLUDED** (Used ONLY as target variable `y`)
- `escalationLevel` / `escalationReason` -> **EXCLUDED**
- `closed_at` / `resolved_at` -> **EXCLUDED**
- `officer_assigned_at` -> **EXCLUDED**

---

## 3. Automated Leakage Verification Code

Automated verification script `ml/sla_prediction/critical_leakage_test.py` programmatically checks `NUMERICAL_COLS + CATEGORICAL_COLS` against `FORBIDDEN_LEAKAGE_COLS`.

**Audit Execution Result**:
```
==========================================
COMPONENT 5 DATA LEAKAGE AUDIT
==========================================
Forbidden Outcome Features Checked: 11
Forbidden Features in Pipeline: []
[PASSED] 100% Submission-Time (t=0) Feature Isolation Verified.
```

---

## 4. Operational Coexistence Verification

The AI SLA Breach Prediction model generates an early risk warning ($P(\text{breach} \mid x) \ge 0.50 \implies \text{HIGH RISK}$). This prediction coexists with CivicPulse's deterministic SLA governance engine:

1. **AI Component 5**: Predicts *future* risk at intake ($t = 0$) to alert officers before delays happen.
2. **Deterministic Engine**: Tracks actual elapsed time and triggers real countdowns, warnings, and escalation levels (`WARNING`, `DEPARTMENT_ESCALATED`, `SUPER_ADMIN_ESCALATED`).

Neither system overwrites the other, ensuring complete operational transparency and auditability.
