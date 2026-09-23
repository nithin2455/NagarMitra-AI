# CivicPulse AI Component 2: Multimodal Duplicate Complaint Detection & Real-World Issue Consolidation

## Executive Overview
CivicPulse AI Component 2 addresses real-world municipal infrastructure scale by identifying when multiple citizen reports refer to the same physical underlying issue (e.g. 500 or 10,000 citizens reporting a single main water line burst or crater pothole).

Rather than treating every complaint as an isolated ticket or blindly flagging "possible duplicate", the multimodal AI system:
1. Performs Candidate Retrieval by department/category and geohash/coordinate radius to scale to 10,000+ and 100,000+ complaints without $O(N)$ full database scans.
2. Fuses Text Semantic Similarity, Haversine Geographic Distance, and Perceptual Hash (pHash) Visual Similarity into a combined confidence score.
3. Automatically links duplicate reports to a single canonical Master Issue (`masterComplaintId` / `duplicateGroupId`).
4. Increments aggregate citizen counters (`reportCount`, `duplicateCount`, `uniqueCitizenCount`) and dynamically elevates the priority score of the Master Issue.
5. Preserves ALL original citizen submissions intact for auditability, evidence tracking, and citizen status lookup.

---

## System Architecture

```
   ┌─────────────────────────────────────────────────────────┐
   │             Citizen Grievance Submission               │
   └──────────────────────────┬──────────────────────────────┘
                              │
                              ▼
   ┌─────────────────────────────────────────────────────────┐
   │       Candidate Retrieval Filtering (Scalable)          │
   │   - Department / Category Match                         │
   │   - Geographic Bounding Radius (100m - 1000m)           │
   │   - Active Non-Closed Master Issues                     │
   └──────────────────────────┬──────────────────────────────┘
                              │
                              ▼
   ┌─────────────────────────────────────────────────────────┐
   │            Multimodal Similarity Fusion                 │
   │   1. Location: Haversine Distance (45% Weight)           │
   │   2. Text: Token Jaccard + Difflib + N-Gram (30% Weight) │
   │   3. Image: Perceptual Hash (pHash DCT) (25% Weight)    │
   └──────────────────────────┬──────────────────────────────┘
                              │
                              ▼
   ┌─────────────────────────────────────────────────────────┐
   │            Decision Threshold Evaluation                │
   │   - Score >= 0.75: HIGH_CONFIDENCE_DUPLICATE (Auto Link)│
   │   - Score 0.50-0.74: MEDIUM_CONFIDENCE_REVIEW           │
   │   - Score < 0.50: LOW_CONFIDENCE (New Master Issue)    │
   └──────────────────────────┬──────────────────────────────┘
                              │
                              ▼
   ┌─────────────────────────────────────────────────────────┐
   │         Master Issue Canonicalization & Updates         │
   │   - Assign masterComplaintId & duplicateGroupId         │
   │   - Increment reportCount & duplicateCount              │
   │   - Boost Master Priority Score                         │
   │   - Log AUDIT_ACTIONS.GRIEVANCE_DUPLICATE_LINKED        │
   └─────────────────────────────────────────────────────────┘
```

---

## Mathematical Formulation

### 1. Geographic Distance & Location Similarity ($S_{loc}$)
Uses exact Haversine distance $d$ in meters between coordinates $(\phi_1, \lambda_1)$ and $(\phi_2, \lambda_2)$:
$$d = 2 R \cdot \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta\phi}{2}\right) + \cos\phi_1 \cos\phi_2 \sin^2\left(\frac{\Delta\lambda}{2}\right)}\right)$$
where $R = 6,371,000$ meters.

Location similarity score $S_{loc}$:
$$S_{loc}(d) = \begin{cases} 
1.0 & \text{if } d \le 100\text{m} \\
e^{-\frac{d - 100}{300}} & \text{if } 100\text{m} < d < 1000\text{m} \\
0.0 & \text{if } d \ge 1000\text{m}
\end{cases}$$

### 2. Text Similarity ($S_{text}$)
Combines token Jaccard similarity, character sequence ratio (difflib), and character 3-gram overlap:
$$S_{text} = 0.50 \cdot S_{\text{seq}} + 0.30 \cdot S_{\text{ngram}} + 0.20 \cdot S_{\text{jaccard}}$$

### 3. Image Perceptual Hash Similarity ($S_{img}$)
Uses 8x8 Discrete Cosine Transform (DCT) Perceptual Hash (pHash). Hamming distance $H$ over 64 bit hash:
$$S_{img} = 1.0 - \frac{H}{64}$$

### 4. Multimodal Fusion Score ($S_{fused}$)
$$S_{fused} = w_{loc} \cdot S_{loc} + w_{text} \cdot S_{text} + w_{img} \cdot S_{img}$$
Default weights: $w_{loc} = 0.45$, $w_{text} = 0.30$, $w_{img} = 0.25$ (rebalanced to $w_{loc}=0.55, w_{text}=0.45$ if no image present).

---

## Verification & Test Suite Summary

A comprehensive 20-test Python unit test suite (`ml/duplicate_detection/test_duplicate_engine.py`) verifies all edge cases, safeguards, and algorithms:

- **Test 1**: Same text + location + image $\rightarrow$ High confidence duplicate ($\ge 0.90$).
- **Test 2**: Different wording + same location + image $\rightarrow$ High confidence duplicate ($\ge 0.75$).
- **Test 3**: Nearby location (30m) + similar text $\rightarrow$ Duplicate.
- **Test 4**: Same category + far location (5km) $\rightarrow$ Location similarity = 0.0 (Not Duplicate).
- **Test 5**: Same category + 3km location $\rightarrow$ Not Duplicate.
- **Test 6**: Same location + different category $\rightarrow$ Safeguard trigger (`DIFFERENT_DEPARTMENT`).
- **Test 7**: Same image + 10km location $\rightarrow$ Location safeguard enforced.
- **Test 8**: No image available $\rightarrow$ Rebalanced text + location pipeline.
- **Test 9**: Canonical Master Resolution (A $\rightarrow$ Master, B links to A, C matching B resolves to A).
- **Test 10**: Multiple candidate matches $\rightarrow$ Selects highest confidence canonical master.
- **Test 11**: Haversine distance metric accuracy ($\pm 2\%$ error).
- **Test 12**: Location similarity at 50m = 1.0.
- **Test 13**: Location similarity decay at 500m ($0.0 < S_{loc} < 0.5$).
- **Test 14**: Text n-gram & sequence matcher resilience to typos ($> 0.60$).
- **Test 15**: Custom configurable weights enforcement.
- **Test 16**: Missing field & null coordinate safety.
- **Test 17**: Candidate retrieval scalability with empty candidates.
- **Test 18**: Unsupervised similarity score transparency output.
- **Test 19**: Medium confidence review classification ($0.50 \le S_{fused} < 0.75$).
- **Test 20**: Master issue group ID assignment (`GRP-<masterId>`).

---

## Application Integration Summary

1. **Schema & Firestore**: Extended `EntitySchemas.Complaint` with canonical fields (`isMasterIssue`, `masterComplaintId`, `duplicateGroupId`, `isDuplicate`, `reportCount`, `duplicateCount`, `uniqueCitizenCount`, `duplicateMatchConfidence`, `duplicateMatchSignals`). Added `AUDIT_ACTIONS.GRIEVANCE_DUPLICATE_LINKED`.
2. **Unified AI API**: Implemented `ml/server.py` and `ml/duplicate_detection/api.py` serving `POST /predict-duplicate` on port 8000.
3. **Frontend Client Service**: Created `src/services/ai/duplicateDetectionService.js` with client-side fallback.
4. **Grievance Service**: Updated `createGrievance` in `grievanceService.js` to execute candidate retrieval, query duplicate detection engine, update master counters, and log audit entries.
5. **Citizen UI**: Updated `ReportGrievancePage.jsx` (AI Consolidation banner) and `GrievanceDetailPage.jsx` (Master Issue badge & Master link).
6. **Officer & Admin UI**: Updated `OfficerInboxPage.jsx` and `AdminDashboard.jsx` to manage Master Issues with report counts and consolidated duplicate analytics.

---

## Experimental Research Evaluation Summary

Full empirical research evaluation and experimental benchmarks are documented in [component2-evaluation-report.md](file:///c:/Users/nithi/OneDrive/Documents/Smart-Grievance-System/docs/ai-ml/component2-evaluation-report.md).

### 1. Held-Out TEST Set Performance ($T_{\text{optimal}} = 0.50$, 250 Pairs)
- **Accuracy**: **91.20%**
- **Precision**: **100.00%**
- **Recall**: **82.26%**
- **F1-Score**: **90.27%**
- **False Merge Rate**: **0.00%** (Zero dangerous false merges)
- **Confusion Matrix**: TP=102, TN=126, FP=0, FN=22

### 2. Multimodal Ablation Study Summary
- **Location Only**: F1 = 91.3%
- **Text Only**: F1 = 52.9%
- **Image Only (pHash)**: F1 = 52.9%
- **Multimodal Fusion**: F1 = 68.4% (Threshold = 0.75) / **90.27%** (Optimized Threshold = 0.50)

### 3. Scalability Benchmark (100,000 Complaints)
- **Candidate Reduction Rate**: **>99.7%**
- **Total Latency at 10,000 complaints**: **8.88 ms**
- **Total Latency at 100,000 complaints**: **67.66 ms** (<0.07s)

