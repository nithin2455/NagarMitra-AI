# Component 4 — Leakage-Controlled Severity Dataset Methodology

## 1. Executive Summary & Purpose
This document specifies the provenance, annotation rubric, and leakage controls for the **CivicPulse Leakage-Controlled Severity Dataset** ($N = 4,200$ records).

The dataset was specifically designed to eliminate the category-to-severity shortcut leakage identified in the initial evaluation baseline.

---

## 2. Dataset Provenance & Record Generation
- **Dataset Nature**: Annotated Research Benchmark Dataset (Semi-synthetic municipal complaint templates grounded in actual Chennai / Tamil Nadu public works complaints).
- **Total Records**: 4,200 complaints.
- **Split Distribution**:
  - **Train Set**: 2,940 records (70.0%)
  - **Validation Set**: 630 records (15.0%)
  - **Held-Out Test Set**: 630 records (15.0%)
- **Target Variable**: `urgency_level` $\in \{\text{LOW}, \text{MEDIUM}, \text{HIGH}, \text{CRITICAL}\}$.

---

## 3. Four-Level Severity Annotation Rubric

| Severity Level | Definition | Physical Impact & Safety Criteria | Example Scenario |
|:---|:---|:---|:---|
| **LOW** | Minor / Routine | Cosmetic or minor defect with no immediate public impact or safety hazard. | Faded paint on speed breaker; minor garden light dimming. |
| **MEDIUM** | Standard Defect | Noticeable municipal defect affecting service quality or localized layout, without immediate danger. | Single fused streetlight on residential lane; uncleared garbage bin (3 days). |
| **HIGH** | Urgent Disruption | Substantial public disruption, major infrastructure defect, or severe traffic/sanitation concern. | Deep pothole damaging car tires; multiple streetlight failure creating dark zone on main road. |
| **CRITICAL** | Emergency Hazard | Immediate or potentially catastrophic threat to human life, public safety, public health, or essential services. | Live 11kV electrical wire hanging across school entrance; toxic effluent in drinking water; bridge collapse hazard. |

---

## 4. Verification of Intra-Category Severity Variation

To guarantee that category or department features cannot act as deterministic target shortcuts, every municipal category was populated with equal representation across all four severity tiers:

### Category vs Severity Matrix ($N = 4,200$)

| Category ID | LOW | MEDIUM | HIGH | CRITICAL | Total Records |
|:---|:---:|:---:|:---:|:---:|:---:|
| `roads` | 150 | 150 | 150 | 150 | **600** |
| `water` | 150 | 150 | 150 | 150 | **600** |
| `drainage` | 150 | 150 | 150 | 150 | **600** |
| `streetlights` | 150 | 150 | 150 | 150 | **600** |
| `garbage` | 150 | 150 | 150 | 150 | **600** |
| `infrastructure` | 150 | 150 | 150 | 150 | **600** |
| `other` | 150 | 150 | 150 | 150 | **600** |
| **Total** | **1,050** | **1,050** | **1,050** | **1,050** | **4,200** |

**Leakage Control Verification**: $P(\text{severity} = c \mid \text{category} = k) = 0.25$ for all classes $c$ and categories $k$. Category ID alone yields a baseline accuracy of **25.00%** (pure random chance), proving zero target-construction leakage!

---

## 5. Prediction Point & Feature Isolation Controls

$$\text{PREDICTION POINT} = \text{Initial Complaint Submission}$$

- **Allowed Features**: Complaint title, description text, category ID, department code, district/location, initial support count, Component 2 master issue report count, Component 3 hotspot priority score.
- **Forbidden Features**: `status` (`CLOSED`, `RESOLVED`), `closed_at`, resolution duration, officer resolution notes, admin verification, human post-submission priority edits.
