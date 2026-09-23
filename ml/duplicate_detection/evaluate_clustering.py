"""
CivicPulse AI Component 2 — Group Consolidation & Clustering Evaluation
Evaluates Master Issue grouping accuracy across multi-complaint real-world physical issues (groups of 2, 5, 10, 50 complaints).
Computes Pairwise Precision, Pairwise Recall, Pairwise F1, and Master Canonicalization Accuracy.
Stores output in evaluation/clustering_results.json.
"""

import os
import sys
import json
import random

sys.path.insert(0, os.path.dirname(__file__))
from duplicate_engine import MultimodalDuplicateEngine

EVAL_DIR = os.path.join(os.path.dirname(__file__), "evaluation")
CLUSTERING_RESULTS_JSON = os.path.join(EVAL_DIR, "clustering_results.json")

def generate_issue_cluster(cluster_id, num_complaints, base_lat, base_lng, category):
    """Generates a group of complaints referring to the SAME underlying physical issue."""
    complaints = []
    # Master complaint (first report)
    master_id = f"CP-MASTER-{cluster_id:03d}"
    complaints.append({
        "id": master_id,
        "title": f"Major {category} defect near central market",
        "description": f"Severe physical defect on {category} infrastructure causing public disruption.",
        "categoryId": category,
        "departmentId": category,
        "lat": base_lat,
        "lng": base_lng,
        "mediaUrls": [f"civic_{category}_01.jpg"]
    })

    # Duplicate reports (reports 2 to N)
    for i in range(1, num_complaints):
        # Slight coordinate drift within 50 meters
        delta_lat = (random.random() - 0.5) * 0.0003
        delta_lng = (random.random() - 0.5) * 0.0003
        dup_id = f"CP-DUP-{cluster_id:03d}-{i:02d}"
        complaints.append({
            "id": dup_id,
            "title": f"Report #{i+1} on {category} defect",
            "description": f"Public issue logged regarding {category} problem near central market area.",
            "categoryId": category,
            "departmentId": category,
            "lat": round(base_lat + delta_lat, 6),
            "lng": round(base_lng + delta_lng, 6),
            "mediaUrls": [f"civic_{category}_01.jpg"] if random.random() > 0.3 else []
        })

    return master_id, complaints

def run_clustering_evaluation():
    random.seed(42)
    engine = MultimodalDuplicateEngine()

    group_sizes = [2, 5, 10, 50]
    results_by_size = {}

    for size in group_sizes:
        total_duplicates_processed = 0
        correct_canonical_master_links = 0
        pairwise_tp = 0
        pairwise_fp = 0
        pairwise_fn = 0

        # Simulate 10 distinct physical issue clusters for each group size
        for cluster_idx in range(10):
            cat = random.choice(["roads", "water", "drainage", "garbage"])
            base_lat = 13.0827 + cluster_idx * 0.01
            base_lng = 80.2707 + cluster_idx * 0.01
            master_id, cluster_complaints = generate_issue_cluster(cluster_idx, size, base_lat, base_lng, cat)

            # Active candidate pool starts with Master complaint
            candidate_masters = [cluster_complaints[0]]

            # Sequential arrival of subsequent citizen reports
            for dup in cluster_complaints[1:]:
                total_duplicates_processed += 1
                match = engine.find_best_master_match(dup, candidate_masters)

                if match and match["matchedMasterId"] == master_id:
                    correct_canonical_master_links += 1
                    pairwise_tp += 1
                elif match:
                    pairwise_fp += 1
                else:
                    pairwise_fn += 1

                # Add to candidate pool (with master link)
                dup["masterComplaintId"] = master_id
                dup["isMasterIssue"] = False
                candidate_masters.append(dup)

        canonical_accuracy = correct_canonical_master_links / float(total_duplicates_processed) if total_duplicates_processed > 0 else 0.0
        prec = pairwise_tp / float(pairwise_tp + pairwise_fp) if (pairwise_tp + pairwise_fp) > 0 else 1.0
        rec = pairwise_tp / float(pairwise_tp + pairwise_fn) if (pairwise_tp + pairwise_fn) > 0 else 0.0
        f1 = (2 * prec * rec) / (prec + rec) if (prec + rec) > 0 else 0.0

        results_by_size[f"group_size_{size}"] = {
            "group_size": size,
            "total_duplicate_reports": total_duplicates_processed,
            "correct_canonical_links": correct_canonical_master_links,
            "master_canonicalization_accuracy": round(canonical_accuracy, 4),
            "pairwise_precision": round(prec, 4),
            "pairwise_recall": round(rec, 4),
            "pairwise_f1": round(f1, 4)
        }

    with open(CLUSTERING_RESULTS_JSON, "w", encoding="utf-8") as f:
        json.dump(results_by_size, f, indent=2)

    print("\n[Group Consolidation & Clustering Evaluation Results]")
    print(f"{'Group Size':<12} | {'Total Reports':<14} | {'Canonical Link Acc':<20} | {'Pairwise F1':<12}")
    print("-" * 65)
    for k, v in results_by_size.items():
        print(f"{v['group_size']:<12} | {v['total_duplicate_reports']:<14} | {v['master_canonicalization_accuracy']*100:18.2f}% | {v['pairwise_f1']*100:10.2f}%")

if __name__ == "__main__":
    run_clustering_evaluation()
