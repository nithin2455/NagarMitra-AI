"""
sla_engine.py
Core Machine Learning Engine for Component 5 — AI SLA Breach Prediction.
Extracts submission-time (t=0) features, handles TF-IDF text + tabular preprocessing,
trains/evaluates RandomForestClassifier with calibrated probability outputs and risk levels.
"""

import os
import json
import joblib
import numpy as np
import pandas as pd
from scipy.sparse import hstack
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.calibration import CalibratedClassifierCV

URGENCY_KEYWORDS = [
    "urgent", "immediately", "dangerous", "emergency", "blocking",
    "flooding", "hospital", "school", "overflow", "hazard", "fatal",
    "burst", "sparking", "collapsed", "contamination", "crater"
]

NUMERICAL_COLS = [
    'created_hour', 'created_day_of_week', 'created_month',
    'is_weekend', 'is_working_hours', 'response_sla_hours',
    'prob_low', 'prob_medium', 'prob_high', 'prob_critical',
    'master_issue_count_at_submission', 'support_count_at_submission',
    'hotspot_score_at_submission', 'density_score_at_submission',
    'is_hotspot_area', 'latitude', 'longitude',
    'word_count', 'urgency_kw_count'
]

CATEGORICAL_COLS = ['category_id', 'department_id', 'predicted_severity']

FORBIDDEN_LEAKAGE_COLS = [
    'actual_response_hours', 'actual_resolution_hours', 'response_breached',
    'resolution_breached', 'closed_at', 'resolved_at', 'seenAt', 'verifiedResolvedAt',
    'officer_assigned_at', 'escalation_level', 'escalation_reason'
]

class FeaturePreprocessor:
    def __init__(self, max_tfidf_features=50):
        self.scaler = StandardScaler()
        self.encoder = OneHotEncoder(handle_unknown='ignore', sparse_output=False)
        self.tfidf = TfidfVectorizer(max_features=max_tfidf_features, ngram_range=(1, 2), stop_words='english')
        self.is_fitted = False
        self.feature_names = []

    def fit(self, df):
        # Verify no forbidden leakage columns enter feature processing
        for col in FORBIDDEN_LEAKAGE_COLS:
            if col in df.columns and col in NUMERICAL_COLS + CATEGORICAL_COLS:
                raise ValueError(f"CRITICAL LEAKAGE DETECTED: Forbidden outcome feature '{col}' found in feature pipeline!")

        num_data = df[NUMERICAL_COLS].fillna(0).values
        num_scaled = self.scaler.fit_transform(num_data)

        cat_data = df[CATEGORICAL_COLS].astype(str).values
        cat_encoded = self.encoder.fit_transform(cat_data)

        texts = df['description'].fillna('').astype(str).tolist()
        tfidf_mat = self.tfidf.fit_transform(texts).toarray()

        self.is_fitted = True
        
        # Build feature names
        cat_feature_names = list(self.encoder.get_feature_names_out(CATEGORICAL_COLS))
        tfidf_feature_names = [f"tfidf_{w}" for w in self.tfidf.get_feature_names_out()]
        self.feature_names = NUMERICAL_COLS + cat_feature_names + tfidf_feature_names
        
        return np.hstack([num_scaled, cat_encoded, tfidf_mat])

    def transform(self, df):
        if not self.is_fitted:
            raise RuntimeError("Preprocessor must be fitted before transform.")

        num_data = df[NUMERICAL_COLS].fillna(0).values
        num_scaled = self.scaler.transform(num_data)

        cat_data = df[CATEGORICAL_COLS].astype(str).values
        cat_encoded = self.encoder.transform(cat_data)

        texts = df['description'].fillna('').astype(str).tolist()
        tfidf_mat = self.tfidf.transform(texts).toarray()

        return np.hstack([num_scaled, cat_encoded, tfidf_mat])

class SLAPredictor:
    def __init__(self, artifact_dir=None):
        self.model = None
        self.preprocessor = None
        self.calibrator = None
        self.threshold_low_medium = 0.35
        self.threshold_medium_high = 0.65
        self.model_meta = {}
        self.artifact_dir = artifact_dir

    def fit(self, train_df, val_df=None):
        self.preprocessor = FeaturePreprocessor(max_tfidf_features=50)
        X_train = self.preprocessor.fit(train_df)
        y_train = train_df['sla_breached'].values

        # Base Random Forest Classifier
        self.model = RandomForestClassifier(
            n_estimators=200,
            max_depth=12,
            min_samples_split=5,
            min_samples_leaf=2,
            class_weight='balanced',
            random_state=42,
            n_jobs=-1
        )
        self.model.fit(X_train, y_train)

        # Fit probability calibrator on validation data if provided
        if val_df is not None:
            X_val = self.preprocessor.transform(val_df)
            y_val = val_df['sla_breached'].values
            val_raw_probs = self.model.predict_proba(X_val)[:, 1]
            
            # Use Platt Scaling (Logistic Regression on raw probabilities)
            self.calibrator = LogisticRegression(C=1.0)
            self.calibrator.fit(val_raw_probs.reshape(-1, 1), y_val)

    def predict_proba(self, df):
        X = self.preprocessor.transform(df)
        raw_probs = self.model.predict_proba(X)[:, 1]
        
        if self.calibrator is not None:
            calibrated_probs = self.calibrator.predict_proba(raw_probs.reshape(-1, 1))[:, 1]
            return calibrated_probs
        return raw_probs

    def map_risk_level(self, prob):
        if prob < self.threshold_low_medium:
            return 'LOW'
        elif prob < self.threshold_medium_high:
            return 'MEDIUM'
        else:
            return 'HIGH'

    def predict_single(self, input_dict):
        # Format single raw dictionary into DataFrame row with defaults
        text = str(input_dict.get('description', '') or input_dict.get('title', ''))
        cat = str(input_dict.get('category_id', 'other') or 'other').lower()
        dept = str(input_dict.get('department_id', 'DEPT_GENERAL') or 'DEPT_GENERAL')
        pred_sev = str(input_dict.get('predicted_severity', 'MEDIUM') or 'MEDIUM').upper()
        
        word_count = len(text.split())
        urgency_kw_count = sum(1 for w in text.lower().split() if any(k in w for k in URGENCY_KEYWORDS))

        probs_dict = input_dict.get('severity_probabilities', {}) or {}
        
        row = {
            'description': text,
            'category_id': cat,
            'department_id': dept,
            'predicted_severity': pred_sev,
            'created_hour': int(input_dict.get('created_hour', 10)),
            'created_day_of_week': int(input_dict.get('created_day_of_week', 2)),
            'created_month': int(input_dict.get('created_month', 5)),
            'is_weekend': int(input_dict.get('is_weekend', 0)),
            'is_working_hours': int(input_dict.get('is_working_hours', 1)),
            'response_sla_hours': float(input_dict.get('response_sla_hours', 12.0)),
            'prob_low': float(probs_dict.get('prob_low', 0.1)),
            'prob_medium': float(probs_dict.get('prob_medium', 0.6)),
            'prob_high': float(probs_dict.get('prob_high', 0.2)),
            'prob_critical': float(probs_dict.get('prob_critical', 0.1)),
            'master_issue_count_at_submission': int(input_dict.get('master_issue_count_at_submission', 1)),
            'support_count_at_submission': int(input_dict.get('support_count_at_submission', 1)),
            'hotspot_score_at_submission': float(input_dict.get('hotspot_score_at_submission', 0.0)),
            'density_score_at_submission': float(input_dict.get('density_score_at_submission', 0.0)),
            'is_hotspot_area': int(input_dict.get('is_hotspot_area', 0)),
            'latitude': float(input_dict.get('latitude', 13.0827)),
            'longitude': float(input_dict.get('longitude', 80.2707)),
            'word_count': word_count,
            'urgency_kw_count': urgency_kw_count
        }

        df_single = pd.DataFrame([row])
        prob = float(self.predict_proba(df_single)[0])
        risk = self.map_risk_level(prob)
        predicted_breach = bool(prob >= 0.50)

        # Get top contributing feature names
        X_single = self.preprocessor.transform(df_single)[0]
        importances = self.model.feature_importances_
        feature_names = self.preprocessor.feature_names
        
        top_indices = np.argsort(importances * np.abs(X_single))[::-1][:4]
        top_factors = [feature_names[i] for i in top_indices if i < len(feature_names)]

        return {
            'breach_probability': round(prob, 4),
            'predicted_breach': predicted_breach,
            'risk_level': risk,
            'threshold_low_medium': self.threshold_low_medium,
            'threshold_medium_high': self.threshold_medium_high,
            'model_version': '5.0.0-rf-calibrated',
            'top_factors': top_factors
        }

    def save_artifacts(self, artifact_dir):
        os.makedirs(artifact_dir, exist_ok=True)
        joblib.dump(self.model, os.path.join(artifact_dir, "random_forest.joblib"))
        joblib.dump(self.preprocessor, os.path.join(artifact_dir, "feature_preprocessor.joblib"))
        if self.calibrator is not None:
            joblib.dump(self.calibrator, os.path.join(artifact_dir, "calibrator.joblib"))
        
        with open(os.path.join(artifact_dir, "model_meta.json"), "w") as f:
            json.dump(self.model_meta, f, indent=2)
        print(f"[SUCCESS] Artifacts saved to {artifact_dir}")

    def load_artifacts(self, artifact_dir):
        self.model = joblib.load(os.path.join(artifact_dir, "random_forest.joblib"))
        self.preprocessor = joblib.load(os.path.join(artifact_dir, "feature_preprocessor.joblib"))
        calib_path = os.path.join(artifact_dir, "calibrator.joblib")
        if os.path.exists(calib_path):
            self.calibrator = joblib.load(calib_path)
        meta_path = os.path.join(artifact_dir, "model_meta.json")
        if os.path.exists(meta_path):
            with open(meta_path, "r") as f:
                self.model_meta = json.load(f)
        print(f"[SUCCESS] Component 5 SLA predictor loaded from {artifact_dir}")
