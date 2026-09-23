"""
CivicPulse AI Component 1 — Complaint Classifier Prediction Engine
Loads serialized TF-IDF vectorizer and Calibrated Linear Classifier artifacts to predict grievance department & category.
"""

import os
import sys
import json
import joblib
import pandas as pd
import numpy as np

ARTIFACTS_DIR = os.path.join(os.path.dirname(__file__), "artifacts")

class ComplaintClassifier:
    def __init__(self, artifacts_dir=ARTIFACTS_DIR):
        self.artifacts_dir = artifacts_dir
        self.vectorizer_path = os.path.join(artifacts_dir, "tfidf_vectorizer.joblib")
        self.classifier_path = os.path.join(artifacts_dir, "svm_classifier.joblib")
        self.meta_path = os.path.join(artifacts_dir, "model_meta.json")

        if not os.path.exists(self.vectorizer_path) or not os.path.exists(self.classifier_path):
            raise FileNotFoundError(f"Model artifacts missing in {artifacts_dir}. Run train.py first.")

        self.vectorizer = joblib.load(self.vectorizer_path)
        self.classifier = joblib.load(self.classifier_path)

        if os.path.exists(self.meta_path):
            with open(self.meta_path, 'r', encoding='utf-8') as f:
                self.meta = json.load(f)
        else:
            self.meta = {}

        self.department_meta = self.meta.get("department_meta", {
            "roads": {"id": "roads", "name": "Road Damage & Potholes", "departmentCode": "DEPT_ROADS", "departmentName": "Roads & Infrastructure"},
            "drainage": {"id": "drainage", "name": "Drainage & Sewage Overflow", "departmentCode": "DEPT_DRAINAGE", "departmentName": "Drainage & Sewerage"},
            "garbage": {"id": "garbage", "name": "Garbage & Waste Disposal", "departmentCode": "DEPT_SANITATION", "departmentName": "Sanitation & Solid Waste"},
            "water": {"id": "water", "name": "Water Supply Contamination / Burst", "departmentCode": "DEPT_WATER", "departmentName": "Water Supply & Quality"},
            "streetlights": {"id": "streetlights", "name": "Streetlights & Electrical Hazards", "departmentCode": "DEPT_ELECTRICITY", "departmentName": "Electricity & Streetlights"},
            "infrastructure": {"id": "infrastructure", "name": "Public Infrastructure Damage", "departmentCode": "DEPT_WORKS", "departmentName": "Public Works & Infrastructure"},
            "other": {"id": "other", "name": "Other / New Issue", "departmentCode": "DEPT_GENERAL", "departmentName": "General Municipal Operations"}
        })

    def preprocess(self, text):
        if not text or not str(text).strip():
            return ""
        return " ".join(str(text).split())

    def predict(self, description, title=""):
        combined_text = self.preprocess(f"{title} - {description}" if title else description)

        if not combined_text:
            # Fallback for empty or whitespace-only input
            dept_info = self.department_meta["other"]
            return {
                "category": dept_info["id"],
                "categoryName": dept_info["name"],
                "department": dept_info["id"],
                "departmentName": dept_info["departmentName"],
                "departmentCode": dept_info["departmentCode"],
                "confidence": 0.0,
                "modelVersion": self.meta.get("version", "1.0.0"),
                "isFallback": True,
                "message": "Empty description provided."
            }

        # Vectorize text
        X_vec = self.vectorizer.transform([combined_text])

        # Get calibrated probabilities
        probs = self.classifier.predict_proba(X_vec)[0]
        classes = list(self.classifier.classes_)

        max_idx = int(np.argmax(probs))
        predicted_cat = classes[max_idx]
        confidence = float(probs[max_idx])

        # Map to CivicPulse Department Info
        dept_info = self.department_meta.get(predicted_cat, self.department_meta["other"])

        # Format probability distribution
        all_probabilities = {
            classes[i]: round(float(probs[i]), 4) for i in range(len(classes))
        }

        return {
            "category": dept_info["id"],
            "categoryName": dept_info["name"],
            "department": dept_info["id"],
            "departmentName": dept_info["departmentName"],
            "departmentCode": dept_info["departmentCode"],
            "confidence": round(confidence, 4),
            "modelVersion": self.meta.get("version", "1.0.0"),
            "allProbabilities": all_probabilities,
            "isFallback": False
        }

if __name__ == "__main__":
    classifier = ComplaintClassifier()
    sample_text = "There is a large pothole near the college entrance and vehicles are having difficulty passing."
    result = classifier.predict(sample_text)
    print("Sample Prediction Input:", sample_text)
    print("Prediction Result:\n", json.dumps(result, indent=2))
