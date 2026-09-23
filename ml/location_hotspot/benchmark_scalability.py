"""
CivicPulse AI Component 3 — Large-Scale DBSCAN Spatial Clustering Scalability Benchmark
Measures actual execution time and memory scaling across historical datasets of 1,000, 5,000, 10,000, 50,000, and 100,000 complaints.
Saves results in evaluation/scalability_results.csv.
"""

import os
import sys
import time
import csv
import json
import random

sys.path.insert(0, os.path.dirname(__file__))
from hotspot_engine import LocationHotspotEngine
from evaluate_hotspots import generate_benchmark_dataset

EVAL_DIR = os.path.join(os.path.dirname(__file__), "evaluation")
SCALABILITY_RESULTS_CSV = os.path.join(EVAL_DIR, "scalability_results.csv")

def run_scalability_benchmark():
    random.seed(42)
    engine = LocationHotspotEngine()

    db_sizes = [1000, 5000, 10000, 50000, 100000]
    benchmarks = []

    print("[Component 3 Scalability Benchmark] Running DBSCAN spatial clustering benchmarks...")

    for size in db_sizes:
        data = generate_benchmark_dataset(size)

        t0 = time.perf_counter()
        res = engine.detect_hotspots(data, eps_meters=350.0, min_samples=5)
        t_exec_ms = (time.perf_counter() - t0) * 1000.0

        benchmarks.append({
            "workload_size": size,
            "valid_complaints": res["total_valid_complaints"],
            "total_clusters": res["total_clusters"],
            "noise_count": res["noise_count"],
            "noise_percentage": res["noise_percentage"],
            "execution_time_ms": round(t_exec_ms, 3)
        })

    # Save to CSV
    fieldnames = [
        "workload_size", "valid_complaints", "total_clusters",
        "noise_count", "noise_percentage", "execution_time_ms"
    ]
    with open(SCALABILITY_RESULTS_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for b in benchmarks:
            writer.writerow(b)

    print("\n[Component 3 Scalability Benchmark Results Summary]")
    print(f"{'Database Size':<14} | {'Valid Complaints':<18} | {'Clusters':<9} | {'Noise %':<9} | {'Execution Time (ms)':<20}")
    print("-" * 80)
    for b in benchmarks:
        print(f"{b['workload_size']:<14,d} | {b['valid_complaints']:<18,d} | {b['total_clusters']:<9} | {b['noise_percentage']:<8.1f}% | {b['execution_time_ms']:<20.3f}")

if __name__ == "__main__":
    run_scalability_benchmark()
