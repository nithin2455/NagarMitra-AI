"""
CivicPulse AI/ML Architecture — Step 3 Data Acquisition and Preparation Script
Executes Phases A through H:
- Phase A: Acquire datasets and save into data/raw/
- Phase B: Dataset inspection
- Phase C: Clean datasets and save into data/processed/
- Phase D: Category mapping to CivicPulse 7 departments
- Phase E: Prepare target labels and prevent SLA data leakage
- Phase F: Train/Val/Test reproducible splits into data/splits/
- Phase G: Data quality report compilation
- Phase H: Step 3 readiness table generation
"""

import os
import sys
import json
import csv
import urllib.request
import urllib.parse
import datetime
import math
import random
import hashlib
from PIL import Image, ImageEnhance, ImageOps
import pandas as pd
import numpy as np

# Set random seeds for reproducibility
random.seed(42)
np.random.seed(42)

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
RAW_DIR = os.path.join(BASE_DIR, "data", "raw")
PROCESSED_DIR = os.path.join(BASE_DIR, "data", "processed")
SPLITS_DIR = os.path.join(BASE_DIR, "data", "splits")
DOCS_DIR = os.path.join(BASE_DIR, "docs", "ai-ml")

os.makedirs(RAW_DIR, exist_ok=True)
os.makedirs(os.path.join(RAW_DIR, "images"), exist_ok=True)
os.makedirs(PROCESSED_DIR, exist_ok=True)
os.makedirs(os.path.join(PROCESSED_DIR, "images"), exist_ok=True)
os.makedirs(SPLITS_DIR, exist_ok=True)
os.makedirs(DOCS_DIR, exist_ok=True)

print(f"Directories initialized under {BASE_DIR}")
