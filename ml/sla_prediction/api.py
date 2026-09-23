"""
api.py
Flask blueprint for Component 5 — AI SLA Breach Prediction API endpoint.
Serves POST /predict-sla-breach.
"""

import os
from flask import Blueprint, request, jsonify
from .sla_engine import SLAPredictor

sla_bp = Blueprint('sla_prediction', __name__)

ARTIFACT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "artifacts"))
predictor = None

def get_predictor():
    global predictor
    if predictor is None:
        predictor = SLAPredictor()
        predictor.load_artifacts(ARTIFACT_DIR)
    return predictor

@sla_bp.route('/predict-sla-breach', methods=['POST'])
def predict_sla_breach():
    try:
        data = request.get_json(force=True) or {}
        
        # Load model and make prediction
        pred_engine = get_predictor()
        result = pred_engine.predict_single(data)
        
        return jsonify({
            'status': 'success',
            'breach_probability': result['breach_probability'],
            'predicted_breach': result['predicted_breach'],
            'risk_level': result['risk_level'],
            'threshold_low_medium': result['threshold_low_medium'],
            'threshold_medium_high': result['threshold_medium_high'],
            'model_version': result['model_version'],
            'top_factors': result['top_factors']
        }), 200

    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500
