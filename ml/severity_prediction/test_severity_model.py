"""
@file test_severity_model.py
@description Unit test suite for Component 4 (AI Severity / Priority Prediction).
"""

import unittest
import os
import pandas as pd
import numpy as np
from severity_engine import SeverityPredictor, SeverityFeaturePipeline, SEVERITY_CLASSES, extract_engineered_features

class TestSeverityEngine(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.artifact_dir = "ml/severity_prediction/artifacts"
        cls.predictor = SeverityPredictor()
        cls.predictor.load_artifacts(cls.artifact_dir)

    def test_01_artifact_existence(self):
        """Verify model artifact files exist on disk"""
        self.assertTrue(os.path.exists(os.path.join(self.artifact_dir, "random_forest.joblib")))
        self.assertTrue(os.path.exists(os.path.join(self.artifact_dir, "feature_preprocessor.joblib")))
        self.assertTrue(os.path.exists(os.path.join(self.artifact_dir, "model_meta.json")))

    def test_02_feature_extraction(self):
        """Verify engineered features are cleanly extracted without leakage"""
        sample_df = pd.DataFrame([{
            'title': 'Road Damage & Pothole',
            'description': 'Severe dangerous pothole causing accidents near metro station',
            'category_id': 'roads',
            'department_code': 'DEPT_ROADS',
            'district': 'Chennai Central',
            'support_count': 15,
            'master_issue_count': 4,
            'hotspot_priority': 85.0
        }])
        df_feat = extract_engineered_features(sample_df)
        self.assertIn('desc_char_len', df_feat.columns)
        self.assertIn('urgency_kw_count', df_feat.columns)
        self.assertEqual(df_feat['urgency_kw_count'].iloc[0], 5) # damage, pothole, severe, danger, accident

    def test_03_prediction_output_structure(self):
        """Verify single record prediction output format"""
        complaint = {
            'title': 'Sewage Pipe Burst',
            'description': 'Sewage water leaking onto main road causing extreme health hazard and smell.',
            'category_id': 'water',
            'department_code': 'DEPT_WATER'
        }
        res = self.predictor.predict(complaint)
        self.assertIn('predicted_severity', res)
        self.assertIn(res['predicted_severity'], SEVERITY_CLASSES)
        self.assertIn('confidence', res)
        self.assertGreaterEqual(res['confidence'], 0.0)
        self.assertLessEqual(res['confidence'], 1.0)
        self.assertIn('class_probabilities', res)
        self.assertEqual(len(res['class_probabilities']), 4)

    def test_04_four_severity_classes(self):
        """Verify model output covers standard 4 severity classes"""
        for cls_label in SEVERITY_CLASSES:
            self.assertIn(cls_label, self.predictor.classes_)

    def test_05_missing_fields_resilience(self):
        """Verify model gracefully handles missing optional fields"""
        minimal_complaint = {
            'description': 'General complaint regarding trash overflow.'
        }
        res = self.predictor.predict(minimal_complaint)
        self.assertIn('predicted_severity', res)

    def test_06_batch_prediction(self):
        """Verify batch prediction on DataFrame"""
        df = pd.DataFrame([
            {'title': 'Issue 1', 'description': 'Minor street light timing issue', 'category_id': 'streetlights'},
            {'title': 'Issue 2', 'description': 'Dangerous open high voltage wire sparking', 'category_id': 'streetlights'}
        ])
        results = self.predictor.predict(df)
        self.assertEqual(len(results), 2)

    def test_07_deterministic_inference(self):
        """Verify deterministic predictions across repeated calls"""
        complaint = {
            'title': 'Broken Bridge Wall',
            'description': 'Bridge wall collapse hazard on river bank',
            'category_id': 'infrastructure'
        }
        res1 = self.predictor.predict(complaint)
        res2 = self.predictor.predict(complaint)
        self.assertEqual(res1['predicted_severity'], res2['predicted_severity'])
        self.assertAlmostEqual(res1['confidence'], res2['confidence'], places=5)

    def test_08_component_2_and_3_features(self):
        """Verify inclusion of master issue count and hotspot priority score"""
        complaint = {
            'title': 'Pothole report',
            'description': 'Deep pothole on main road',
            'category_id': 'roads',
            'master_issue_count': 12,
            'hotspot_priority': 92.5
        }
        res = self.predictor.predict(complaint)
        self.assertIn(res['predicted_severity'], SEVERITY_CLASSES)


if __name__ == "__main__":
    unittest.main()
