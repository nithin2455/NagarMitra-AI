"""
CivicPulse Unified AI API Server
Serves all CivicPulse AI Components:
- Component 1: POST /predict (Complaint Classification)
- Component 2: POST /predict-duplicate, POST /evaluate-pair (Multimodal Duplicate Detection & Consolidation)
- Component 3: POST /predict-hotspots (Geospatial DBSCAN Location Hotspot Detection)
- GET /health
"""

import os
import sys
import json
from http.server import HTTPServer, BaseHTTPRequestHandler

# Import Component 1 Classifier
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'complaint_classifier'))
from predict import ComplaintClassifier

# Import Component 2 Duplicate Engine
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'duplicate_detection'))
from duplicate_engine import MultimodalDuplicateEngine

# Import Component 3 Hotspot Engine
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'location_hotspot'))
from hotspot_engine import LocationHotspotEngine

# Import Component 4 Severity Predictor
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'severity_prediction'))
from severity_engine import SeverityPredictor

# Import Component 5 SLA Predictor
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'sla_prediction'))
from sla_engine import SLAPredictor

# Import Component 6 Anomaly Predictor
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'anomaly_detection'))
from anomaly_engine import IsolationForestPredictor

classifier = None
duplicate_engine = None
hotspot_engine = None
severity_predictor = None
sla_predictor = None
anomaly_predictor = None

class UnifiedAIHandler(BaseHTTPRequestHandler):
    def _set_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    def do_OPTIONS(self):
        self.send_response(200)
        self._set_cors_headers()
        self.end_headers()

    def do_GET(self):
        if self.path in ["/health", "/", "/api/health"]:
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._set_cors_headers()
            self.end_headers()
            response = {
                "status": "healthy",
                "service": "CivicPulse Unified AI API Server",
                "version": "6.0.0",
                "activeComponents": {
                    "component1_classification": True,
                    "component2_duplicate_detection": True,
                    "component3_location_hotspots": True,
                    "component4_severity_prediction": True,
                    "component5_sla_prediction": True,
                    "component6_anomaly_detection": True
                }
            }
            self.wfile.write(json.dumps(response).encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)
        
        try:
            data = json.loads(body.decode("utf-8")) if body else {}
        except Exception as e:
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self._set_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({"error": f"Invalid JSON payload: {str(e)}"}).encode("utf-8"))
            return

        # Component 1: Complaint Classification
        if self.path in ["/predict", "/api/predict"]:
            description = data.get("description", "")
            title = data.get("title", "")
            try:
                result = classifier.predict(description=description, title=title)
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self._set_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps(result).encode("utf-8"))
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self._set_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"error": f"Internal classification error: {str(e)}"}).encode("utf-8"))

        # Component 2: Multimodal Duplicate Detection
        elif self.path in ["/predict-duplicate", "/api/predict-duplicate", "/api/duplicate-check"]:
            new_complaint = data.get("newComplaint", {})
            candidate_masters = data.get("candidateMasters", [])
            try:
                match = duplicate_engine.find_best_master_match(new_complaint, candidate_masters)
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self._set_cors_headers()
                self.end_headers()
                payload = {
                    "isAvailable": True,
                    "match": match,
                    "hasMatch": match is not None
                }
                self.wfile.write(json.dumps(payload).encode("utf-8"))
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self._set_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"error": f"Internal deduplication error: {str(e)}"}).encode("utf-8"))

        # Component 2: Evaluate Pair
        elif self.path in ["/evaluate-pair", "/api/evaluate-pair"]:
            c1 = data.get("complaint1", {})
            c2 = data.get("complaint2", {})
            try:
                eval_res = duplicate_engine.evaluate_pair(c1, c2)
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self._set_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps(eval_res).encode("utf-8"))
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self._set_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))

        # Component 3: Geospatial DBSCAN Hotspot Detection
        elif self.path in ["/predict-hotspots", "/api/predict-hotspots", "/api/hotspots"]:
            complaints = data.get("complaints", [])
            mode = data.get("mode", "OVERALL")
            department = data.get("department", None)
            time_window = data.get("timeWindow", "ALL_TIME")
            eps_meters = data.get("epsMeters", None)
            min_samples = data.get("minSamples", None)

            try:
                result = hotspot_engine.detect_hotspots(
                    complaints,
                    mode=mode,
                    department=department,
                    time_window=time_window,
                    eps_meters=eps_meters,
                    min_samples=min_samples
                )
                result["isAvailable"] = True
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self._set_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps(result).encode("utf-8"))
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self._set_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"error": f"Internal hotspot detection error: {str(e)}"}).encode("utf-8"))
        # Component 4: AI Severity / Priority Prediction
        elif self.path in ["/predict-severity", "/api/predict-severity", "/api/severity"]:
            try:
                result = severity_predictor.predict(data)
                result["isAvailable"] = True
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self._set_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps(result).encode("utf-8"))
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self._set_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"error": f"Internal severity prediction error: {str(e)}"}).encode("utf-8"))
        # Component 5: AI SLA Breach Prediction
        elif self.path in ["/predict-sla-breach", "/api/predict-sla-breach", "/api/sla"]:
            try:
                result = sla_predictor.predict_single(data)
                result["isAvailable"] = True
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self._set_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps(result).encode("utf-8"))
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self._set_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"error": f"Internal SLA breach prediction error: {str(e)}"}).encode("utf-8"))
        # Component 6: AI Anomaly & Suspicious Pattern Detection
        elif self.path in ["/predict-anomaly", "/api/predict-anomaly", "/api/anomaly"]:
            try:
                result = anomaly_predictor.predict_single(data)
                result["isAvailable"] = True
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self._set_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps(result).encode("utf-8"))
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self._set_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"error": f"Internal anomaly prediction error: {str(e)}"}).encode("utf-8"))
        elif self.path in ["/analyze-anomalies", "/api/analyze-anomalies"]:
            try:
                windows = data.get("windows", [])
                if not windows:
                    result = {"status": "success", "results": [], "total_analyzed": 0, "anomalies_detected": 0}
                else:
                    import pandas as pd
                    df_win = pd.DataFrame(windows)
                    scores = anomaly_predictor.predict_anomaly_score(df_win)
                    res_list = []
                    for i, row in df_win.iterrows():
                        row_dict = row.to_dict()
                        score = float(scores[i])
                        level = anomaly_predictor.map_anomaly_level(score)
                        pattern = anomaly_predictor.classify_anomaly_pattern(row_dict)
                        indicators = anomaly_predictor.generate_contributing_indicators(row_dict)
                        res_list.append({
                            "window_id": str(row_dict.get("window_id", f"WIN-{i+1}")),
                            "date": str(row_dict.get("date", "")),
                            "department_code": str(row_dict.get("department_code", "DEPT_GENERAL")),
                            "raw_report_count": int(row_dict.get("raw_report_count", 0)),
                            "master_issue_count": int(row_dict.get("master_issue_count", 0)),
                            "duplicate_ratio": float(row_dict.get("duplicate_ratio", 0.0)),
                            "hotspot_score": float(row_dict.get("hotspot_score", 0.0)),
                            "is_anomaly": bool(score >= anomaly_predictor.threshold_low_medium),
                            "anomaly_score": score,
                            "anomaly_level": level,
                            "anomaly_type": pattern,
                            "contributing_indicators": indicators
                        })
                    res_list.sort(key=lambda x: x["anomaly_score"], reverse=True)
                    anom_cnt = sum(1 for r in res_list if r["is_anomaly"])
                    result = {
                        "status": "success",
                        "results": res_list,
                        "total_analyzed": len(res_list),
                        "anomalies_detected": anom_cnt,
                        "model_version": "6.0.0-iforest"
                    }
                result["isAvailable"] = True
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self._set_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps(result).encode("utf-8"))
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self._set_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"error": f"Internal batch anomaly analysis error: {str(e)}"}).encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

def run_server(port=8000):
    global classifier, duplicate_engine, hotspot_engine, severity_predictor, sla_predictor, anomaly_predictor
    print(f"[CivicPulse AI] Loading Component 1 Classifier...", flush=True)
    classifier = ComplaintClassifier()
    print(f"[CivicPulse AI] Loading Component 2 Duplicate Engine...", flush=True)
    duplicate_engine = MultimodalDuplicateEngine()
    print(f"[CivicPulse AI] Loading Component 3 Hotspot Engine...", flush=True)
    hotspot_engine = LocationHotspotEngine()
    print(f"[CivicPulse AI] Loading Component 4 Severity Predictor...", flush=True)
    severity_artifact_dir = os.path.join(os.path.dirname(__file__), 'severity_prediction', 'artifacts')
    severity_predictor = SeverityPredictor().load_artifacts(severity_artifact_dir)
    print(f"[CivicPulse AI] Loading Component 5 SLA Predictor...", flush=True)
    sla_artifact_dir = os.path.join(os.path.dirname(__file__), 'sla_prediction', 'artifacts')
    sla_predictor = SLAPredictor()
    sla_predictor.load_artifacts(sla_artifact_dir)
    print(f"[CivicPulse AI] Loading Component 6 Anomaly Predictor...", flush=True)
    anomaly_artifact_dir = os.path.join(os.path.dirname(__file__), 'anomaly_detection', 'artifacts')
    anomaly_predictor = IsolationForestPredictor()
    anomaly_predictor.load_artifacts(anomaly_artifact_dir)

    server_address = ("", port)
    httpd = HTTPServer(server_address, UnifiedAIHandler)
    print(f"[CivicPulse AI] Unified Server active at http://127.0.0.1:{port}", flush=True)
    print("[CivicPulse AI] Serves /predict, /predict-duplicate, /predict-hotspots, /predict-severity, /predict-sla-breach, /predict-anomaly, /analyze-anomalies, /health", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down Unified AI Server...", flush=True)
        httpd.server_close()

if __name__ == "__main__":
    port = 8000
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            pass
    run_server(port)
