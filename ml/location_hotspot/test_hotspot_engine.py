"""
CivicPulse AI Component 3 — Comprehensive 15-Test Python Test Suite for Hotspot Detection
"""

import unittest
import os
import sys
import json

sys.path.insert(0, os.path.dirname(__file__))
from hotspot_engine import LocationHotspotEngine

class TestLocationHotspotEngine(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = LocationHotspotEngine()

    # TEST 1: Valid coordinates clustering
    def test_01_valid_coordinates_clustering(self):
        complaints = [
            {"id": "CP-101", "lat": 13.0827, "lng": 80.2707, "departmentId": "roads", "isMasterIssue": True},
            {"id": "CP-102", "lat": 13.0828, "lng": 80.2708, "departmentId": "roads", "isMasterIssue": True},
            {"id": "CP-103", "lat": 13.0829, "lng": 80.2706, "departmentId": "roads", "isMasterIssue": True},
        ]
        res = self.engine.detect_hotspots(complaints, eps_meters=350.0, min_samples=3)
        self.assertEqual(res["total_clusters"], 1)
        self.assertEqual(res["noise_count"], 0)
        self.assertEqual(len(res["hotspots"]), 1)

    # TEST 2: Invalid and missing coordinates filtering
    def test_02_invalid_missing_coordinates(self):
        complaints = [
            {"id": "CP-201", "lat": None, "lng": 80.2707},
            {"id": "CP-202", "lat": 999.0, "lng": 80.2707},
            {"id": "CP-203", "lat": "invalid", "lng": "invalid"},
            {"id": "CP-204", "lat": 13.0827, "lng": 80.2707, "isMasterIssue": True},
        ]
        valid = self.engine.preprocess_complaints(complaints)
        self.assertEqual(len(valid), 1)

    # TEST 3: Empty dataset safety
    def test_03_empty_dataset_safety(self):
        res = self.engine.detect_hotspots([])
        self.assertEqual(res["total_clusters"], 0)
        self.assertEqual(res["total_valid_complaints"], 0)

    # TEST 4: Isolated single point (classified as noise)
    def test_04_isolated_point_noise(self):
        complaints = [
            {"id": "CP-301", "lat": 13.0827, "lng": 80.2707, "isMasterIssue": True}
        ]
        res = self.engine.detect_hotspots(complaints, min_samples=3)
        self.assertEqual(res["total_clusters"], 0)
        self.assertEqual(res["noise_count"], 1)

    # TEST 5: Multiple nearby points form a cluster
    def test_05_multiple_nearby_points_cluster(self):
        complaints = [
            {"id": "CP-401", "lat": 13.0827, "lng": 80.2707, "isMasterIssue": True},
            {"id": "CP-402", "lat": 13.0829, "lng": 80.2708, "isMasterIssue": True},
            {"id": "CP-403", "lat": 13.0826, "lng": 80.2706, "isMasterIssue": True},
            {"id": "CP-404", "lat": 13.0830, "lng": 80.2709, "isMasterIssue": True},
        ]
        res = self.engine.detect_hotspots(complaints, eps_meters=350.0, min_samples=3)
        self.assertEqual(res["total_clusters"], 1)

    # TEST 6: Two distinct spatial clusters
    def test_06_two_distinct_clusters(self):
        complaints = [
            # Cluster 1: Anna Nagar (13.0827, 80.2707)
            {"id": "CP-501", "lat": 13.0827, "lng": 80.2707, "isMasterIssue": True},
            {"id": "CP-502", "lat": 13.0828, "lng": 80.2708, "isMasterIssue": True},
            {"id": "CP-503", "lat": 13.0829, "lng": 80.2706, "isMasterIssue": True},

            # Cluster 2: Guindy (~10 km away)
            {"id": "CP-601", "lat": 13.0067, "lng": 80.2020, "isMasterIssue": True},
            {"id": "CP-602", "lat": 13.0068, "lng": 80.2021, "isMasterIssue": True},
            {"id": "CP-603", "lat": 13.0069, "lng": 80.2019, "isMasterIssue": True},
        ]
        res = self.engine.detect_hotspots(complaints, eps_meters=350.0, min_samples=3)
        self.assertEqual(res["total_clusters"], 2)

    # TEST 7: Department-specific clustering mode
    def test_07_department_specific_mode(self):
        complaints = [
            {"id": "CP-701", "lat": 13.0827, "lng": 80.2707, "departmentId": "roads", "isMasterIssue": True},
            {"id": "CP-702", "lat": 13.0828, "lng": 80.2708, "departmentId": "roads", "isMasterIssue": True},
            {"id": "CP-703", "lat": 13.0829, "lng": 80.2706, "departmentId": "roads", "isMasterIssue": True},
            {"id": "CP-704", "lat": 13.0827, "lng": 80.2707, "departmentId": "water", "isMasterIssue": True},
        ]
        res_roads = self.engine.detect_hotspots(complaints, mode="DEPARTMENT", department="roads", min_samples=3)
        res_water = self.engine.detect_hotspots(complaints, mode="DEPARTMENT", department="water", min_samples=3)
        self.assertEqual(res_roads["total_clusters"], 1)
        self.assertEqual(res_water["total_clusters"], 0)

    # TEST 8: Haversine distance accuracy
    def test_08_haversine_distance_accuracy(self):
        d = LocationHotspotEngine.haversine_distance_meters(13.0827, 80.2707, 13.0827, 80.2716)
        self.assertGreater(d, 90.0)
        self.assertLess(d, 105.0)

    # TEST 9: Raw Reports vs Master Issues mode
    def test_09_master_vs_raw_mode(self):
        complaints = [
            {"id": "CP-801", "lat": 13.0827, "lng": 80.2707, "isMasterIssue": True, "isDuplicate": False},
            {"id": "CP-802", "lat": 13.0827, "lng": 80.2707, "isMasterIssue": False, "isDuplicate": True},
            {"id": "CP-803", "lat": 13.0827, "lng": 80.2707, "isMasterIssue": False, "isDuplicate": True},
            {"id": "CP-804", "lat": 13.0828, "lng": 80.2708, "isMasterIssue": True, "isDuplicate": False},
            {"id": "CP-805", "lat": 13.0829, "lng": 80.2706, "isMasterIssue": True, "isDuplicate": False},
        ]

        engine_master = LocationHotspotEngine(config={"use_master_issues": True})
        engine_raw = LocationHotspotEngine(config={"use_master_issues": False})

        res_m = engine_master.detect_hotspots(complaints, min_samples=3)
        res_r = engine_raw.detect_hotspots(complaints, min_samples=3)

        self.assertEqual(res_m["total_valid_complaints"], 3)
        self.assertEqual(res_r["total_valid_complaints"], 5)

    # TEST 10: Hotspot prioritization score calculation
    def test_10_prioritization_score(self):
        complaints = [
            {"id": "CP-901", "lat": 13.0827, "lng": 80.2707, "priorityScore": 90, "reportCount": 5, "status": "SUBMITTED", "isMasterIssue": True},
            {"id": "CP-902", "lat": 13.0828, "lng": 80.2708, "priorityScore": 85, "reportCount": 3, "status": "IN_PROGRESS", "isMasterIssue": True},
            {"id": "CP-903", "lat": 13.0829, "lng": 80.2706, "priorityScore": 80, "reportCount": 2, "status": "SUBMITTED", "isMasterIssue": True},
        ]
        res = self.engine.detect_hotspots(complaints, min_samples=3)
        h = res["hotspots"][0]
        self.assertGreater(h["hotspot_score"], 50.0)
        self.assertEqual(h["hotspot_rank"], "HIGH_CONCENTRATION")

    # TEST 11: Centroid and radius calculation
    def test_11_centroid_radius_calculation(self):
        complaints = [
            {"id": "CP-1001", "lat": 13.0827, "lng": 80.2707, "isMasterIssue": True},
            {"id": "CP-1002", "lat": 13.0827, "lng": 80.2709, "isMasterIssue": True},
            {"id": "CP-1003", "lat": 13.0827, "lng": 80.2705, "isMasterIssue": True},
        ]
        res = self.engine.detect_hotspots(complaints, min_samples=3)
        h = res["hotspots"][0]
        self.assertAlmostEqual(h["centroid"]["lat"], 13.0827, places=4)
        self.assertAlmostEqual(h["centroid"]["lng"], 80.2707, places=4)
        self.assertGreater(h["radius_meters"], 15.0)

    # TEST 12: Open vs Resolved status breakdown
    def test_12_status_breakdown(self):
        complaints = [
            {"id": "CP-1101", "lat": 13.0827, "lng": 80.2707, "status": "VERIFIED_RESOLVED", "isMasterIssue": True},
            {"id": "CP-1102", "lat": 13.0828, "lng": 80.2708, "status": "CLOSED", "isMasterIssue": True},
            {"id": "CP-1103", "lat": 13.0829, "lng": 80.2706, "status": "IN_PROGRESS", "isMasterIssue": True},
        ]
        res = self.engine.detect_hotspots(complaints, min_samples=3)
        h = res["hotspots"][0]
        self.assertEqual(h["resolved_count"], 2)
        self.assertEqual(h["open_count"], 1)

    # TEST 13: Dominant category determination
    def test_13_dominant_category(self):
        complaints = [
            {"id": "CP-1201", "lat": 13.0827, "lng": 80.2707, "categoryId": "water", "isMasterIssue": True},
            {"id": "CP-1202", "lat": 13.0828, "lng": 80.2708, "categoryId": "water", "isMasterIssue": True},
            {"id": "CP-1203", "lat": 13.0829, "lng": 80.2706, "categoryId": "roads", "isMasterIssue": True},
        ]
        res = self.engine.detect_hotspots(complaints, min_samples=3)
        h = res["hotspots"][0]
        self.assertEqual(h["dominant_category"], "water")

    # TEST 14: Quality metrics calculation
    def test_14_quality_metrics(self):
        complaints = [
            # Cluster 1
            {"id": "C1-1", "lat": 13.0827, "lng": 80.2707, "isMasterIssue": True},
            {"id": "C1-2", "lat": 13.0828, "lng": 80.2708, "isMasterIssue": True},
            {"id": "C1-3", "lat": 13.0829, "lng": 80.2706, "isMasterIssue": True},
            # Cluster 2
            {"id": "C2-1", "lat": 13.0067, "lng": 80.2020, "isMasterIssue": True},
            {"id": "C2-2", "lat": 13.0068, "lng": 80.2021, "isMasterIssue": True},
            {"id": "C2-3", "lat": 13.0069, "lng": 80.2019, "isMasterIssue": True},
        ]
        res = self.engine.detect_hotspots(complaints, min_samples=3)
        self.assertIsNotNone(res["quality_metrics"])
        self.assertIn("silhouette_score", res["quality_metrics"])

    # TEST 15: Configurable eps_meters parameter
    def test_15_configurable_eps_meters(self):
        complaints = [
            {"id": "CP-1501", "lat": 13.0827, "lng": 80.2707, "isMasterIssue": True},
            {"id": "CP-1502", "lat": 13.0850, "lng": 80.2707, "isMasterIssue": True}, # ~255 meters away
            {"id": "CP-1503", "lat": 13.0870, "lng": 80.2707, "isMasterIssue": True}, # ~477 meters away
        ]
        res_small = self.engine.detect_hotspots(complaints, eps_meters=100.0, min_samples=3)
        res_large = self.engine.detect_hotspots(complaints, eps_meters=500.0, min_samples=3)

        self.assertEqual(res_small["total_clusters"], 0)
        self.assertEqual(res_large["total_clusters"], 1)

if __name__ == "__main__":
    unittest.main()
