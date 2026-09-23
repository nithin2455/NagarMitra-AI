"""
benchmark_scalability.py
Inference throughput and latency benchmarking for Component 5 — AI SLA Breach Prediction.
Evaluates single-sample latency and batch inference across 1,000, 10,000, and 100,000 complaints.
"""

import os
import time
import json
import pandas as pd
import numpy as np
from sla_engine import SLAPredictor

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SPLITS_DIR = os.path.join(BASE_DIR, "data", "splits")
ARTIFACT_DIR = os.path.join(BASE_DIR, "ml", "sla_prediction", "artifacts")

def run_benchmark():
    predictor = SLAPredictor()
    predictor.load_artifacts(ARTIFACT_DIR)

    test_df = pd.read_csv(os.path.join(SPLITS_DIR, "sla_test.csv"))
    
    # 1. Single sample latency (1,000 iterations)
    sample_dict = test_df.iloc[0].to_dict()
    
    start_t = time.perf_counter()
    for _ in range(1000):
        predictor.predict_single(sample_dict)
    end_t = time.perf_counter()
    
    single_latency_ms = ((end_t - start_t) / 1000.0) * 1000.0
    print(f"Single-Sample API Latency: {single_latency_ms:.3f} ms / request")
    
    # 2. Batch Inference Scalability
    batch_sizes = [1000, 10000, 100000]
    results = []
    
    for size in batch_sizes:
        # Replicate test_df to reach target batch size
        num_repeats = (size // len(test_df)) + 1
        large_df = pd.concat([test_df] * num_repeats, ignore_index=True).iloc[:size]
        
        t0 = time.perf_counter()
        probs = predictor.predict_proba(large_df)
        t1 = time.perf_counter()
        
        elapsed_sec = t1 - t0
        throughput = size / elapsed_sec
        
        results.append({
            "Batch Size": f"{size:,}",
            "Time (s)": round(elapsed_sec, 3),
            "Throughput (req/sec)": round(throughput, 1),
            "Avg Latency (ms/item)": round((elapsed_sec / size) * 1000, 4)
        })
        
    df_res = pd.DataFrame(results)
    print("\n==========================================")
    print("BATCH INFERENCE SCALABILITY BENCHMARK")
    print("==========================================")
    print(df_res.to_string(index=False))

if __name__ == "__main__":
    run_benchmark()
