"""
api.py
Flask blueprint for Component 6 — AI Anomaly & Suspicious Pattern Detection API endpoint.
Serves POST /predict-anomaly and POST /analyze-anomalies.
"""

import os
import pandas as pd
from flask import Blueprint, request, jsonify
from .anomaly_engine import IsolationForestPredictor

anomaly_bp = Blueprint('anomaly_detection', __name__)

ARTIFACT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "artifacts"))
predictor = None

def get_predictor():
    global predictor
    if predictor is None:
        predictor = IsolationForestPredictor()
        predictor.load_artifacts(ARTIFACT_DIR)
    return predictor

@anomaly_bp.route('/predict-anomaly', methods=['POST'])
def predict_anomaly():
    try:
        data = request.get_json(force=True) or {}
        
        pred_engine = get_predictor()
        result = pred_engine.predict_single(data)
        
        return jsonify({
            'status': 'success',
            'is_anomaly': result['is_anomaly'],
            'anomaly_score': result['anomaly_score'],
            'anomaly_level': result['anomaly_level'],
            'anomaly_type': result['anomaly_type'],
            'contributing_indicators': result['contributing_indicators'],
            'threshold_low_medium': result['threshold_low_medium'],
            'threshold_medium_high': result['threshold_medium_high'],
            'model_version': result['model_version'],
            'timestamp': result['timestamp']
        }), 200

    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@anomaly_bp.route('/analyze-anomalies', methods=['POST'])
def analyze_anomalies():
    try:
        data = request.get_json(force=True) or {}
        windows = data.get('windows', [])
        
        if not windows:
            return jsonify({'status': 'success', 'results': [], 'total_analyzed': 0, 'anomalies_detected': 0}), 200

        pred_engine = get_predictor()
        df_windows = pd.DataFrame(windows)
        scores = pred_engine.predict_anomaly_score(df_windows)
        
        results = []
        for i, row in df_windows.iterrows():
            row_dict = row.to_dict()
            score = float(scores[i])
            level = pred_engine.map_anomaly_level(score)
            pattern = pred_engine.classify_anomaly_pattern(row_dict)
            indicators = pred_engine.generate_contributing_indicators(row_dict)
            
            results.append({
                'window_id': str(row_dict.get('window_id', f"WIN-{i+1}")),
                'date': str(row_dict.get('date', '')),
                'department_code': str(row_dict.get('department_code', 'DEPT_GENERAL')),
                'raw_report_count': int(row_dict.get('raw_report_count', 0)),
                'master_issue_count': int(row_dict.get('master_issue_count', 0)),
                'duplicate_ratio': float(row_dict.get('duplicate_ratio', 0.0)),
                'hotspot_score': float(row_dict.get('hotspot_score', 0.0)),
                'is_anomaly': bool(score >= pred_engine.threshold_low_medium),
                'anomaly_score': score,
                'anomaly_level': level,
                'anomaly_type': pattern,
                'contributing_indicators': indicators
            })
            
        results.sort(key=lambda x: x['anomaly_score'], reverse=True)
        anomalies_count = sum(1 for r in results if r['is_anomaly'])

        return jsonify({
            'status': 'success',
            'results': results,
            'total_analyzed': len(results),
            'anomalies_detected': anomalies_count,
            'model_version': '6.0.0-iforest'
        }), 200

    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500
