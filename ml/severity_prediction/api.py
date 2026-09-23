"""
@file api.py
@description HTTP API server for CivicPulse AI Component 4 (Severity / Priority Prediction).
Exposes POST /predict-severity and GET /health.
"""

import os
import sys
import json
from http.server import HTTPServer, BaseHTTPRequestHandler

sys.path.insert(0, os.path.dirname(__file__))
from severity_engine import SeverityPredictor

severity_predictor = None

class SeverityAPIHandler(BaseHTTPRequestHandler):
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
                "component": "Component 4: AI Severity / Priority Prediction",
                "version": "1.0.0-rf-component4"
            }
            self.wfile.write(json.dumps(response).encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path in ["/predict-severity", "/api/predict-severity"]:
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)

            try:
                data = json.loads(body.decode("utf-8")) if body else {}
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
        else:
            self.send_response(404)
            self.end_headers()

def run_severity_server(port=8004):
    global severity_predictor
    artifact_dir = os.path.join(os.path.dirname(__file__), "artifacts")
    print(f"[CivicPulse Component 4] Loading severity artifacts from {artifact_dir}...", flush=True)
    severity_predictor = SeverityPredictor()
    severity_predictor.load_artifacts(artifact_dir)

    server_address = ("", port)
    httpd = HTTPServer(server_address, SeverityAPIHandler)
    print(f"[CivicPulse Component 4] Severity API active at http://127.0.0.1:{port}", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down Component 4 API server...", flush=True)
        httpd.server_close()

if __name__ == "__main__":
    run_severity_server()
