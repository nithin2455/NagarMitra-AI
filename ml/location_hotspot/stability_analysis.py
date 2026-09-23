"""
CivicPulse AI Component 3 — Cluster Stability & Sensitivity Analysis
Evaluates stability of discovered hotspots under random data subsampling (80%, 90%) and spatial GPS coordinate perturbation (+/- 20m).
Calculates Jaccard Cluster Overlap Stability Index and Centroid Shift Drift in meters.
Stores results in evaluation/stability_results.csv.
"""

import os
import sys
import csv
import json
import random
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from hotspot_engine import LocationHotspotEngine
from evaluate_hotspots import generate_benchmark_dataset

EVAL_DIR = os.path.join(os.path.dirname(__file__), "evaluation")
STABILITY_RESULTS_CSV = os.path.join(EVAL_DIR, "stability_results.csv")

def run_stability_analysis():
    random.seed(42)
    base_complaints = generate_benchmark_dataset(1000)
    engine = LocationHotspotEngine()

    base_res = engine.detect_hotspots(base_complaints, eps_meters=350.0, min_samples=5)
    base_hotspots = base_res["hotspots"]

    experiments = [
        {"name": "Full Baseline Dataset (100%)", "sample_ratio": 1.0, "perturbation_m": 0.0},
        {"name": "Subsample 90% Data", "sample_ratio": 0.90, "perturbation_m": 0.0},
        {"name": "Subsample 80% Data", "sample_ratio": 0.80, "perturbation_m": 0.0},
        {"name": "GPS Perturbation (+/- 10m)", "sample_ratio": 1.0, "perturbation_m": 10.0},
        {"name": "GPS Perturbation (+/- 20m)", "sample_ratio": 1.0, "perturbation_m": 20.0},
    ]

    results = []

    print("[Stability Analysis] Evaluating cluster stability across subsamples and GPS perturbations...")

    for exp in experiments:
        sample_ratio = exp["sample_ratio"]
        pert_m = exp["perturbation_m"]

        if sample_ratio < 1.0:
            sample_size = int(len(base_complaints) * sample_ratio)
            data = random.sample(base_complaints, sample_size)
        else:
            data = [dict(c) for c in base_complaints]

        # Apply GPS perturbation if requested
        if pert_m > 0.0:
            for item in data:
                # 1 deg lat ~ 111,000 m
                item["lat"] = round(item["lat"] + (random.random() - 0.5) * (pert_m / 111000.0), 6)
                item["lng"] = round(item["lng"] + (random.random() - 0.5) * (pert_m / 111000.0), 6)

        res = engine.detect_hotspots(data, eps_meters=350.0, min_samples=5)
        hotspots = res["hotspots"]

        # Calculate centroid shift drift (meters) relative to baseline hotspots
        centroid_drifts = []
        matched_count = 0

        for b_h in base_hotspots:
            b_lat, b_lng = b_h["centroid"]["lat"], b_h["centroid"]["lng"]
            min_dist = float("inf")
            for h in hotspots:
                d = LocationHotspotEngine.haversine_distance_meters(b_lat, b_lng, h["centroid"]["lat"], h["centroid"]["lng"])
                if d and d < min_dist:
                    min_dist = d
            if min_dist < 400.0: # Matched to same physical cluster
                centroid_drifts.append(min_dist)
                matched_count += 1

        avg_drift_m = round(float(np.mean(centroid_drifts)), 2) if centroid_drifts else 0.0
        jaccard_stability = round(matched_count / float(len(base_hotspots)), 4) if base_hotspots else 1.0

        results.append({
            "experiment": exp["name"],
            "sample_ratio": sample_ratio,
            "perturbation_meters": pert_m,
            "discovered_clusters": res["total_clusters"],
            "baseline_clusters": len(base_hotspots),
            "jaccard_stability_index": jaccard_stability,
            "average_centroid_drift_meters": avg_drift_m,
            "noise_percentage": res["noise_percentage"]
        })

    # Save to CSV
    fieldnames = [
        "experiment", "sample_ratio", "perturbation_meters", "discovered_clusters",
        "baseline_clusters", "jaccard_stability_index", "average_centroid_drift_meters", "noise_percentage"
    ]

    with open(STABILITY_RESULTS_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in results:
            writer.writerow(r)

    print("\n[Stability Analysis Results Summary]")
    print(f"{'Experiment Name':<32} | {'Clusters':<9} | {'Stability Index':<16} | {'Avg Centroid Drift':<20} | {'Noise %':<8}")
    print("-" * 95)
    for r in results:
        print(f"{r['experiment']:<32} | {r['discovered_clusters']:<9} | {r['jaccard_stability_index']*100:14.1f}% | {r['average_centroid_drift_meters']:<18.2f}m | {r['noise_percentage']:<7.1f}%")

if __name__ == "__main__":
    run_stability_analysis()
