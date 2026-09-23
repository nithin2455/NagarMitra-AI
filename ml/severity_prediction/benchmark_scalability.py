"""
@file benchmark_scalability.py
@description Scalability Benchmark Script for Component 4 Random Forest Severity Model.
Measures actual training latency, inference latency, and memory throughput across dataset scales
(1,000, 5,000, 10,000, 50,000, and 100,000 complaints).
"""

import os
import time
import json
import numpy as np
import pandas as pd
from severity_engine import SeverityPredictor, SEVERITY_CLASSES

def benchmark_scalability():
    print("=== CIVICPULSE COMPONENT 4: SCALABILITY BENCHMARK ===")

    train_df = pd.read_csv("ml/severity_prediction/data/severity_train_clean.csv")

    scales = [1000, 5000, 10000, 50000, 100000]
    benchmark_results = []

    for N in scales:
        print(f"\nBenchmarking Dataset Scale: N = {N:,} complaints...")

        # Oversample train_df to reach N if N > len(train_df)
        if N <= len(train_df):
            sample_df = train_df.iloc[:N].copy()
        else:
            repeats = (N // len(train_df)) + 1
            sample_df = pd.concat([train_df] * repeats, ignore_index=True).iloc[:N].copy()

        # Measure Training Time
        predictor = SeverityPredictor(n_estimators=50, max_depth=8, min_samples_split=5, class_weight='balanced')
        t0_train = time.time()
        predictor.fit(sample_df)
        t_train = time.time() - t0_train

        # Measure Inference Time (Batch of 500 complaints)
        batch_df = sample_df.iloc[:500].copy()
        t0_inf = time.time()
        preds = predictor.predict(batch_df)
        t_inf_batch = time.time() - t0_inf
        latency_per_sample_ms = (t_inf_batch / len(batch_df)) * 1000.0

        benchmark_results.append({
            'num_records': N,
            'training_time_sec': round(t_train, 4),
            'batch_500_inference_sec': round(t_inf_batch, 4),
            'latency_per_sample_ms': round(latency_per_sample_ms, 4)
        })

        print(f"  Training Time  : {t_train:.4f} seconds")
        print(f"  Inference Latency: {latency_per_sample_ms:.3f} ms / complaint")

    os.makedirs("ml/severity_prediction/evaluation", exist_ok=True)
    with open("ml/severity_prediction/evaluation/scalability_results.json", "w") as f:
        json.dump(benchmark_results, f, indent=2)

    print("\n[SUCCESS] Scalability benchmark results saved to ml/severity_prediction/evaluation/scalability_results.json")
    return benchmark_results

if __name__ == "__main__":
    benchmark_scalability()
