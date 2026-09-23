"""
test_anomaly_detection.py
Unit tests for Component 6 — AI Anomaly & Suspicious Pattern Detection.
Runs 16 thorough verification unit tests.
"""

import os
import unittest
import numpy as np
import pandas as pd
from anomaly_engine import IsolationForestPredictor, NUMERICAL_COLS, CATEGORICAL_COLS

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
ARTIFACT_DIR = os.path.join(BASE_DIR, "ml", "anomaly_detection", "artifacts")

class TestAnomalyDetection(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.predictor = IsolationForestPredictor()
        cls.predictor.load_artifacts(ARTIFACT_DIR)

    def test_01_model_loaded(self):
        self.assertIsNotNone(self.predictor.model)
        self.assertTrue(hasattr(self.predictor.model, 'decision_function'))

    def test_02_preprocessor_loaded(self):
        self.assertIsNotNone(self.predictor.preprocessor)
        self.assertTrue(self.predictor.preprocessor.is_fitted)

    def test_03_normal_window_prediction(self):
        sample = {
            'department_code': 'DEPT_ROADS',
            'raw_report_count': 10,
            'master_issue_count': 5,
            'duplicate_ratio': 0.5,
            'hotspot_score': 20.0
        }
        res = self.predictor.predict_single(sample)
        self.assertIn('anomaly_score', res)
        self.assertIn('anomaly_level', res)
        self.assertIn('anomaly_type', res)

    def test_04_synthetic_anomaly_prediction(self):
        sample = {
            'department_code': 'DEPT_DRAINAGE',
            'raw_report_count': 120,
            'master_issue_count': 3,
            'duplicate_ratio': 0.97,
            'hotspot_score': 95.0,
            'critical_ratio': 0.85
        }
        res = self.predictor.predict_single(sample)
        self.assertTrue(res['is_anomaly'])
        self.assertIn(res['anomaly_level'], ['MEDIUM', 'HIGH'])

    def test_05_score_range(self):
        sample = {'raw_report_count': 15}
        res = self.predictor.predict_single(sample)
        score = res['anomaly_score']
        self.assertGreaterEqual(score, 0.0)
        self.assertLessEqual(score, 1.0)

    def test_06_score_direction(self):
        # Higher anomaly score must indicate higher isolation deviation
        normal_sample = {'raw_report_count': 8, 'duplicate_ratio': 0.2, 'hotspot_score': 15.0}
        anom_sample = {'raw_report_count': 150, 'duplicate_ratio': 0.98, 'hotspot_score': 98.0}

        res_norm = self.predictor.predict_single(normal_sample)
        res_anom = self.predictor.predict_single(anom_sample)

        self.assertGreater(res_anom['anomaly_score'], res_norm['anomaly_score'])

    def test_07_valid_level_mapping(self):
        self.assertEqual(self.predictor.map_anomaly_level(0.25), 'LOW')
        self.assertEqual(self.predictor.map_anomaly_level(0.60), 'MEDIUM')
        self.assertEqual(self.predictor.map_anomaly_level(0.85), 'HIGH')

    def test_08_pattern_classification_volume_spike(self):
        sample = {'raw_report_count': 100, 'rate_of_change': 4.5}
        pattern = self.predictor.classify_anomaly_pattern(sample)
        self.assertEqual(pattern, 'VOLUME_SPIKE')

    def test_09_pattern_classification_duplicate_concentration(self):
        sample = {'raw_report_count': 16, 'duplicate_ratio': 0.90, 'rate_of_change': 0.0}
        pattern = self.predictor.classify_anomaly_pattern(sample)
        self.assertEqual(pattern, 'DUPLICATE_CONCENTRATION')

    def test_10_contributing_indicators_generation(self):
        sample = {'raw_report_count': 80, 'duplicate_ratio': 0.85, 'hotspot_score': 90.0}
        indicators = self.predictor.generate_contributing_indicators(sample)
        self.assertGreater(len(indicators), 0)
        # Ensure no forbidden word "fraud" appears in automated indicators
        for ind in indicators:
            self.assertNotIn('fraud', ind.lower())

    def test_11_empty_payload_handling(self):
        sample = {}
        res = self.predictor.predict_single(sample)
        self.assertIn('anomaly_score', res)

    def test_12_comp2_duplicate_ratio_integration(self):
        sample = {'raw_report_count': 50, 'master_issue_count': 2, 'duplicate_ratio': 0.96}
        res = self.predictor.predict_single(sample)
        self.assertIsNotNone(res['anomaly_score'])

    def test_13_comp3_hotspot_integration(self):
        sample = {'hotspot_score': 92.5, 'local_density': 0.925, 'cluster_size': 60}
        res = self.predictor.predict_single(sample)
        self.assertIsNotNone(res['anomaly_score'])

    def test_14_comp4_severity_integration(self):
        sample = {'critical_count': 25, 'critical_ratio': 0.833}
        res = self.predictor.predict_single(sample)
        self.assertIsNotNone(res['anomaly_score'])

    def test_15_comp5_sla_risk_integration(self):
        sample = {'high_sla_risk_count': 30, 'high_sla_risk_ratio': 0.857}
        res = self.predictor.predict_single(sample)
        self.assertIsNotNone(res['anomaly_score'])

    def test_16_metadata_exists(self):
        meta_path = os.path.join(ARTIFACT_DIR, 'model_meta.json')
        self.assertTrue(os.path.exists(meta_path))

if __name__ == '__main__':
    unittest.main()
