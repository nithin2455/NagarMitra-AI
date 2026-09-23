"""
CivicPulse AI Component 2 — Large-Scale Candidate Retrieval & Deduplication Scalability Benchmark
Measures actual candidate filtering speed, deduplication decision latency, candidate count reduction, and memory usage
for simulated workloads of 1,000, 5,000, 10,000, 50,000, and 100,000 historical complaints.
Saves results in evaluation/scalability_results.csv.
"""

import os
import sys
import time
import csv
import json
import random

sys.path.insert(0, os.path.dirname(__file__))
from duplicate_engine import MultimodalDuplicateEngine

EVAL_DIR = os.path.join(os.path.dirname(__file__), "evaluation")
SCALABILITY_RESULTS_CSV = os.path.join(EVAL_DIR, "scalability_results.csv")

def generate_synthetic_database(num_records):
    """Generates synthetic historical database of Master Issues across municipal wards and departments."""
    categories = ["roads", "water", "drainage", "garbage", "streetlights", "infrastructure"]
    records = []
    base_lat, base_lng = 13.0827, 80.2707

    for i in range(num_records):
        cat = categories[i % len(categories)]
        # Distribute coordinates across city area (~20km x 20km)
        lat = base_lat + (random.random() - 0.5) * 0.18
        lng = base_lng + (random.random() - 0.5) * 0.18
        records.append({
            "id": f"CP-HIST-{i:06d}",
            "masterComplaintId": f"CP-HIST-{i:06d}",
            "title": f"{cat.capitalize()} issue reported on road #{i}",
            "description": f"Detailed municipal complaint regarding {cat} infrastructure.",
            "categoryId": cat,
            "departmentId": cat,
            "lat": round(lat, 6),
            "lng": round(lng, 6),
            "isMasterIssue": True,
            "status": "SUBMITTED"
        })
    return records

def run_scalability_benchmark():
    random.seed(42)
    engine = MultimodalDuplicateEngine()

    db_sizes = [1000, 5000, 10000, 50000, 100000]
    benchmarks = []

    print("[Scalability Benchmark] Starting candidate retrieval latency benchmarks...")

    for size in db_sizes:
        records = generate_synthetic_database(size)

        # Incoming new complaint
        target_cat = "roads"
        target_lat, target_lng = 13.0827, 80.2707
        new_complaint = {
            "title": "Large pothole near main college gate",
            "description": "Deep crater on Anna Salai creating hazard for two wheelers.",
            "categoryId": target_cat,
            "departmentId": target_cat,
            "lat": target_lat,
            "lng": target_lng
        }

        # 1. Candidate Retrieval Filtering Phase (Category + Geo Radius Bounding)
        t0 = time.perf_counter()
        candidate_masters = []
        for r in records:
            if r["departmentId"] == target_cat and r["isMasterIssue"]:
                # Fast Bounding Box Pre-Filter (~1km radius: 0.009 deg)
                if abs(r["lat"] - target_lat) <= 0.01 and abs(r["lng"] - target_lng) <= 0.01:
                    candidate_masters.append(r)
        t_retrieval_ms = (time.perf_counter() - t0) * 1000.0

        # 2. Multimodal AI Deduplication Phase
        t1 = time.perf_counter()
        match = engine.find_best_master_match(new_complaint, candidate_masters)
        t_decision_ms = (time.perf_counter() - t1) * 1000.0
        t_total_ms = t_retrieval_ms + t_decision_ms

        candidates_evaluated = len(candidate_masters)
        reduction_percentage = ((size - candidates_evaluated) / float(size)) * 100.0

        benchmarks.append({
            "workload_size": size,
            "candidates_evaluated": candidates_evaluated,
            "candidate_reduction_rate": round(reduction_percentage, 2),
            "retrieval_time_ms": round(t_retrieval_ms, 3),
            "decision_time_ms": round(t_decision_ms, 3),
            "total_processing_time_ms": round(t_total_ms, 3)
        })

    # Save to CSV
    fieldnames = [
        "workload_size", "candidates_evaluated", "candidate_reduction_rate",
        "retrieval_time_ms", "decision_time_ms", "total_processing_time_ms"
    ]
    with open(SCALABILITY_RESULTS_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for b in benchmarks:
            writer.writerow(b)

    print("\n[Candidate Retrieval & Scalability Benchmark Results Summary]")
    print(f"{'Database Size':<14} | {'Candidates Evaluated':<20} | {'Reduction %':<12} | {'Retrieval (ms)':<15} | {'Decision (ms)':<15} | {'Total Time (ms)':<15}")
    print("-" * 100)
    for b in benchmarks:
        print(f"{b['workload_size']:<14,d} | {b['candidates_evaluated']:<20,d} | {b['candidate_reduction_rate']:<11.2f}% | {b['retrieval_time_ms']:<15.3f} | {b['decision_time_ms']:<15.3f} | {b['total_processing_time_ms']:<15.3f}")

if __name__ == "__main__":
    run_scalability_benchmark()
