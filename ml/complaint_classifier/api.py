"""
CivicPulse AI Component 1 — Lightweight HTTP Prediction API Server
Serves POST /predict endpoint for React CivicPulse frontend integration on port 8000.
"""

import os
import sys
import json
from http.server import HTTPServer, BaseHTTPRequestHandler
from predict import ComplaintClassifier

# Global classifier instance
classifier = None

class PredictionAPIHandler(BaseHTTPRequestHandler):
    def _set_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    def do_OPTIONS(self):
        self.send_response(200)
        self._set_cors_headers()
        self.end_headers()

    def do_GET(self):
        if self.path == "/health" or self.path == "/":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._set_cors_headers()
            self.end_headers()
            response = {
                "status": "healthy",
                "service": "CivicPulse AI Complaint Classifier API",
                "version": "1.0.0",
                "model": "TF-IDF + Calibrated Linear Classifier"
            }
            self.wfile.write(json.dumps(response).encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path in ["/predict", "/api/predict"]:
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            
            try:
                data = json.loads(body.decode("utf-8"))
            except Exception as e:
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self._set_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"error": f"Invalid JSON payload: {str(e)}"}).encode("utf-8"))
                return

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
                self.wfile.write(json.dumps({"error": f"Internal prediction error: {str(e)}"}).encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

def run_server(port=8000):
    global classifier
    print(f"Loading ComplaintClassifier model artifacts from artifacts/...", flush=True)
    classifier = ComplaintClassifier()
    server_address = ("", port)
    httpd = HTTPServer(server_address, PredictionAPIHandler)
    print(f"CivicPulse AI Complaint Classification API running on http://127.0.0.1:{port}", flush=True)
    print("Press Ctrl+C to stop.", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down API server...", flush=True)
        httpd.server_close()

if __name__ == "__main__":
    port = 8000
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            pass
    run_server(port)
