"""
CivicPulse AI Component 1 — Python ML Unit Test Suite
"""

import os
import sys
import json
import unittest

sys.path.insert(0, os.path.dirname(__file__))
from predict import ComplaintClassifier

class TestComplaintClassifier(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.classifier = ComplaintClassifier()

    def test_01_model_loads_successfully(self):
        self.assertIsNotNone(self.classifier.vectorizer)
        self.assertIsNotNone(self.classifier.classifier)

    def test_02_predict_pothole_road_complaint(self):
        text = "There is a large deep pothole on the main road causing severe vehicle damage and traffic gridlock."
        res = self.classifier.predict(text)
        self.assertEqual(res["category"], "roads")
        self.assertEqual(res["departmentName"], "Roads & Infrastructure")
        self.assertGreaterEqual(res["confidence"], 0.0)
        self.assertLessEqual(res["confidence"], 1.0)
        self.assertFalse(res["isFallback"])

    def test_03_predict_sewage_drainage_complaint(self):
        text = "Overflowing sewage water leaking onto the street with terrible smell near housing complex."
        res = self.classifier.predict(text)
        self.assertEqual(res["category"], "drainage")
        self.assertEqual(res["departmentName"], "Drainage & Sewerage")

    def test_04_predict_garbage_complaint(self):
        text = "Huge uncollected garbage dump overflowing from dustbins on the market road."
        res = self.classifier.predict(text)
        self.assertEqual(res["category"], "garbage")
        self.assertEqual(res["departmentName"], "Sanitation & Solid Waste")

    def test_05_predict_water_burst_complaint(self):
        text = "Main drinking water pipeline burst flooding the road with clean water."
        res = self.classifier.predict(text)
        self.assertEqual(res["category"], "water")
        self.assertEqual(res["departmentName"], "Water Supply & Quality")

    def test_06_predict_streetlight_complaint(self):
        text = "Streetlights on the highway are completely dark and non-functional at night."
        res = self.classifier.predict(text)
        self.assertEqual(res["category"], "streetlights")
        self.assertEqual(res["departmentName"], "Electricity & Streetlights")

    def test_07_handle_empty_input(self):
        res = self.classifier.predict("")
        self.assertEqual(res["category"], "other")
        self.assertTrue(res["isFallback"])
        self.assertEqual(res["confidence"], 0.0)

    def test_08_handle_unusual_noise_text(self):
        res = self.classifier.predict("123456 !!! ??? ### $$$ %%%")
        self.assertIn("category", res)
        self.assertIn("confidence", res)
        self.assertGreaterEqual(res["confidence"], 0.0)
        self.assertLessEqual(res["confidence"], 1.0)

if __name__ == "__main__":
    unittest.main()
