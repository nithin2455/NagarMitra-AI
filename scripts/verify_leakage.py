"""
CivicPulse AI Component 1 — Data Leakage & Dataset Inspection Verification Script
"""

import os
import sys
import json
import pandas as pd
import numpy as np

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SPLITS_DIR = os.path.join(BASE_DIR, "data", "splits")

train_df = pd.read_csv(os.path.join(SPLITS_DIR, "classification_train.csv"))
val_df = pd.read_csv(os.path.join(SPLITS_DIR, "classification_val.csv"))
test_df = pd.read_csv(os.path.join(SPLITS_DIR, "classification_test.csv"))

print(f"Loaded Train: {len(train_df):,}, Val: {len(val_df):,}, Test: {len(test_df):,}")

# 1. Exact ID Duplicates
train_ids = set(train_df['grievance_id'])
val_ids = set(val_df['grievance_id'])
test_ids = set(test_df['grievance_id'])

id_overlap_tr_val = train_ids.intersection(val_ids)
id_overlap_tr_te = train_ids.intersection(test_ids)
id_overlap_val_te = val_ids.intersection(test_ids)

print("\n--- 1. EXACT ID DUPLICATE CHECK ---")
print(f"Train - Val ID Overlap: {len(id_overlap_tr_val)}")
print(f"Train - Test ID Overlap: {len(id_overlap_tr_te)}")
print(f"Val - Test ID Overlap: {len(id_overlap_val_te)}")

# 2. Exact Text Duplicates
train_texts = set(train_df['clean_text'])
val_texts = set(val_df['clean_text'])
test_texts = set(test_df['clean_text'])

text_overlap_tr_val = train_texts.intersection(val_texts)
text_overlap_tr_te = train_texts.intersection(test_texts)
text_overlap_val_te = val_texts.intersection(test_texts)

print("\n--- 2. EXACT TEXT DUPLICATE CHECK ---")
print(f"Train - Val Text Overlap: {len(text_overlap_tr_val)}")
print(f"Train - Test Text Overlap: {len(text_overlap_tr_te)}")
print(f"Val - Test Text Overlap: {len(text_overlap_val_te)}")

# 3. Near-Duplicate / Template Overlap Analysis
# Analyze description text without title prefix to check template repetition
train_descs = set(train_df['description'])
val_descs = set(val_df['description'])
test_descs = set(test_df['description'])

desc_overlap_tr_te = train_descs.intersection(test_descs)
print(f"\nExact Description Overlap (Train - Test): {len(desc_overlap_tr_te)}")

# Check template repetition by stripping Ward/District references
def normalize_template(s):
    s = str(s).lower()
    # Strip Ward & District references
    import re
    s = re.sub(r'\(ref ward-\d+,\s*[^)]+\)', '', s)
    s = re.sub(r'report in [^-\n]+', '', s)
    return s.strip()

train_templates = set(train_df['description'].apply(normalize_template))
test_templates = set(test_df['description'].apply(normalize_template))
template_overlap = train_templates.intersection(test_templates)

print(f"\nUnique Templates in Train: {len(train_templates)}")
print(f"Unique Templates in Test: {len(test_templates)}")
print(f"Template Overlap Count (Train - Test): {len(template_overlap)}")

# 4. Check if Category / Department Name is inside title / clean_text
print("\n--- 4. LABEL LEAKAGE IN TEXT CHECK ---")
for cat_id in ["roads", "drainage", "garbage", "water", "streetlights", "infrastructure", "other"]:
    matches_title = test_df['title'].str.lower().str.contains(cat_id).sum()
    matches_desc = test_df['description'].str.lower().str.contains(cat_id).sum()
    print(f"  Category '{cat_id}': Appears in Title={matches_title}, Description={matches_desc}")

# 5. Class Distributions
print("\n--- 5. CLASS DISTRIBUTIONS ---")
print("Train Class Distribution:\n", train_df['category_id'].value_counts())
print("\nVal Class Distribution:\n", val_df['category_id'].value_counts())
print("\nTest Class Distribution:\n", test_df['category_id'].value_counts())
