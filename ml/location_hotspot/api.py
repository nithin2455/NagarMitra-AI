"""
CivicPulse AI Component 3 — HTTP Prediction API Server for Geospatial DBSCAN Hotspot Detection
Serves POST /predict-hotspots endpoint on port 8000.
"""

import os
import sys
import json
from http.server import HTTPServer, BaseHTTPRequestHandler

sys.path.insert(0, os.path.dirname(__file__))
from hotspot_engine import LocationHotspotEngine

# Global engine instance
hotspot_engine = None

class HotspotAPIHandler(BaseHTTPRequestHandler):
    def _set_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    def do_OPTIONS(self):
        self.send_response(200)
        self._set_cors_headers()
        self.end_headers()

    def do_GET(self):
        if self.path in ["/health", "/", "/api/hotspot/health"]:
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._set_cors_headers()
            self.end_headers()
            response = {
                "status": "healthy",
                "service": "CivicPulse AI Geospatial DBSCAN Hotspot Detection API",
                "version": "3.0.0",
                "algorithm": "Spherical Haversine DBSCAN Spatial Clustering"
            }
            self.wfile.write(json.dumps(response).encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path in ["/predict-hotspots", "/api/predict-hotspots", "/api/hotspots"]:
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
        else:
            self.send_response(404)
            self.end_headers()

def run_server(port=8000):
    global hotspot_engine
    print(f"Initializing LocationHotspotEngine...", flush=True)
    hotspot_engine = LocationHotspotEngine()
    server_address = ("", port)
    httpd = HTTPServer(server_address, HotspotAPIHandler)
    print(f"CivicPulse AI Hotspot Detection API running on http://127.0.0.1:{port}", flush=True)
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
