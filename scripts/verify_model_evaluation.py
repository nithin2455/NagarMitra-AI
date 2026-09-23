"""
CivicPulse AI Component 1 — Evaluation Verification & Unseen Manual Test Suite
"""

import os
import sys
import json
import joblib
import pandas as pd
import numpy as np
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SPLITS_DIR = os.path.join(BASE_DIR, "data", "splits")
ARTIFACTS_DIR = os.path.join(BASE_DIR, "ml", "complaint_classifier", "artifacts")

# Load saved vectorizer & classifier
vectorizer = joblib.load(os.path.join(ARTIFACTS_DIR, "tfidf_vectorizer.joblib"))
classifier = joblib.load(os.path.join(ARTIFACTS_DIR, "svm_classifier.joblib"))

with open(os.path.join(ARTIFACTS_DIR, "model_meta.json")) as f:
    meta = json.load(f)

test_df = pd.read_csv(os.path.join(SPLITS_DIR, "classification_test.csv"))
dept_labels = ["roads", "drainage", "garbage", "water", "streetlights", "infrastructure", "other"]

# 1. Re-evaluate untouched test set using clean_text (title + description)
X_test_clean = vectorizer.transform(test_df['clean_text'])
y_test = test_df['category_id']

preds_clean = classifier.predict(X_test_clean)
acc_clean = accuracy_score(y_test, preds_clean)
prec_macro_clean = precision_score(y_test, preds_clean, average='macro')
prec_weighted_clean = precision_score(y_test, preds_clean, average='weighted')
rec_macro_clean = recall_score(y_test, preds_clean, average='macro')
rec_weighted_clean = recall_score(y_test, preds_clean, average='weighted')
f1_macro_clean = f1_score(y_test, preds_clean, average='macro')
f1_weighted_clean = f1_score(y_test, preds_clean, average='weighted')
cm_clean = confusion_matrix(y_test, preds_clean, labels=dept_labels)

print("--- 1. UNTOUCHED TEST SET EVALUATION (clean_text) ---")
print(f"Test Count: {len(test_df)}")
print(f"Accuracy: {acc_clean*100:.2f}%")
print(f"Macro Precision: {prec_macro_clean:.4f}")
print(f"Weighted Precision: {prec_weighted_clean:.4f}")
print(f"Macro Recall: {rec_macro_clean:.4f}")
print(f"Weighted Recall: {rec_weighted_clean:.4f}")
print(f"Macro F1: {f1_macro_clean:.4f}")
print(f"Weighted F1: {f1_weighted_clean:.4f}")
print("Confusion Matrix:\n", cm_clean)

# 2. Evaluate untouched test set using description ONLY (without title category leakage)
X_test_desc = vectorizer.transform(test_df['description'])
preds_desc = classifier.predict(X_test_desc)
acc_desc = accuracy_score(y_test, preds_desc)
f1_desc = f1_score(y_test, preds_desc, average='weighted')

print("\n--- 2. TEST SET EVALUATION (description ONLY - Without Title Category Leakage) ---")
print(f"Accuracy: {acc_desc*100:.2f}%")
print(f"Weighted F1: {f1_desc:.4f}")

# 3. 15+ Genuinely New Manually Written Complaint Examples (Unseen, non-template)
unseen_manual_examples = [
    # ROADS (3 examples)
    {"input": "Several street tiles and paver blocks have collapsed near the main college bus stop creating severe tripping hazard.", "expected": "roads"},
    {"input": "Deep crater formed on the asphalt near the railway gate, heavy vehicles are getting stuck during rain.", "expected": "roads"},
    {"input": "The main road surface has completely peeled off leaving sharp gravel stones that puncture bike tires.", "expected": "roads"},

    # DRAINAGE (3 examples)
    {"input": "Black stinking gutter water is overflowing from the choked drain channel right into our apartment driveway.", "expected": "drainage"},
    {"input": "The storm water drain pipe is blocked with plastic bottles causing wastewater to pool in front of shops.", "expected": "drainage"},
    {"input": "A broken manhole in our lane is spilling foul smelling sewage sludge onto the public footpath.", "expected": "drainage"},

    # GARBAGE (3 examples)
    {"input": "Garbage has not been collected from our street dustbins for four consecutive days and waste is scattering.", "expected": "garbage"},
    {"input": "Commercial food vendors are dumping rotten vegetable waste openly in the open ground behind the school.", "expected": "garbage"},
    {"input": "Public trash cans are overflowing with plastic bags and stray dogs are pulling rubbish onto the road.", "expected": "garbage"},

    # WATER (3 examples)
    {"input": "Our neighborhood has received no municipal drinking water supply since yesterday morning.", "expected": "water"},
    {"input": "The main underground supply pipeline cracked and fresh clean water is gushing out on 3rd Main Road.", "expected": "water"},
    {"input": "Tap water supplied to residential flats today is contaminated with yellow dirt and muddy sediment.", "expected": "water"},

    # STREETLIGHTS (3 examples)
    {"input": "All streetlights along the outer ring road are dark since last night making driving unsafe.", "expected": "streetlights"},
    {"input": "An overhead electric wire snapped from the pole and is hanging low near the park gate.", "expected": "streetlights"},
    {"input": "The high mast electric light at the major junction is flickering continuously and blinding commuters.", "expected": "streetlights"},

    # INFRASTRUCTURE (2 examples)
    {"input": "The concrete bench and fence railing inside the children park are severely cracked and broken.", "expected": "infrastructure"},
    {"input": "Plaster wall of the municipal public toilet building is peeling off and the roof metal sheet is damaged.", "expected": "infrastructure"},

    # OTHER (2 examples)
    {"input": "A large pack of aggressive stray dogs is barking and chasing night commuters near the layout.", "expected": "other"},
    {"input": "Loud music is being played from unauthorized sound speakers past midnight causing severe sleep disturbance.", "expected": "other"}
]

print("\n--- 3. UNSEEN MANUAL TEST EVALUATION (19 Genuinely New Examples) ---")
manual_results = []
correct_count = 0

for item in unseen_manual_examples:
    text = item["input"]
    expected = item["expected"]
    
    # Predict using vectorizer & classifier
    X_text = vectorizer.transform([text])
    probs = classifier.predict_proba(X_text)[0]
    classes = list(classifier.classes_)
    
    max_idx = int(np.argmax(probs))
    pred_cat = classes[max_idx]
    conf = float(probs[max_idx])
    
    is_correct = (pred_cat == expected)
    if is_correct:
        correct_count += 1
        
    dept_info = classifier.classes_
    
    res_entry = {
        "input": text,
        "expected_category": expected,
        "predicted_category": pred_cat,
        "confidence": round(conf, 4),
        "confidence_pct": f"{conf*100:.1f}%",
        "is_correct": is_correct,
        "all_probs": {classes[i]: round(float(probs[i]), 4) for i in range(len(classes))}
    }
    manual_results.append(res_entry)
    
    status_str = "CORRECT" if is_correct else "MISMATCH"
    print(f"[{status_str}] Expected: {expected:12s} | Pred: {pred_cat:12s} | Conf: {conf*100:5.1f}% | Text: \"{text[:60]}...\"")

manual_acc = correct_count / len(unseen_manual_examples)
print(f"\nUnseen Manual Accuracy: {correct_count}/{len(unseen_manual_examples)} ({manual_acc*100:.2f}%)")

# Save results for documentation
with open(os.path.join(BASE_DIR, "docs", "ai-ml", "unseen_manual_results.json"), 'w', encoding='utf-8') as f:
    json.dump({
        "manual_accuracy": manual_acc,
        "total_examples": len(unseen_manual_examples),
        "correct_examples": correct_count,
        "results": manual_results
    }, f, indent=2)
