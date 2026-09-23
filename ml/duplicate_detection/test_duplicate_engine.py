"""
CivicPulse AI Component 2 — Comprehensive 20-Test Python Test Suite
"""

import unittest
import os
import sys
import json
import math

sys.path.insert(0, os.path.dirname(__file__))
from duplicate_engine import MultimodalDuplicateEngine

class TestMultimodalDuplicateEngine(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = MultimodalDuplicateEngine()

    # TEST 1: Same text + same location + same image -> DUPLICATE
    def test_01_same_text_location_image_duplicate(self):
        c1 = {
            "id": "CP-1001",
            "title": "Large pothole near main college gate",
            "description": "Deep crater on Anna Salai creating hazard for two wheelers.",
            "categoryId": "roads",
            "lat": 13.0827, "lng": 80.2707,
            "mediaUrls": ["http://civicpulse.org/img1.jpg"]
        }
        c2 = {
            "id": "CP-1002",
            "title": "Large pothole near main college gate",
            "description": "Deep crater on Anna Salai creating hazard for two wheelers.",
            "categoryId": "roads",
            "lat": 13.0827, "lng": 80.2707,
            "mediaUrls": ["http://civicpulse.org/img1.jpg"]
        }
        res = self.engine.evaluate_pair(c1, c2)
        self.assertTrue(res["isDuplicate"])
        self.assertEqual(res["decision"], "HIGH_CONFIDENCE_DUPLICATE")
        self.assertGreaterEqual(res["fusedScore"], 0.90)

    # TEST 2: Different wording + same location + same image -> DUPLICATE
    def test_02_different_wording_same_location_image(self):
        c1 = {
            "id": "CP-1001",
            "title": "Large pothole near college gate",
            "description": "Deep crater on asphalt causing traffic slowdown",
            "categoryId": "roads",
            "lat": 13.0827, "lng": 80.2707,
            "mediaUrls": ["http://civicpulse.org/img1.jpg"]
        }
        c2 = {
            "id": "CP-1002",
            "title": "Deep road damage near college entrance",
            "description": "Severe broken pavement surface creating danger",
            "categoryId": "roads",
            "lat": 13.0827, "lng": 80.2707,
            "mediaUrls": ["http://civicpulse.org/img1.jpg"]
        }
        res = self.engine.evaluate_pair(c1, c2)
        self.assertTrue(res["isDuplicate"])
        self.assertGreaterEqual(res["fusedScore"], 0.75)

    # TEST 3: Different wording + nearby location (30m) -> DUPLICATE
    def test_03_nearby_location_30m_duplicate(self):
        # 0.00025 deg lat approx 28 meters
        c1 = {"title": "Pothole on 4th Main Road", "description": "Road damage near bus stop", "categoryId": "roads", "lat": 13.0827, "lng": 80.2707}
        c2 = {"title": "Bad road patch near bus stand", "description": "Road damage near bus stop area", "categoryId": "roads", "lat": 13.08295, "lng": 80.2707}
        res = self.engine.evaluate_pair(c1, c2)
        self.assertTrue(res["isDuplicate"])

    # TEST 4: Same category + far location (5 km away) -> NOT DUPLICATE
    def test_04_far_location_5km_not_duplicate(self):
        # 0.045 deg lat approx 5 km
        c1 = {"title": "Deep pothole on road", "description": "Big pothole on road", "categoryId": "roads", "lat": 13.0827, "lng": 80.2707}
        c2 = {"title": "Deep pothole on road", "description": "Big pothole on road", "categoryId": "roads", "lat": 13.1277, "lng": 80.2707}
        res = self.engine.evaluate_pair(c1, c2)
        self.assertFalse(res["isDuplicate"])
        self.assertEqual(res["locationSimilarity"], 0.0)

    # TEST 5: Same category + similar text + 3 km location -> NOT DUPLICATE
    def test_05_similar_text_3km_not_duplicate(self):
        c1 = {"title": "Water supply line burst", "description": "Drinking water pipeline burst", "categoryId": "water", "lat": 13.0827, "lng": 80.2707}
        c2 = {"title": "Water supply line burst", "description": "Drinking water pipeline burst", "categoryId": "water", "lat": 13.1100, "lng": 80.2707}
        res = self.engine.evaluate_pair(c1, c2)
        self.assertFalse(res["isDuplicate"])

    # TEST 6: Same location + different category -> NOT DUPLICATE (Safeguard)
    def test_06_same_location_different_category_safeguard(self):
        c1 = {"title": "Pothole on street", "description": "Road pothole", "categoryId": "roads", "lat": 13.0827, "lng": 80.2707}
        c2 = {"title": "Streetlight dark", "description": "Lamp non functional", "categoryId": "streetlights", "lat": 13.0827, "lng": 80.2707}
        res = self.engine.evaluate_pair(c1, c2)
        self.assertFalse(res["isDuplicate"])
        self.assertEqual(res["decision"], "DIFFERENT_DEPARTMENT")

    # TEST 7: Same image + 10 km location -> NOT DUPLICATE (Safeguard)
    def test_07_same_image_far_location_safeguard(self):
        c1 = {"title": "Pothole A", "description": "Pothole text", "categoryId": "roads", "lat": 13.0827, "lng": 80.2707, "mediaUrls": ["imgA.jpg"]}
        c2 = {"title": "Pothole B", "description": "Pothole text", "categoryId": "roads", "lat": 13.2000, "lng": 80.2707, "mediaUrls": ["imgA.jpg"]}
        res = self.engine.evaluate_pair(c1, c2)
        self.assertFalse(res["isDuplicate"])

    # TEST 8: No image available -> Text + Location pipeline works cleanly
    def test_08_no_image_pipeline_works(self):
        c1 = {"title": "Garbage dump near school", "description": "Trash uncollected for 3 days", "categoryId": "garbage", "lat": 13.0827, "lng": 80.2707}
        c2 = {"title": "Garbage pile near school gate", "description": "Trash uncollected for 3 days", "categoryId": "garbage", "lat": 13.0827, "lng": 80.2707}
        res = self.engine.evaluate_pair(c1, c2)
        self.assertTrue(res["isDuplicate"])
        self.assertGreaterEqual(res["fusedScore"], 0.75)

    # TEST 9: Canonical Master Resolution (A -> Master, B -> duplicate of A, C matching B resolves to A)
    def test_09_canonical_master_resolution(self):
        new_c = {"title": "Pothole report", "description": "Deep crater", "categoryId": "roads", "lat": 13.0827, "lng": 80.2707}
        candidates = [
            {"id": "CP-1002", "masterComplaintId": "CP-1001", "duplicateGroupId": "GRP-0001", "title": "Pothole report", "description": "Deep crater", "categoryId": "roads", "lat": 13.0827, "lng": 80.2707}
        ]
        match = self.engine.find_best_master_match(new_c, candidates)
        self.assertIsNotNone(match)
        self.assertEqual(match["matchedMasterId"], "CP-1001")
        self.assertEqual(match["duplicateGroupId"], "GRP-0001")

    # TEST 10: Multiple matches selects highest confidence canonical master
    def test_10_multiple_matches_selects_best(self):
        new_c = {"title": "Choked sewer pipe", "description": "Overflowing stinking sewage water", "categoryId": "drainage", "lat": 13.0827, "lng": 80.2707}
        candidates = [
            {"id": "CP-2001", "masterComplaintId": "CP-2001", "duplicateGroupId": "GRP-2001", "title": "Sewer pipe clogged", "description": "Overflowing stinking sewage water", "categoryId": "drainage", "lat": 13.0827, "lng": 80.2707},
            {"id": "CP-3001", "masterComplaintId": "CP-3001", "duplicateGroupId": "GRP-3001", "title": "Minor drain issue", "description": "Water standing", "categoryId": "drainage", "lat": 13.0850, "lng": 80.2707}
        ]
        match = self.engine.find_best_master_match(new_c, candidates)
        self.assertIsNotNone(match)
        self.assertEqual(match["matchedMasterId"], "CP-2001")

    # TEST 11: Haversine distance accuracy
    def test_11_haversine_distance_accuracy(self):
        # Known distance between 13.0827, 80.2707 and 13.0827, 80.2716 is approx 97.6 meters
        d = self.engine.calculate_haversine_distance(13.0827, 80.2707, 13.0827, 80.2716)
        self.assertGreater(d, 90.0)
        self.assertLess(d, 105.0)

    # TEST 12: Location similarity at 50m is 1.0
    def test_12_location_similarity_50m(self):
        sim = self.engine.calculate_location_similarity(13.0827, 80.2707, 13.0827, 80.2710)
        self.assertEqual(sim, 1.0)

    # TEST 13: Location similarity at 500m is between 0.1 and 0.5
    def test_13_location_similarity_500m(self):
        sim = self.engine.calculate_location_similarity(13.0827, 80.2707, 13.0872, 80.2707)
        self.assertGreater(sim, 0.0)
        self.assertLess(sim, 0.5)

    # TEST 14: Text n-gram similarity for typos
    def test_14_text_ngram_similarity_typos(self):
        sim = self.engine.calculate_text_similarity("Deep pothole on road", "Deap pothol on roade")
        self.assertGreater(sim, 0.60)

    # TEST 15: Configurable weights enforcement
    def test_15_configurable_weights(self):
        engine_custom = MultimodalDuplicateEngine(config={
            "location_radius_meters": 50.0,
            "max_location_distance_meters": 500.0,
            "weights": {"text": 0.5, "location": 0.5, "image": 0.0},
            "weights_no_image": {"text": 0.5, "location": 0.5, "image": 0.0},
            "high_confidence_threshold": 0.80,
            "medium_confidence_threshold": 0.50
        })
        c1 = {"title": "Pothole", "description": "Road damage", "categoryId": "roads", "lat": 13.0827, "lng": 80.2707}
        c2 = {"title": "Pothole", "description": "Road damage", "categoryId": "roads", "lat": 13.0827, "lng": 80.2707}
        res = engine_custom.evaluate_pair(c1, c2)
        self.assertTrue(res["isDuplicate"])

    # TEST 16: Missing field safety
    def test_16_missing_field_safety(self):
        res = self.engine.evaluate_pair({}, {})
        self.assertIn("fusedScore", res)
        self.assertFalse(res["isDuplicate"])

    # TEST 17: Candidate retrieval scalability logic
    def test_17_candidate_retrieval_empty(self):
        c = {"title": "Pothole", "description": "Road damage", "categoryId": "roads", "lat": 13.0827, "lng": 80.2707}
        match = self.engine.find_best_master_match(c, [])
        self.assertIsNone(match)

    # TEST 18: Unsupervised similarity score transparency
    def test_18_similarity_score_transparency(self):
        c1 = {"title": "Streetlight dark", "description": "Lamp broken", "categoryId": "streetlights", "lat": 13.0827, "lng": 80.2707}
        c2 = {"title": "Streetlight dark", "description": "Lamp broken", "categoryId": "streetlights", "lat": 13.0827, "lng": 80.2707}
        res = self.engine.evaluate_pair(c1, c2)
        self.assertIn("textSimilarity", res)
        self.assertIn("locationSimilarity", res)
        self.assertIn("imageSimilarity", res)

    # TEST 19: Medium confidence review classification
    def test_19_medium_confidence_review(self):
        c1 = {"title": "Water leak", "description": "Water dripping near gate", "categoryId": "water", "lat": 13.0827, "lng": 80.2707}
        c2 = {"title": "Water leakage", "description": "Slight wet road surface", "categoryId": "water", "lat": 13.0845, "lng": 80.2707}
        res = self.engine.evaluate_pair(c1, c2)
        self.assertEqual(res["decision"], "MEDIUM_CONFIDENCE_REVIEW")
        self.assertFalse(res["isDuplicate"])

    # TEST 20: Master issue group ID assignment
    def test_20_master_group_id_assignment(self):
        new_c = {"title": "Broken bench", "description": "Park bench broken", "categoryId": "infrastructure", "lat": 13.0827, "lng": 80.2707}
        candidates = [
            {"id": "CP-4001", "masterComplaintId": "CP-4001", "duplicateGroupId": "GRP-4001", "title": "Broken bench", "description": "Park bench broken", "categoryId": "infrastructure", "lat": 13.0827, "lng": 80.2707}
        ]
        match = self.engine.find_best_master_match(new_c, candidates)
        self.assertEqual(match["duplicateGroupId"], "GRP-4001")

if __name__ == "__main__":
    unittest.main()
