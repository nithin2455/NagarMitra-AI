"""
CivicPulse AI Component 3 — Research Evaluation & DBSCAN Parameter Grid Search
Evaluates DBSCAN parameter variations (eps_meters from 100m to 1000m, min_samples from 3 to 15)
across municipal grievance datasets. Computes Silhouette Score, Davies-Bouldin Index, Calinski-Harabasz Index,
cluster counts, and noise ratio. Stores results in evaluation/parameter_study.csv.
"""

import os
import sys
import csv
import json
import random

sys.path.insert(0, os.path.dirname(__file__))
from hotspot_engine import LocationHotspotEngine

EVAL_DIR = os.path.join(os.path.dirname(__file__), "evaluation")
os.makedirs(EVAL_DIR, exist_ok=True)

PARAMETER_STUDY_CSV = os.path.join(EVAL_DIR, "parameter_study.csv")

def generate_benchmark_dataset(num_complaints=1000):
    """Generates realistic spatial complaint dataset across 12 urban hotspots with noise background."""
    random.seed(42)
    complaints = []

    # 12 Hotspot Clusters in Chennai
    cluster_centers = [
        {"lat": 13.0827, "lng": 80.2707, "dept": "roads", "count": 120},
        {"lat": 13.0067, "lng": 80.2020, "dept": "water", "count": 90},
        {"lat": 13.0418, "lng": 80.2341, "dept": "garbage", "count": 110},
        {"lat": 12.9750, "lng": 80.2210, "dept": "drainage", "count": 80},
        {"lat": 13.0012, "lng": 80.2565, "dept": "streetlights", "count": 70},
        {"lat": 13.0339, "lng": 80.2696, "dept": "roads", "count": 95},
        {"lat": 12.9249, "lng": 80.1000, "dept": "water", "count": 85},
        {"lat": 13.0694, "lng": 80.1948, "dept": "garbage", "count": 75},
        {"lat": 13.0500, "lng": 80.2120, "dept": "drainage", "count": 60},
        {"lat": 12.9900, "lng": 80.1800, "dept": "infrastructure", "count": 55},
        {"lat": 13.1100, "lng": 80.2900, "dept": "roads", "count": 50},
        {"lat": 12.9500, "lng": 80.1400, "dept": "water", "count": 40},
    ]

    total_clustered = sum(c["count"] for c in cluster_centers)
    cid = 1

    for c_info in cluster_centers:
        for _ in range(c_info["count"]):
            # Gaussian spatial spread within ~150 meters (0.0013 deg)
            lat = round(c_info["lat"] + random.gauss(0, 0.0008), 6)
            lng = round(c_info["lng"] + random.gauss(0, 0.0008), 6)
            complaints.append({
                "id": f"CP-BENCH-{cid:04d}",
                "departmentId": c_info["dept"],
                "departmentName": c_info["dept"].capitalize(),
                "categoryId": c_info["dept"],
                "lat": lat,
                "lng": lng,
                "reportCount": random.randint(1, 4),
                "isMasterIssue": True,
                "isDuplicate": False,
                "priorityScore": random.randint(40, 95)
            })
            cid += 1

    # Add 70 isolated noise complaints scattered across the city
    for _ in range(num_complaints - total_clustered):
        lat = round(12.90 + random.random() * 0.25, 6)
        lng = round(80.05 + random.random() * 0.28, 6)
        dept = random.choice(["roads", "water", "garbage", "drainage", "streetlights", "infrastructure"])
        complaints.append({
            "id": f"CP-BENCH-{cid:04d}",
            "departmentId": dept,
            "departmentName": dept.capitalize(),
            "categoryId": dept,
            "lat": lat,
            "lng": lng,
            "reportCount": 1,
            "isMasterIssue": True,
            "isDuplicate": False,
            "priorityScore": random.randint(30, 70)
        })
        cid += 1

    return complaints

def run_parameter_grid_search():
    complaints = generate_benchmark_dataset(1000)
    engine = LocationHotspotEngine()

    eps_grid = [100.0, 200.0, 350.0, 500.0, 750.0, 1000.0]
    min_samples_grid = [3, 5, 10, 15]

    study_results = []

    print("[DBSCAN Parameter Grid Search] Evaluating grid variations...")

    for eps in eps_grid:
        for min_pts in min_samples_grid:
            res = engine.detect_hotspots(complaints, eps_meters=eps, min_samples=min_pts)
            qm = res.get("quality_metrics") or {}

            study_results.append({
                "eps_meters": eps,
                "min_samples": min_pts,
                "total_valid_complaints": res["total_valid_complaints"],
                "total_clusters": res["total_clusters"],
                "noise_count": res["noise_count"],
                "noise_percentage": res["noise_percentage"],
                "silhouette_score": qm.get("silhouette_score", 0.0),
                "davies_bouldin_index": qm.get("davies_bouldin_index", 0.0),
                "calinski_harabasz_index": qm.get("calinski_harabasz_index", 0.0)
            })

    # Save to CSV
    fieldnames = [
        "eps_meters", "min_samples", "total_valid_complaints", "total_clusters",
        "noise_count", "noise_percentage", "silhouette_score", "davies_bouldin_index", "calinski_harabasz_index"
    ]
    with open(PARAMETER_STUDY_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in study_results:
            writer.writerow(r)

    print("\n[Parameter Grid Search Results Summary]")
    print(f"{'eps (m)':<9} | {'min_pts':<8} | {'Clusters':<9} | {'Noise %':<9} | {'Silhouette':<11} | {'Davies-Bouldin':<15} | {'Calinski-Harabasz':<18}")
    print("-" * 90)
    for r in study_results:
        print(f"{r['eps_meters']:<9.1f} | {r['min_samples']:<8} | {r['total_clusters']:<9} | {r['noise_percentage']:<8.1f}% | {r['silhouette_score']:<11.4f} | {r['davies_bouldin_index']:<15.4f} | {r['calinski_harabasz_index']:<18.2f}")

if __name__ == "__main__":
    run_parameter_grid_search()
