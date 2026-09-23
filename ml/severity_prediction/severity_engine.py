"""
@file severity_engine.py
@description Core Machine Learning Engine for CivicPulse Component 4 (Severity / Priority Prediction).
Implements feature engineering, TF-IDF + structured feature preprocessing, Random Forest classification,
baseline models, dynamic reprioritization, and artifact persistence.
"""

import os
import json
import joblib
import numpy as np
import pandas as pd
from datetime import datetime

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.dummy import DummyClassifier

# Severity label constants matching schema
SEVERITY_CLASSES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']

# High-risk linguistic terms associated with municipal emergencies
URGENCY_KEYWORDS = [
    'danger', 'hazard', 'immediate', 'sewage', 'collapse', 'cholera', 'accident',
    'accidents', 'sparking', 'life', 'emergency', 'broken', 'severe', 'overflowing',
    'foul', 'panic', 'pothole', 'burst', 'high-voltage', 'flood', 'contamination',
    'injury', 'fatal', 'electric', 'toxic', 'poisonous', 'die', 'leak', 'open'
]

def extract_engineered_features(df):
    """
    Extracts structured, linguistic, spatial, temporal, and operational features
    from complaint records without post-event data leakage.
    """
    df = df.copy()

    # 1. Linguistic & Text Metrics
    if 'description' not in df.columns:
        df['description'] = ''
    else:
        df['description'] = df['description'].fillna('')

    if 'title' not in df.columns:
        df['title'] = ''
    else:
        df['title'] = df['title'].fillna('')

    df['desc_char_len'] = df['description'].str.len()
    df['desc_word_count'] = df['description'].apply(lambda s: len(s.split()))
    df['title_char_len'] = df['title'].str.len()
    df['title_word_count'] = df['title'].apply(lambda s: len(s.split()))

    def count_urgency_keywords(text):
        text_lower = str(text).lower()
        return sum(1 for kw in URGENCY_KEYWORDS if kw in text_lower)

    df['urgency_kw_count'] = (df['title'] + ' ' + df['description']).apply(count_urgency_keywords)

    # 2. Categorical Standardizations
    if 'category_id' not in df.columns:
        df['category_id'] = 'other'
    else:
        df['category_id'] = df['category_id'].fillna('other')

    if 'department_code' not in df.columns:
        df['department_code'] = 'DEPT_GENERAL'
    else:
        df['department_code'] = df['department_code'].fillna('DEPT_GENERAL')

    if 'district' not in df.columns:
        df['district'] = 'Chennai Central'
    else:
        df['district'] = df['district'].fillna('Chennai Central')

    # 3. Component 2 & Component 3 Operational Features (Safe at prediction time)
    if 'support_count' in df.columns:
        df['support_count'] = df['support_count'].fillna(0).astype(float)
    else:
        df['support_count'] = 0.0

    if 'master_issue_count' in df.columns:
        df['master_issue_count'] = df['master_issue_count'].fillna(1).astype(float)
    else:
        df['master_issue_count'] = 1.0

    if 'hotspot_priority' in df.columns:
        df['hotspot_priority'] = df['hotspot_priority'].fillna(0.0).astype(float)
    else:
        df['hotspot_priority'] = 0.0

    # 4. Combined Text field for TF-IDF
    df['full_text'] = df['title'] + ' ' + df['description']

    return df


class SeverityFeaturePipeline:
    """
    Handles feature preprocessing: text TF-IDF + categorical encoding + numerical scaling.
    """
    def __init__(self, max_tfidf_features=200):
        self.max_tfidf_features = max_tfidf_features
        self.tfidf_vectorizer = TfidfVectorizer(
            max_features=max_tfidf_features,
            ngram_range=(1, 2),
            stop_words='english'
        )

        self.num_cols = [
            'desc_char_len', 'desc_word_count', 'title_char_len',
            'title_word_count', 'urgency_kw_count', 'support_count',
            'master_issue_count', 'hotspot_priority'
        ]
        self.cat_cols = ['category_id', 'department_code', 'district']

        self.scaler = StandardScaler()
        self.ohe = OneHotEncoder(handle_unknown='ignore', sparse_output=False)
        self.is_fitted = False

    def fit(self, df):
        df_feat = extract_engineered_features(df)

        # Fit TF-IDF on full text
        self.tfidf_vectorizer.fit(df_feat['full_text'])

        # Fit Scaler on Numerical Features
        self.scaler.fit(df_feat[self.num_cols])

        # Fit OneHotEncoder on Categorical Features
        self.ohe.fit(df_feat[self.cat_cols])

        self.is_fitted = True
        return self

    def transform(self, df, feature_subset='FULL'):
        if not self.is_fitted:
            raise RuntimeError("SeverityFeaturePipeline must be fitted before calling transform().")

        df_feat = extract_engineered_features(df)

        # Text TF-IDF matrix
        tfidf_mat = self.tfidf_vectorizer.transform(df_feat['full_text']).toarray()

        # Numerical matrix
        num_mat = self.scaler.transform(df_feat[self.num_cols])

        # Categorical matrix
        cat_mat = self.ohe.transform(df_feat[self.cat_cols])

        if feature_subset == 'TEXT_ONLY':
            return tfidf_mat
        elif feature_subset == 'STRUCTURED_ONLY':
            return np.hstack([num_mat, cat_mat])
        elif feature_subset == 'SPATIAL_TEMPORAL_ONLY':
            # Subset containing location/district and density/hotspot features
            dist_idx = [i for i, c in enumerate(self.ohe.get_feature_names_out(self.cat_cols)) if c.startswith('district')]
            cat_dist = cat_mat[:, dist_idx] if len(dist_idx) > 0 else np.zeros((len(df), 1))
            num_spat = num_mat[:, [5, 6, 7]] # support, master, hotspot
            return np.hstack([num_spat, cat_dist])
        elif feature_subset == 'NO_COMPONENTS':
            # Exclude support_count, master_issue_count, hotspot_priority
            num_base = num_mat[:, :5]
            return np.hstack([tfidf_mat, num_base, cat_mat])
        else: # FULL
            return np.hstack([tfidf_mat, num_mat, cat_mat])

    def fit_transform(self, df, feature_subset='FULL'):
        return self.fit(df).transform(df, feature_subset=feature_subset)

    def get_feature_names(self):
        tfidf_names = [f"tfidf_{w}" for w in self.tfidf_vectorizer.get_feature_names_out()]
        num_names = self.num_cols
        cat_names = list(self.ohe.get_feature_names_out(self.cat_cols))
        return tfidf_names + num_names + cat_names


class SeverityPredictor:
    """
    Main Machine Learning Predictor for Component 4.
    Encapsulates Random Forest model, feature pipeline, hyperparameter configuration,
    and prediction methods.
    """
    def __init__(
        self,
        n_estimators=200,
        max_depth=12,
        min_samples_split=5,
        min_samples_leaf=2,
        class_weight='balanced',
        random_state=42,
        n_jobs=-1
    ):
        self.random_state = random_state
        self.model_params = {
            'n_estimators': n_estimators,
            'max_depth': max_depth,
            'min_samples_split': min_samples_split,
            'min_samples_leaf': min_samples_leaf,
            'class_weight': class_weight,
            'random_state': random_state,
            'n_jobs': n_jobs
        }
        self.feature_pipeline = SeverityFeaturePipeline()
        self.model = RandomForestClassifier(**self.model_params)
        self.classes_ = np.array(SEVERITY_CLASSES)

    def fit(self, train_df, feature_subset='FULL'):
        X_train = self.feature_pipeline.fit_transform(train_df, feature_subset=feature_subset)
        y_train = train_df['urgency_level'].values
        self.model.fit(X_train, y_train)
        return self

    def predict(self, df_or_dict, feature_subset='FULL'):
        if isinstance(df_or_dict, dict):
            df = pd.DataFrame([df_or_dict])
        elif isinstance(df_or_dict, list):
            df = pd.DataFrame(df_or_dict)
        else:
            df = df_or_dict.copy()

        X = self.feature_pipeline.transform(df, feature_subset=feature_subset)
        preds = self.model.predict(X)
        probs = self.model.predict_proba(X)

        results = []
        for i in range(len(df)):
            pred_class = preds[i]
            prob_dict = {cls: float(p) for cls, p in zip(self.model.classes_, probs[i])}
            confidence = float(np.max(probs[i]))

            # Civic response recommendation mapping
            rec_map = {
                'LOW': 'Standard Scheduled Maintenance (Routine Queue)',
                'MEDIUM': 'Priority Inspection within 48 Hours',
                'HIGH': 'Urgent Field Deployment within 24 Hours',
                'CRITICAL': 'IMMEDIATE EMERGENCY RESPONSE & ESCALATION'
            }

            results.append({
                'predicted_severity': pred_class,
                'confidence': confidence,
                'class_probabilities': prob_dict,
                'recommended_action': rec_map.get(pred_class, 'Standard Review'),
                'model_version': '1.0.0-rf-component4',
                'prediction_timestamp': datetime.now().isoformat()
            })

        if isinstance(df_or_dict, dict):
            return results[0]
        return results

    def get_feature_importances(self):
        if not hasattr(self.model, 'feature_importances_'):
            return None
        importances = self.model.feature_importances_
        feature_names = self.feature_pipeline.get_feature_names()
        fi_df = pd.DataFrame({
            'feature': feature_names,
            'importance': importances
        }).sort_values(by='importance', ascending=False).reset_index(drop=True)
        return fi_df

    def save_artifacts(self, artifact_dir="ml/severity_prediction/artifacts"):
        os.makedirs(artifact_dir, exist_ok=True)
        model_path = os.path.join(artifact_dir, "random_forest.joblib")
        pipeline_path = os.path.join(artifact_dir, "feature_preprocessor.joblib")
        meta_path = os.path.join(artifact_dir, "model_meta.json")

        joblib.dump(self.model, model_path)
        joblib.dump(self.feature_pipeline, pipeline_path)

        meta = {
            "model_type": "RandomForestClassifier",
            "model_version": "1.0.0-rf-component4",
            "classes": SEVERITY_CLASSES,
            "hyperparameters": self.model_params,
            "training_timestamp": datetime.now().isoformat(),
            "random_state": self.random_state
        }
        with open(meta_path, "w") as f:
            json.dump(meta, f, indent=2)

        print(f"[SUCCESS] Saved Component 4 severity artifacts to {artifact_dir}")

    def load_artifacts(self, artifact_dir="ml/severity_prediction/artifacts"):
        model_path = os.path.join(artifact_dir, "random_forest.joblib")
        pipeline_path = os.path.join(artifact_dir, "feature_preprocessor.joblib")

        if not (os.path.exists(model_path) and os.path.exists(pipeline_path)):
            raise FileNotFoundError(f"Model artifacts missing in {artifact_dir}")

        self.model = joblib.load(model_path)
        self.feature_pipeline = joblib.load(pipeline_path)
        print(f"[SUCCESS] Loaded Component 4 severity model from {artifact_dir}")
        return self
