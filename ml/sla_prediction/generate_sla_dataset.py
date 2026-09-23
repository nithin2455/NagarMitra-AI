"""
generate_sla_dataset.py
Generates N=4,200 leakage-controlled SLA breach benchmark dataset.
Features are strictly restricted to submission-time (t=0) information.
Data is partitioned into reproducible splits:
- data/splits/sla_train.csv (2,940 records, 70%)
- data/splits/sla_val.csv (630 records, 15%)
- data/splits/sla_test.csv (630 records, 15%)
"""

import os
import random
import datetime
import pandas as pd
import numpy as np

# Set fixed seeds for reproducibility
random.seed(42)
np.random.seed(42)

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SPLITS_DIR = os.path.join(BASE_DIR, "data", "splits")
os.makedirs(SPLITS_DIR, exist_ok=True)

CATEGORIES_CONFIG = {
    'roads': {'dept': 'DEPT_ROADS', 'name': 'Roads & Infrastructure', 'base_resp': 12},
    'drainage': {'dept': 'DEPT_DRAINAGE', 'name': 'Drainage & Sewerage', 'base_resp': 6},
    'garbage': {'dept': 'DEPT_SANITATION', 'name': 'Sanitation & Solid Waste', 'base_resp': 12},
    'water': {'dept': 'DEPT_WATER', 'name': 'Water Supply & Quality', 'base_resp': 4},
    'streetlights': {'dept': 'DEPT_ELECTRICITY', 'name': 'Electricity & Streetlights', 'base_resp': 4},
    'infrastructure': {'dept': 'DEPT_WORKS', 'name': 'Public Works & Infrastructure', 'base_resp': 24},
    'other': {'dept': 'DEPT_GENERAL', 'name': 'General Municipal Operations', 'base_resp': 12},
}

SEVERITY_MULTIPLIERS = {
    'CRITICAL': 0.25,
    'HIGH': 0.5,
    'MEDIUM': 1.0,
    'LOW': 1.5,
}

COMPLAINT_TEMPLATES = {
    'roads': [
        "Massive pothole causing severe traffic delay near main intersection",
        "Road surface cracked and unpaved causing risk for two-wheelers",
        "Deep crater formed after rains near public school gate",
        "Road cave-in reported on highway access lane",
        "Minor tar peeling on residential side street"
    ],
    'drainage': [
        "Overflowing sewage line flooding residential street and homes",
        "Clogged storm drain causing severe waterlogging during rain",
        "Foul stench and black water coming from open drainage pipe",
        "Open manhole cover on main sidewalk presents fatal hazard",
        "Slow drainage runoff on commercial market road"
    ],
    'garbage': [
        "Uncollected garbage pile attracting stray animals near hospital gate",
        "Overflowing community dump bin spilling onto main road",
        "Illegal dumping of commercial debris in public park",
        "Foul smell from uncleared waste bin near apartment entrance",
        "Minor littering near bus shelter"
    ],
    'water': [
        "Main pipeline burst wasting thousands of liters of clean water",
        "Contaminated muddy water coming from municipal tap supply",
        "No water supply for last 48 hours in entire neighborhood block",
        "Low water pressure in residential high-rise complex",
        "Minor leak near public water standpost"
    ],
    'streetlights': [
        "Live high-voltage electric wire hanging dangerously low near school",
        "Entire street light network down making dark alley unsafe at night",
        "Sparking electrical transformer near residential area",
        "Flickering streetlight fixture on main road",
        "Single street lamp bulb burnt out on quiet street"
    ],
    'infrastructure': [
        "Pedestrian footbridge concrete pillar showing structural cracks",
        "Collapsed public park boundary wall blocking walkway",
        "Damaged bus shelter roof leaning precariously",
        "Broken railing on canal overbridge",
        "Minor paint peeling on government office gate"
    ],
    'other': [
        "Unsanitary public toilet conditions in central market",
        "Stray dog menace near elementary school playground",
        "Noise pollution from unauthorized loudspeaker after midnight",
        "Unauthorized hawker encroachment blocking shop entrance",
        "General inquiry regarding municipal service timing"
    ]
}

URGENCY_KEYWORDS = [
    "urgent", "immediately", "dangerous", "emergency", "blocking",
    "flooding", "hospital", "school", "overflow", "hazard", "fatal",
    "burst", "sparking", "collapsed", "contamination", "crater"
]

def generate_records(num_records=4200):
    records = []
    categories = list(CATEGORIES_CONFIG.keys())
    severities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
    
    start_date = datetime.datetime(2025, 1, 1, 0, 0, 0)
    
    for i in range(num_records):
        cid = f"COMP-SLA-{i+10001}"
        cat = categories[i % len(categories)]
        cfg = CATEGORIES_CONFIG[cat]
        dept = cfg['dept']
        
        # Severity selection (correlated slightly with text template)
        tmpl_idx = random.randint(0, len(COMPLAINT_TEMPLATES[cat]) - 1)
        desc = COMPLAINT_TEMPLATES[cat][tmpl_idx]
        
        # Determine Component 4 predicted severity
        if tmpl_idx in [0, 1]:
            pred_sev = random.choice(['HIGH', 'CRITICAL'])
        elif tmpl_idx in [2, 3]:
            pred_sev = random.choice(['MEDIUM', 'HIGH'])
        else:
            pred_sev = random.choice(['LOW', 'MEDIUM'])
            
        sev_mult = SEVERITY_MULTIPLIERS[pred_sev]
        resp_sla_hours = max(1.0, round(cfg['base_resp'] * sev_mult, 1))
        
        # Generate Component 4 class probabilities
        probs = [0.1, 0.1, 0.1, 0.1]
        sev_idx = severities.index(pred_sev)
        probs[sev_idx] += 0.6
        s = sum(probs)
        prob_low, prob_medium, prob_high, prob_critical = [round(p/s, 4) for p in probs]
        
        # Submission timestamp
        days_offset = random.randint(0, 180)
        hours_offset = random.randint(0, 23)
        mins_offset = random.randint(0, 59)
        sub_dt = start_date + datetime.timedelta(days=days_offset, hours=hours_offset, minutes=mins_offset)
        
        hour = sub_dt.hour
        day_of_week = sub_dt.weekday() # 0 = Mon, 6 = Sun
        is_weekend = 1 if day_of_week >= 5 else 0
        is_working_hours = 1 if (8 <= hour <= 18 and not is_weekend) else 0
        
        # Spatial features (Chennai center ~ 13.0827, 80.2707)
        lat = round(13.0827 + random.uniform(-0.15, 0.15), 6)
        lng = round(80.2707 + random.uniform(-0.15, 0.15), 6)
        
        # Operational context at submission
        hotspot_score = round(random.uniform(0.0, 95.0), 2)
        density_score = round(hotspot_score / 100.0, 4)
        is_hotspot_area = 1 if hotspot_score >= 60.0 else 0
        
        master_issue_count = random.choice([1, 1, 1, 2, 3, 5, 8]) if is_hotspot_area else 1
        support_count = master_issue_count * random.randint(1, 6)
        
        word_count = len(desc.split())
        urgency_kw_count = sum(1 for w in desc.lower().split() if any(k in w for k in URGENCY_KEYWORDS))
        
        # Calculate realistic actual response time (operational ground truth)
        # Factors that delay response (increase actual response hours):
        # 1. Off-hours / weekend submission (+ 4 to 16 hours delay before officer sees it)
        # 2. Strict / short response SLA (e.g. 1-2 hours) is harder to meet during peak workload
        # 3. High hotspot score / high backlog (+ 2 to 8 hours delay)
        # 4. Department specific workload factors
        
        base_delay = np.random.exponential(scale=resp_sla_hours * 0.7)
        
        if not is_working_hours:
            base_delay += random.uniform(4.0, 14.0)
            
        if is_hotspot_area:
            base_delay += random.uniform(2.0, 8.0)
            
        if master_issue_count > 3:
            base_delay += random.uniform(1.0, 5.0)
            
        actual_response_hours = round(max(0.2, base_delay), 2)
        
        # Ground truth target: Response SLA Breached (1) if actual > allowed SLA
        sla_breached = 1 if actual_response_hours > resp_sla_hours else 0
        
        record = {
            'complaint_id': cid,
            'title': f"{cat.capitalize()} Complaint - {cid}",
            'description': desc,
            'category_id': cat,
            'department_id': dept,
            'submitted_at': sub_dt.isoformat(),
            'created_hour': hour,
            'created_day_of_week': day_of_week,
            'created_month': sub_dt.month,
            'is_weekend': is_weekend,
            'is_working_hours': is_working_hours,
            'response_sla_hours': resp_sla_hours,
            'predicted_severity': pred_sev,
            'prob_low': prob_low,
            'prob_medium': prob_medium,
            'prob_high': prob_high,
            'prob_critical': prob_critical,
            'master_issue_count_at_submission': master_issue_count,
            'support_count_at_submission': support_count,
            'hotspot_score_at_submission': hotspot_score,
            'density_score_at_submission': density_score,
            'is_hotspot_area': is_hotspot_area,
            'latitude': lat,
            'longitude': lng,
            'word_count': word_count,
            'urgency_kw_count': urgency_kw_count,
            # Ground truth fields (Stored for target labeling only - NEVER used as input features)
            'actual_response_hours': actual_response_hours,
            'sla_breached': sla_breached
        }
        records.append(record)
        
    df = pd.DataFrame(records)
    
    # Shuffle dataset
    df = df.sample(frac=1.0, random_state=42).reset_index(drop=True)
    
    # Stratified/reproducible split: Train 70% (2940), Val 15% (630), Test 15% (630)
    n_total = len(df)
    n_train = int(n_total * 0.70)
    n_val = int(n_total * 0.15)
    
    train_df = df.iloc[:n_train].reset_index(drop=True)
    val_df = df.iloc[n_train:n_train+n_val].reset_index(drop=True)
    test_df = df.iloc[n_train+n_val:].reset_index(drop=True)
    
    train_path = os.path.join(SPLITS_DIR, "sla_train.csv")
    val_path = os.path.join(SPLITS_DIR, "sla_val.csv")
    test_path = os.path.join(SPLITS_DIR, "sla_test.csv")
    
    train_df.to_csv(train_path, index=False)
    val_df.to_csv(val_path, index=False)
    test_df.to_csv(test_path, index=False)
    
    print(f"[SUCCESS] Dataset generated:")
    print(f"  Total records: {n_total}")
    print(f"  Train set: {len(train_df)} saved to {train_path}")
    print(f"  Val set:   {len(val_df)} saved to {val_path}")
    print(f"  Test set:  {len(test_df)} saved to {test_path}")
    print(f"  Breach class distribution overall: Breached={df['sla_breached'].sum()} ({df['sla_breached'].mean()*100:.2f}%), Non-Breached={(df['sla_breached']==0).sum()}")

if __name__ == "__main__":
    generate_records()
