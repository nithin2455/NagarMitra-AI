"""
CivicPulse AI Component 2 — HTTP Prediction API Server for Multimodal Duplicate Detection
Serves POST /predict-duplicate and POST /evaluate-pair endpoints on port 8000.
"""

import os
import sys
import json
from http.server import HTTPServer, BaseHTTPRequestHandler

sys.path.insert(0, os.path.dirname(__file__))
from duplicate_engine import MultimodalDuplicateEngine

# Global engine instance
duplicate_engine = None

class DuplicateAPIHandler(BaseHTTPRequestHandler):
    def _set_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    def do_OPTIONS(self):
        self.send_response(200)
        self._set_cors_headers()
        self.end_headers()

    def do_GET(self):
        if self.path in ["/health", "/", "/api/duplicate/health"]:
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._set_cors_headers()
            self.end_headers()
            response = {
                "status": "healthy",
                "service": "CivicPulse AI Multimodal Duplicate Detection API",
                "version": "2.0.0",
                "components": ["Text Similarity", "Haversine Distance", "pHash Visual Similarity"]
            }
            self.wfile.write(json.dumps(response).encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path in ["/predict-duplicate", "/api/predict-duplicate", "/api/duplicate-check"]:
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

            new_complaint = data.get("newComplaint", {})
            candidate_masters = data.get("candidateMasters", [])

            try:
                result = duplicate_engine.find_best_master_match(new_complaint, candidate_masters)
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self._set_cors_headers()
                self.end_headers()
                payload = {
                    "isAvailable": True,
                    "match": result,
                    "hasMatch": result is not None
                }
                self.wfile.write(json.dumps(payload).encode("utf-8"))
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self._set_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"error": f"Internal deduplication error: {str(e)}"}).encode("utf-8"))
        
        elif self.path in ["/evaluate-pair", "/api/evaluate-pair"]:
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            try:
                data = json.loads(body.decode("utf-8"))
                c1 = data.get("complaint1", {})
                c2 = data.get("complaint2", {})
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
        else:
            self.send_response(404)
            self.end_headers()

def run_server(port=8000):
    global duplicate_engine
    print(f"Initializing MultimodalDuplicateEngine...", flush=True)
    duplicate_engine = MultimodalDuplicateEngine()
    server_address = ("", port)
    httpd = HTTPServer(server_address, DuplicateAPIHandler)
    print(f"CivicPulse AI Duplicate Detection API running on http://127.0.0.1:{port}", flush=True)
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
