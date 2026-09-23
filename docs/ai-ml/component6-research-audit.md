# Component 6 — AI Anomaly & Suspicious Pattern Detection: Research Leakage & Data Provenance Audit Report

## Executive Summary
This document records the research-integrity audit performed for **Component 6 — AI Anomaly & Suspicious Pattern Detection** in the CivicPulse Smart Public Grievance Platform. The objective is to verify data provenance, operational window isolation ($t = 0$ window boundary), absence of target leakage, baseline leakage prevention, and proper explainability terminology.

---

## 1. Research Classification & Provenance Audit

- **Operational Benchmark Dataset Provenance**: Semi-synthetic municipal operational window dataset ($N = 4,200$ aggregated time slots across 180 days). Constructed strictly from CivicPulse municipal department categories, spatial density distributions, and historical complaint volume patterns.
- **Controlled Synthetic Benchmark**: Completely separate $N = 200$ controlled synthetic anomaly dataset (100 normal windows + 100 labeled synthetic anomaly spikes). Used exclusively for controlled synthetic testing; metrics are explicitly reported as synthetic benchmark metrics and NOT real-world operational fraud detection rates.
- **Unsupervised Labeling Integrity**: No ground-truth "fraud" or "anomaly" labels were created or assumed for the operational $N = 4,200$ dataset. Isolation Forest operates 100% unsupervised.

---

## 2. Operational Window Isolation Audit

Every feature entering `IsolationForestPredictor` was audited to ensure it represents aggregated operational state at the time of scoring:

| Feature Name | Category | Available at Window Scoring? | Audit Result | Notes |
| :--- | :--- | :---: | :---: | :--- |
| `raw_report_count` | Temporal Volume | YES | **PASSED** | Aggregated intake volume in slot |
| `master_issue_count` | Component 2 AI | YES | **PASSED** | Aggregated master issues in slot |
| `duplicate_ratio` | Component 2 AI | YES | **PASSED** | Duplicate report fraction in slot |
| `reports_per_master_issue` | Component 2 AI | YES | **PASSED** | Average reports per master issue |
| `hotspot_score` | Component 3 AI | YES | **PASSED** | Component 3 DBSCAN cluster score |
| `local_density` | Component 3 AI | YES | **PASSED** | Spatial density score |
| `cluster_size` | Component 3 AI | YES | **PASSED** | Number of complaints in cluster |
| `critical_count` | Component 4 AI | YES | **PASSED** | Component 4 critical severity intake |
| `high_count` | Component 4 AI | YES | **PASSED** | Component 4 high severity intake |
| `critical_ratio` | Component 4 AI | YES | **PASSED** | Fraction of critical complaints |
| `high_sla_risk_count` | Component 5 AI | YES | **PASSED** | Component 5 high SLA risk intake |
| `high_sla_risk_ratio` | Component 5 AI | YES | **PASSED** | Fraction of high SLA risk intake |
| `complaints_last_24h` | Temporal Rolling | YES | **PASSED** | Past 24h rolling volume sum |
| `complaints_last_7d` | Temporal Rolling | YES | **PASSED** | Past 7d rolling volume sum |
| `rate_of_change` | Temporal Trend | YES | **PASSED** | Trend delta vs past 24h rolling mean |
| `hour`, `day_of_week`, `is_weekend` | Temporal | YES | **PASSED** | Time slot calendar attributes |
| `department_code`, `time_slot` | Operational | YES | **PASSED** | Department and time slot identifiers |

---

## 3. Leakage Prevention in Baseline Comparisons

To prevent future-data leakage in baseline evaluation:
- **Baseline 1 (Historical Mean + 3SD)**: Threshold computed strictly using training set statistics ($\mu_{\text{train}} + 3 \sigma_{\text{train}}$).
- **Baseline 2 (Rolling Z-Score)**: $Z = \frac{x - \mu_{\text{train}}}{\sigma_{\text{train}}} \ge 3.0$ calculated using training statistics.
- **Isolation Forest**: Contamination parameter ($0.05$) fit strictly on training set distribution.

---

## 4. Terminology & Non-Accusatory Governance Audit

- **No "Fraud Probability"**: The model outputs an **Anomaly Score** ($[0.0, 1.0]$) and **Anomaly Level** (`LOW`, `MEDIUM`, `HIGH`). It NEVER outputs a "fraud probability."
- **Pattern Categorization**: Pattern types (`VOLUME_SPIKE`, `GEOGRAPHIC_SPIKE`, `DEPARTMENT_SPIKE`, `DUPLICATE_CONCENTRATION`, `SEVERITY_SPIKE`, `SLA_RISK_SPIKE`, `MULTIVARIATE_ANOMALY`) are explicit post-processing rule interpretations, NOT native Isolation Forest outputs.
- **Explainability Wording**: Explanations use the term **Contributing Indicators** comparing current observation values against established historical baselines.
- **Human Authority**: Only authorized administrators can determine whether an anomaly represents a genuine emergency, weather event, coordinated reporting, or abuse.

---

## 5. Audit Classification

**Audit Classification: GREEN (FULLY COMPLIANT)**

- Data provenance accurately documented.
- Zero future outcome leakage.
- Unsupervised Isolation Forest methodology strictly adhered to.
- Explainable indicators and human review workflows fully integrated.
