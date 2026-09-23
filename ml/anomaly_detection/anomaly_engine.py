"""
anomaly_engine.py
Core Machine Learning Engine for Component 6 — AI Anomaly & Suspicious Pattern Detection.
Implements IsolationForest for unsupervised operational window scoring,
calibrated anomaly score [0.0, 1.0], risk levels (LOW, MEDIUM, HIGH),
post-processing pattern categorization, and explainable contributing indicators.
"""

import os
import json
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler, OneHotEncoder

NUMERICAL_COLS = [
    'raw_report_count', 'master_issue_count', 'duplicate_ratio',
    'reports_per_master_issue', 'hotspot_score', 'local_density', 'cluster_size',
    'critical_count', 'high_count', 'critical_ratio',
    'high_sla_risk_count', 'high_sla_risk_ratio',
    'complaints_last_24h', 'complaints_last_7d', 'rate_of_change',
    'hour', 'day_of_week', 'is_weekend'
]

CATEGORICAL_COLS = ['department_code', 'time_slot']

class AnomalyPreprocessor:
    def __init__(self):
        self.scaler = StandardScaler()
        self.encoder = OneHotEncoder(handle_unknown='ignore', sparse_output=False)
        self.is_fitted = False
        self.feature_names = []

    def fit(self, df):
        num_data = df[NUMERICAL_COLS].fillna(0).values
        num_scaled = self.scaler.fit_transform(num_data)

        cat_data = df[CATEGORICAL_COLS].astype(str).values
        cat_encoded = self.encoder.fit_transform(cat_data)

        self.is_fitted = True
        cat_feature_names = list(self.encoder.get_feature_names_out(CATEGORICAL_COLS))
        self.feature_names = NUMERICAL_COLS + cat_feature_names
        return np.hstack([num_scaled, cat_encoded])

    def transform(self, df):
        if not self.is_fitted:
            raise RuntimeError("AnomalyPreprocessor must be fitted before transform.")

        num_data = df[NUMERICAL_COLS].fillna(0).values
        num_scaled = self.scaler.transform(num_data)

        cat_data = df[CATEGORICAL_COLS].astype(str).values
        cat_encoded = self.encoder.transform(cat_data)

        return np.hstack([num_scaled, cat_encoded])

class IsolationForestPredictor:
    def __init__(self, artifact_dir=None):
        self.model = None
        self.preprocessor = None
        self.threshold_low_medium = 0.50
        self.threshold_medium_high = 0.75
        self.baseline_stats = {}
        self.model_meta = {}
        self.artifact_dir = artifact_dir

    def fit(self, train_df):
        self.preprocessor = AnomalyPreprocessor()
        X_train = self.preprocessor.fit(train_df)

        # Compute baseline historical means for explainability
        for col in NUMERICAL_COLS:
            self.baseline_stats[col] = float(round(train_df[col].mean(), 4))

        self.model = IsolationForest(
            n_estimators=200,
            contamination=0.05,
            max_samples='auto',
            random_state=42,
            n_jobs=-1
        )
        self.model.fit(X_train)

    def decision_function(self, df):
        X = self.preprocessor.transform(df)
        return self.model.decision_function(X)

    def predict_anomaly_score(self, df):
        # Isolation Forest decision_function outputs negative values for anomalies
        # We invert and map to [0.0, 1.0] using a logistic sigmoid transform
        dec_scores = self.decision_function(df)
        # Shift & scale so normal points ~ 0.2 - 0.4 and anomalies ~ 0.75 - 0.98
        sigmoid_scores = 1.0 / (1.0 + np.exp(dec_scores * 8.0))
        return np.round(sigmoid_scores, 4)

    def map_anomaly_level(self, score):
        if score < self.threshold_low_medium:
            return 'LOW'
        elif score < self.threshold_medium_high:
            return 'MEDIUM'
        else:
            return 'HIGH'

    def classify_anomaly_pattern(self, row_dict):
        # Post-processing pattern categorization based on domain logic
        raw_vol = float(row_dict.get('raw_report_count', 0))
        dup_ratio = float(row_dict.get('duplicate_ratio', 0))
        hotspot = float(row_dict.get('hotspot_score', 0))
        crit_ratio = float(row_dict.get('critical_ratio', 0))
        sla_risk_ratio = float(row_dict.get('high_sla_risk_ratio', 0))
        roc = float(row_dict.get('rate_of_change', 0))

        base_vol = self.baseline_stats.get('raw_report_count', 10.0)

        triggers = []
        if roc >= 2.0 or raw_vol >= (base_vol * 3.0):
            triggers.append('VOLUME_SPIKE')
        if dup_ratio >= 0.80 and raw_vol >= 15:
            triggers.append('DUPLICATE_CONCENTRATION')
        if hotspot >= 80.0:
            triggers.append('GEOGRAPHIC_SPIKE')
        if crit_ratio >= 0.60:
            triggers.append('SEVERITY_SPIKE')
        if sla_risk_ratio >= 0.70:
            triggers.append('SLA_RISK_SPIKE')

        if len(triggers) == 0:
            return 'NORMAL_PATTERN'
        elif len(triggers) == 1:
            return triggers[0]
        else:
            return 'MULTIVARIATE_ANOMALY'

    def generate_contributing_indicators(self, row_dict):
        indicators = []
        raw_vol = float(row_dict.get('raw_report_count', 0))
        base_vol = self.baseline_stats.get('raw_report_count', 10.0)

        if base_vol > 0 and raw_vol >= (base_vol * 2.0):
            ratio = round(raw_vol / base_vol, 1)
            indicators.append(f"Complaint volume is {ratio}x historical normal (observed {int(raw_vol)} vs baseline {base_vol:.1f})")

        dup_ratio = float(row_dict.get('duplicate_ratio', 0))
        if dup_ratio >= 0.70:
            indicators.append(f"High duplicate ratio ({int(dup_ratio*100)}% of reports linked to same master issue)")

        hotspot = float(row_dict.get('hotspot_score', 0))
        if hotspot >= 75.0:
            indicators.append(f"Elevated spatial density (Component 3 hotspot score {hotspot:.1f}/100)")

        crit_ratio = float(row_dict.get('critical_ratio', 0))
        if crit_ratio >= 0.50:
            indicators.append(f"High critical severity concentration ({int(crit_ratio*100)}% of intake marked critical)")

        sla_risk = float(row_dict.get('high_sla_risk_ratio', 0))
        if sla_risk >= 0.60:
            indicators.append(f"Elevated SLA breach probability ({int(sla_risk*100)}% high-risk SLA complaints)")

        if len(indicators) == 0:
            indicators.append("Minor multivariate deviation across combined temporal & spatial features")

        return indicators

    def predict_single(self, input_dict):
        row = {
            'department_code': str(input_dict.get('department_code', 'DEPT_ROADS')),
            'time_slot': str(input_dict.get('time_slot', 'MORNING_06_12')),
            'raw_report_count': float(input_dict.get('raw_report_count', 10)),
            'master_issue_count': float(input_dict.get('master_issue_count', 5)),
            'duplicate_ratio': float(input_dict.get('duplicate_ratio', 0.5)),
            'reports_per_master_issue': float(input_dict.get('reports_per_master_issue', 2.0)),
            'hotspot_score': float(input_dict.get('hotspot_score', 25.0)),
            'local_density': float(input_dict.get('local_density', 0.25)),
            'cluster_size': int(input_dict.get('cluster_size', 5)),
            'critical_count': int(input_dict.get('critical_count', 1)),
            'high_count': int(input_dict.get('high_count', 2)),
            'critical_ratio': float(input_dict.get('critical_ratio', 0.1)),
            'high_sla_risk_count': int(input_dict.get('high_sla_risk_count', 2)),
            'high_sla_risk_ratio': float(input_dict.get('high_sla_risk_ratio', 0.2)),
            'complaints_last_24h': float(input_dict.get('complaints_last_24h', 30.0)),
            'complaints_last_7d': float(input_dict.get('complaints_last_7d', 200.0)),
            'rate_of_change': float(input_dict.get('rate_of_change', 0.0)),
            'hour': int(input_dict.get('hour', 10)),
            'day_of_week': int(input_dict.get('day_of_week', 2)),
            'is_weekend': int(input_dict.get('is_weekend', 0)),
            'latitude': float(input_dict.get('latitude', 13.0827)),
            'longitude': float(input_dict.get('longitude', 80.2707))
        }

        df_single = pd.DataFrame([row])
        score = float(self.predict_anomaly_score(df_single)[0])
        level = self.map_anomaly_level(score)
        pattern = self.classify_anomaly_pattern(row)
        indicators = self.generate_contributing_indicators(row)

        return {
            'is_anomaly': bool(score >= self.threshold_low_medium),
            'anomaly_score': score,
            'anomaly_level': level,
            'anomaly_type': pattern,
            'contributing_indicators': indicators,
            'threshold_low_medium': self.threshold_low_medium,
            'threshold_medium_high': self.threshold_medium_high,
            'model_version': '6.0.0-iforest',
            'timestamp': str(input_dict.get('date', pd.Timestamp.now().isoformat()))
        }

    def save_artifacts(self, artifact_dir):
        os.makedirs(artifact_dir, exist_ok=True)
        joblib.dump(self.model, os.path.join(artifact_dir, "isolation_forest.joblib"))
        joblib.dump(self.preprocessor, os.path.join(artifact_dir, "feature_preprocessor.joblib"))
        
        with open(os.path.join(artifact_dir, "baseline_stats.json"), "w") as f:
            json.dump(self.baseline_stats, f, indent=2)

        with open(os.path.join(artifact_dir, "model_meta.json"), "w") as f:
            json.dump(self.model_meta, f, indent=2)
        print(f"[SUCCESS] Artifacts saved to {artifact_dir}")

    def load_artifacts(self, artifact_dir):
        self.model = joblib.load(os.path.join(artifact_dir, "isolation_forest.joblib"))
        self.preprocessor = joblib.load(os.path.join(artifact_dir, "feature_preprocessor.joblib"))
        
        b_path = os.path.join(artifact_dir, "baseline_stats.json")
        if os.path.exists(b_path):
            with open(b_path, "r") as f:
                self.baseline_stats = json.load(f)

        meta_path = os.path.join(artifact_dir, "model_meta.json")
        if os.path.exists(meta_path):
            with open(meta_path, "r") as f:
                self.model_meta = json.load(f)
        print(f"[SUCCESS] Component 6 Isolation Forest loaded from {artifact_dir}")
