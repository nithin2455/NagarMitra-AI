"""
test_sla_model.py
Unit tests for Component 5 — AI SLA Breach Prediction.
Runs 13 thorough verification unit tests.
"""

import os
import unittest
import numpy as np
import pandas as pd
from sla_engine import SLAPredictor, FORBIDDEN_LEAKAGE_COLS, NUMERICAL_COLS, CATEGORICAL_COLS

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
ARTIFACT_DIR = os.path.join(BASE_DIR, "ml", "sla_prediction", "artifacts")

class TestSLAPrediction(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.predictor = SLAPredictor()
        cls.predictor.load_artifacts(ARTIFACT_DIR)

    def test_01_model_loaded(self):
        self.assertIsNotNone(self.predictor.model)
        self.assertTrue(hasattr(self.predictor.model, 'predict_proba'))

    def test_02_preprocessor_loaded(self):
        self.assertIsNotNone(self.predictor.preprocessor)
        self.assertTrue(self.predictor.preprocessor.is_fitted)

    def test_03_prediction_runs(self):
        sample = {
            'description': 'Water leak on main street',
            'category_id': 'water',
            'department_id': 'DEPT_WATER',
            'response_sla_hours': 4.0
        }
        res = self.predictor.predict_single(sample)
        self.assertIn('breach_probability', res)
        self.assertIn('predicted_breach', res)
        self.assertIn('risk_level', res)

    def test_04_probability_range(self):
        sample = {'description': 'Pothole issue'}
        res = self.predictor.predict_single(sample)
        prob = res['breach_probability']
        self.assertGreaterEqual(prob, 0.0)
        self.assertLessEqual(prob, 1.0)

    def test_05_valid_risk_level(self):
        sample = {'description': 'Garbage overflow'}
        res = self.predictor.predict_single(sample)
        self.assertIn(res['risk_level'], ['LOW', 'MEDIUM', 'HIGH'])

    def test_06_single_dictionary_prediction(self):
        sample = {
            'title': 'Sewage Leak',
            'description': 'Overflowing sewage near school',
            'category_id': 'drainage',
            'predicted_severity': 'CRITICAL',
            'response_sla_hours': 1.5,
            'is_working_hours': 0,
            'hotspot_score_at_submission': 85.0
        }
        res = self.predictor.predict_single(sample)
        self.assertEqual(res['risk_level'], 'HIGH')

    def test_07_empty_text_handling(self):
        sample = {'description': '', 'category_id': 'other'}
        res = self.predictor.predict_single(sample)
        self.assertIn('breach_probability', res)

    def test_08_no_forbidden_leakage(self):
        used_features = NUMERICAL_COLS + CATEGORICAL_COLS + ['description']
        for col in FORBIDDEN_LEAKAGE_COLS:
            self.assertNotIn(col, used_features)

    def test_09_threshold_behavior(self):
        self.assertEqual(self.predictor.map_risk_level(0.10), 'LOW')
        self.assertEqual(self.predictor.map_risk_level(0.50), 'MEDIUM')
        self.assertEqual(self.predictor.map_risk_level(0.85), 'HIGH')

    def test_10_metadata_exists(self):
        meta_path = os.path.join(ARTIFACT_DIR, 'model_meta.json')
        self.assertTrue(os.path.exists(meta_path))

    def test_11_comp4_severity_integration(self):
        sample_low = {'description': 'minor road issue', 'predicted_severity': 'LOW', 'prob_low': 0.8}
        sample_crit = {'description': 'critical hazard', 'predicted_severity': 'CRITICAL', 'prob_critical': 0.9}
        
        res_low = self.predictor.predict_single(sample_low)
        res_crit = self.predictor.predict_single(sample_crit)
        
        self.assertIsNotNone(res_low['breach_probability'])
        self.assertIsNotNone(res_crit['breach_probability'])

    def test_12_comp2_master_count_integration(self):
        sample = {'description': 'Repeated road issue', 'master_issue_count_at_submission': 8}
        res = self.predictor.predict_single(sample)
        self.assertIsNotNone(res['breach_probability'])

    def test_13_comp3_hotspot_score_integration(self):
        sample = {'description': 'Hotspot complaint', 'hotspot_score_at_submission': 90.0, 'is_hotspot_area': 1}
        res = self.predictor.predict_single(sample)
        self.assertIsNotNone(res['breach_probability'])

if __name__ == '__main__':
    unittest.main()
