"""
CivicPulse AI Component 1 — API Verification Script
Tests GET /health and POST /predict across valid, empty, short, noisy, Tamil, and unusual inputs.
"""

import os
import sys
import json
import time
import subprocess
import urllib.request

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
API_SCRIPT = os.path.join(BASE_DIR, "ml", "complaint_classifier", "api.py")
PYTHON_EXE = os.path.join(os.path.expanduser("~"), ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "python", "python.exe")

print("1. Starting API Server on Port 8000...", flush=True)
proc = subprocess.Popen([PYTHON_EXE, "-u", API_SCRIPT, "8000"], cwd=BASE_DIR, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
time.sleep(2) # Give server 2 seconds to bind port

test_results = []

def make_request(url, method="GET", payload=None):
    req = urllib.request.Request(url, method=method)
    req.add_header("Content-Type", "application/json")
    data_bytes = None
    if payload:
        data_bytes = json.dumps(payload).encode('utf-8')
    with urllib.request.urlopen(req, data=data_bytes, timeout=5) as resp:
        return resp.status, json.loads(resp.read().decode('utf-8'))

try:
    # Test 1: GET /health
    status, res = make_request("http://127.0.0.1:8000/health")
    print(f"Test 1 [GET /health]: Status={status}, Service={res.get('service')}")
    test_results.append(("GET /health", status == 200 and res.get("status") == "healthy"))

    # Test 2: Valid Complaint
    status, res = make_request("http://127.0.0.1:8000/predict", "POST", {
        "title": "Deep pothole on Anna Salai",
        "description": "Large deep pothole causing traffic gridlock and accidents."
    })
    print(f"Test 2 [Valid Complaint]: Category={res.get('category')}, Conf={res.get('confidence')}")
    test_results.append(("POST /predict Valid", status == 200 and res.get("category") == "roads"))

    # Test 3: Empty Complaint
    status, res = make_request("http://127.0.0.1:8000/predict", "POST", {
        "title": "",
        "description": ""
    })
    print(f"Test 3 [Empty Complaint]: Fallback={res.get('isFallback')}, Category={res.get('category')}")
    test_results.append(("POST /predict Empty", status == 200 and res.get("isFallback") == True))

    # Test 4: Very Short Complaint
    status, res = make_request("http://127.0.0.1:8000/predict", "POST", {
        "description": "pothole"
    })
    print(f"Test 4 [Short Complaint]: Category={res.get('category')}, Conf={res.get('confidence')}")
    test_results.append(("POST /predict Short", status == 200 and "category" in res))

    # Test 5: Noisy Text
    status, res = make_request("http://127.0.0.1:8000/predict", "POST", {
        "description": "12345 !!! ??? ### $$$"
    })
    print(f"Test 5 [Noisy Text]: Category={res.get('category')}, Conf={res.get('confidence')}")
    test_results.append(("POST /predict Noisy", status == 200 and "category" in res))

    # Test 6: Native Tamil Complaint
    status, res = make_request("http://127.0.0.1:8000/predict", "POST", {
        "description": "அண்ணா சாலையில் உள்ள பெரும் பள்ளத்தால் போக்குவரத்து நெரிசல் ஏற்படுகிறது."
    })
    print(f"Test 6 [Tamil Text]: Category={res.get('category')}, Conf={res.get('confidence')}")
    test_results.append(("POST /predict Tamil", status == 200 and "category" in res))

    # Test 7: Unusual Complaint
    status, res = make_request("http://127.0.0.1:8000/predict", "POST", {
        "description": "Alien spaceship landed on street causing public confusion."
    })
    print(f"Test 7 [Unusual Text]: Category={res.get('category')}, Conf={res.get('confidence')}")
    test_results.append(("POST /predict Unusual", status == 200 and "category" in res))

finally:
    proc.terminate()
    proc.wait()

print("\n--- API VERIFICATION RESULTS ---")
all_passed = True
for name, passed in test_results:
    print(f"  {name}: {'PASSED' if passed else 'FAILED'}")
    if not passed:
        all_passed = False

print(f"Overall API Verification: {'ALL PASSED' if all_passed else 'SOME FAILED'}")
