"""
CivicPulse AI Component 3 — Master-Issue vs Raw-Report Comparative Experiment
Demonstrates why Component 2 Master Issue consolidation is essential before spatial clustering analytics.
Compares DBSCAN performance when run on Raw Citizen Submissions vs Unique Master Issues.
Stores results in evaluation/master_vs_raw_comparison.csv.
"""

import os
import sys
import csv
import json
import random

sys.path.insert(0, os.path.dirname(__file__))
from hotspot_engine import LocationHotspotEngine

EVAL_DIR = os.path.join(os.path.dirname(__file__), "evaluation")
MASTER_VS_RAW_CSV = os.path.join(EVAL_DIR, "master_vs_raw_comparison.csv")

def generate_duplicate_heavy_dataset(num_master_issues=200, avg_duplicates_per_master=4):
    """Generates a dataset with Master Issues and linked duplicate citizen reports."""
    random.seed(42)
    raw_reports = []
    master_issues = []

    mid = 1
    rid = 1

    categories = ["roads", "water", "drainage", "garbage", "streetlights", "infrastructure"]

    for i in range(num_master_issues):
        cat = categories[i % len(categories)]
        # 10 Spatial hot zones in city
        base_lat = 13.0827 + (i % 10) * 0.015
        base_lng = 80.2707 + (i % 10) * 0.015

        m_lat = round(base_lat + (random.random() - 0.5) * 0.002, 6)
        m_lng = round(base_lng + (random.random() - 0.5) * 0.002, 6)

        num_dups = random.randint(1, avg_duplicates_per_master * 2)

        master_item = {
            "id": f"CP-MASTER-{mid:04d}",
            "grievanceId": f"CP-MASTER-{mid:04d}",
            "title": f"Master issue for {cat} defect #{mid}",
            "description": f"Physical defect in {cat} infrastructure.",
            "departmentId": cat,
            "departmentName": cat.capitalize(),
            "categoryId": cat,
            "lat": m_lat,
            "lng": m_lng,
            "reportCount": num_dups,
            "duplicateCount": num_dups - 1,
            "isMasterIssue": True,
            "isDuplicate": False,
            "priorityScore": random.randint(50, 90)
        }
        master_issues.append(master_item)
        raw_reports.append(master_item)

        # Generate linked duplicate reports (same physical issue, slight GPS drift < 30m)
        for d in range(num_dups - 1):
            rid += 1
            d_lat = round(m_lat + (random.random() - 0.5) * 0.0003, 6)
            d_lng = round(m_lng + (random.random() - 0.5) * 0.0003, 6)
            dup_item = {
                "id": f"CP-RAW-DUP-{rid:05d}",
                "grievanceId": f"CP-RAW-DUP-{rid:05d}",
                "masterComplaintId": f"CP-MASTER-{mid:04d}",
                "title": f"Duplicate report for {cat} defect #{mid}",
                "description": f"Citizen report for {cat} defect.",
                "departmentId": cat,
                "departmentName": cat.capitalize(),
                "categoryId": cat,
                "lat": d_lat,
                "lng": d_lng,
                "reportCount": 1,
                "duplicateCount": 0,
                "isMasterIssue": False,
                "isDuplicate": True,
                "priorityScore": random.randint(40, 80)
            }
            raw_reports.append(dup_item)
        mid += 1

    return raw_reports, master_issues

def run_comparative_experiment():
    raw_reports, master_issues = generate_duplicate_heavy_dataset()

    engine_raw = LocationHotspotEngine(config={"use_master_issues": False})
    engine_master = LocationHotspotEngine(config={"use_master_issues": True})

    print("[Master vs Raw Experiment] Evaluating DBSCAN on Raw Reports vs Master Issues...")

    res_raw = engine_raw.detect_hotspots(raw_reports, eps_meters=350.0, min_samples=5)
    res_master = engine_master.detect_hotspots(raw_reports, eps_meters=350.0, min_samples=5)

    qm_raw = res_raw.get("quality_metrics") or {}
    qm_master = res_master.get("quality_metrics") or {}

    rows = [
        {
            "mode": "Raw Citizen Reports (Unconsolidated)",
            "total_input_records": len(raw_reports),
            "valid_complaints_clustered": res_raw["total_valid_complaints"],
            "total_clusters_found": res_raw["total_clusters"],
            "noise_count": res_raw["noise_count"],
            "noise_percentage": res_raw["noise_percentage"],
            "silhouette_score": qm_raw.get("silhouette_score", 0.0),
            "davies_bouldin_index": qm_raw.get("davies_bouldin_index", 0.0),
            "calinski_harabasz_index": qm_raw.get("calinski_harabasz_index", 0.0)
        },
        {
            "mode": "Unique Master Issues (Component 2 Deduplicated)",
            "total_input_records": len(raw_reports),
            "valid_complaints_clustered": res_master["total_valid_complaints"],
            "total_clusters_found": res_master["total_clusters"],
            "noise_count": res_master["noise_count"],
            "noise_percentage": res_master["noise_percentage"],
            "silhouette_score": qm_master.get("silhouette_score", 0.0),
            "davies_bouldin_index": qm_master.get("davies_bouldin_index", 0.0),
            "calinski_harabasz_index": qm_master.get("calinski_harabasz_index", 0.0)
        }
    ]

    fieldnames = [
        "mode", "total_input_records", "valid_complaints_clustered", "total_clusters_found",
        "noise_count", "noise_percentage", "silhouette_score", "davies_bouldin_index", "calinski_harabasz_index"
    ]

    with open(MASTER_VS_RAW_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in rows:
            writer.writerow(r)

    print("\n[Master-Issue vs Raw-Report Comparison Results Summary]")
    print(f"{'Mode':<42} | {'Input Recs':<10} | {'Clustered':<10} | {'Clusters':<9} | {'Noise %':<8} | {'Silhouette':<10}")
    print("-" * 100)
    for r in rows:
        print(f"{r['mode']:<42} | {r['total_input_records']:<10} | {r['valid_complaints_clustered']:<10} | {r['total_clusters_found']:<9} | {r['noise_percentage']:<7.1f}% | {r['silhouette_score']:<10.4f}")

if __name__ == "__main__":
    run_comparative_experiment()
