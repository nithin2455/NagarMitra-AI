# Component 3 — AI Location Hotspot Detection Architecture

## Executive Summary
CivicPulse Component 3 implements a research-grade geospatial location hotspot detection engine powered by **Density-Based Spatial Clustering of Applications with Noise (DBSCAN)** with a spherical **Haversine metric**.

The objective of Component 3 is to automatically identify spatial clusters of municipal grievances (e.g. pothole clusters, drainage blockages, street light failures), distinguish between raw citizen complaints and master deduplicated issues (Component 2 integration), compute exact geographic centroids and cluster bounds, and rank detected hotspots according to a multi-factor priority scoring formula ($S_{\text{hotspot}} \in [0, 100]$).

---

## Technical Architecture & Mathematical Foundation

### 1. Geospatial Distance Metric: Spherical Haversine Metric
Euclidean distance ($d = \sqrt{\Delta x^2 + \Delta y^2}$) fails on geographical coordinates because lines of longitude converge toward the poles and 1 degree of latitude equals $\sim 111$ km whereas 1 degree of longitude varies by $\cos(\text{latitude})$.

CivicPulse uses the **Haversine formula** to measure great-circle distances over the Earth's spherical surface ($R = 6,371,000$ meters):

$$\Delta \phi = \phi_2 - \phi_1, \quad \Delta \lambda = \lambda_2 - \lambda_1$$

$$a = \sin^2\left(\frac{\Delta \phi}{2}\right) + \cos(\phi_1) \cdot \cos(\phi_2) \cdot \sin^2\left(\frac{\Delta \lambda}{2}\right)$$

$$c = 2 \cdot \operatorname{atan2}\left(\sqrt{a}, \sqrt{1 - a}\right)$$

$$d_{\text{haversine}} = R \cdot c$$

In Python, coordinates are converted to radians:
$$\text{coords\_rad} = \operatorname{radians}([\text{latitude}, \text{longitude}])$$
$$\epsilon_{\text{rad}} = \frac{\epsilon_{\text{meters}}}{6,371,000.0}$$

DBSCAN is instantiated via `sklearn.cluster.DBSCAN`:
```python
db = DBSCAN(
    eps=eps_rad,
    min_samples=min_samples,
    metric='haversine'
)
db.fit(coords_rad)
```

---

### 2. Clustering Modes & Granularity

Component 3 supports two operational modes:

1. **`OVERALL` Mode**: Clusters all grievances across all categories simultaneously. Ideal for identifying cross-cutting spatial emergencies (e.g., severe storm damage affecting roads, water lines, and electrical grids).
2. **`DEPARTMENT` Mode**: Segregates grievances by target department before clustering. Ideal for department-specific field teams (e.g. Highways Dept inspecting pothole clusters independently of Electrical Dept light outages).

---

### 3. Raw Citizen Reports vs Master Deduplicated Issues

In real municipal platforms, a single high-profile issue (e.g. a large main road pothole) receives dozens of viral citizen reports. If clustering is performed purely on raw report counts, high report volume in one spot artificially inflates cluster density and masks actual multi-location emergencies.

Component 3 integrates with **Component 2 (Multimodal Duplicate Complaint Engine)**:
- Each complaint is checked for its `masterId`.
- **Master Issue Count**: Unique master issue entities in the cluster ($N_{\text{master}}$).
- **Total Reports Count**: Total raw citizen reports ($N_{\text{reports}}$).
- **Unique Citizens**: Distinct citizen user IDs contributing to the cluster ($N_{\text{citizens}}$).

---

### 4. Centroid & Radius Calculation

For each discovered cluster $C_k$:
- **Centroid Latitude/Longitude**:
  $$\text{lat}_{\text{centroid}} = \frac{1}{|C_k|} \sum_{i \in C_k} \text{lat}_i, \quad \text{lng}_{\text{centroid}} = \frac{1}{|C_k|} \sum_{i \in C_k} \text{lng}_i$$
- **Cluster Radius ($r_{\text{cluster}}$)**: Max Haversine distance from centroid to any constituent point:
  $$r_{\text{cluster}} = \max_{i \in C_k} d_{\text{haversine}}(\text{centroid}, \mathbf{p}_i)$$

---

### 5. Multi-Factor Hotspot Priority Ranking ($S_{\text{hotspot}}$)

Detected hotspots are dynamically prioritized using a multi-factor scoring formula normalized to $[0, 100]$:

$$S_{\text{hotspot}} = 0.35 \cdot S_{\text{density}} + 0.25 \cdot S_{\text{severity}} + 0.20 \cdot S_{\text{SLA}} + 0.20 \cdot S_{\text{citizens}}$$

Where:
- **Spatial Density Score ($S_{\text{density}}$)**:
  $$S_{\text{density}} = \min\left(100, \frac{N_{\text{master}}}{\pi \cdot (r_{\text{cluster}} / 1000)^2 + 0.01} \cdot 10\right)$$
- **Severity Score ($S_{\text{severity}}$)**: Weighted proportion of CRITICAL and HIGH severity issues in the cluster.
- **SLA Risk Score ($S_{\text{SLA}}$)**: Percentage of issues in cluster approaching or breaching SLA limits.
- **Citizen Engagement Score ($S_{\text{citizens}}$)**: Normalized citizen count participating in the cluster.

Priority Tiers:
- $S_{\text{hotspot}} \ge 70$: **CRITICAL HOTSPOT** (Red)
- $50 \le S_{\text{hotspot}} < 70$: **HIGH DENSITY** (Orange)
- $30 \le S_{\text{hotspot}} < 50$: **MODERATE DENSITY** (Blue)
- $S_{\text{hotspot}} < 30$: **LOW DENSITY** (Gray)

---

## API & Client Integration Architecture

### Python ML Server (`ml/server.py` & `ml/location_hotspot/api.py`)
- Endpoint: `POST /predict-hotspots`
- Port: 8000
- Request Payload:
  ```json
  {
    "complaints": [...],
    "mode": "OVERALL",
    "department": "all",
    "timeWindow": "ALL_TIME",
    "epsMeters": 350.0,
    "minSamples": 3
  }
  ```

### Frontend Client Service (`src/services/ai/hotspotDetectionService.js`)
- Communicates with `http://127.0.0.1:8000/predict-hotspots` with a 4.5-second fallback timeout.
- Implements a full JavaScript Haversine fallback engine if the Python server is offline, ensuring 100% uptime for admin command centers.

### Admin Command Center (`src/pages/admin/AdminHotspotsPage.jsx`)
- Interactive control panel for mode switching, hyperparameter tuning ($\epsilon$, $\text{min\_samples}$), time windows, and department scope.
- Enforces strict Role-Based Access Control (RBAC): Department Admins are locked to their assigned department, while Super Admins inspect cross-department municipal hotspots.
