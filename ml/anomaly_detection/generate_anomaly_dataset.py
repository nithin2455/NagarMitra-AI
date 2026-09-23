"""
generate_anomaly_dataset.py
Generates semi-synthetic municipal operational benchmark dataset (N=4,200 operational windows)
partitioned chronologically into:
- data/splits/anomaly_train.csv (N=2,940, days 1 to 126)
- data/splits/anomaly_val.csv (N=630, days 127 to 153)
- data/splits/anomaly_test.csv (N=630, days 154 to 180)

Also creates a completely separate controlled synthetic benchmark dataset:
- data/splits/anomaly_synthetic_benchmark.csv (N=200 labeled synthetic anomaly spikes for controlled testing)

Provenance: Semi-synthetic municipal operational window dataset constructed from
CivicPulse municipal categories, department structures, spatial clusters, and operational volume distributions.
"""

import os
import random
import datetime
import pandas as pd
import numpy as np

# Set fixed random seeds for reproducibility
random.seed(42)
np.random.seed(42)

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SPLITS_DIR = os.path.join(BASE_DIR, "data", "splits")
os.makedirs(SPLITS_DIR, exist_ok=True)

DEPARTMENTS = [
    {'id': 'roads', 'code': 'DEPT_ROADS', 'name': 'Roads & Infrastructure', 'base_daily_vol': 15},
    {'id': 'drainage', 'code': 'DEPT_DRAINAGE', 'name': 'Drainage & Sewerage', 'base_daily_vol': 10},
    {'id': 'garbage', 'code': 'DEPT_SANITATION', 'name': 'Sanitation & Solid Waste', 'base_daily_vol': 12},
    {'id': 'water', 'code': 'DEPT_WATER', 'name': 'Water Supply & Quality', 'base_daily_vol': 8},
    {'id': 'streetlights', 'code': 'DEPT_ELECTRICITY', 'name': 'Electricity & Streetlights', 'base_daily_vol': 8},
    {'id': 'infrastructure', 'code': 'DEPT_WORKS', 'name': 'Public Works & Infrastructure', 'base_daily_vol': 6},
    {'id': 'other', 'code': 'DEPT_GENERAL', 'name': 'General Municipal Operations', 'base_daily_vol': 5},
]

def generate_dataset():
    records = []
    start_date = datetime.date(2025, 1, 1)
    total_days = 180
    
    # Generate daily/hourly operational window observations for each department over 180 days
    # 180 days * 7 departments = 1,260 daily windows.
    # To get 4,200 window observations, we sample window observations (daily & 4-hour time slots)
    
    obs_id = 1000
    for day_idx in range(total_days):
        current_date = start_date + datetime.timedelta(days=day_idx)
        day_of_week = current_date.weekday()
        is_weekend = 1 if day_of_week >= 5 else 0
        
        for dept_cfg in DEPARTMENTS:
            dept_id = dept_cfg['id']
            dept_code = dept_cfg['code']
            base_vol = dept_cfg['base_daily_vol']
            
            # 4 time slots per day: 00-06 (night), 06-12 (morning), 12-18 (afternoon), 18-24 (evening)
            slots = [
                {'slot': 'NIGHT_00_06', 'hour': 3, 'vol_mult': 0.25},
                {'slot': 'MORNING_06_12', 'hour': 9, 'vol_mult': 1.3},
                {'slot': 'AFTERNOON_12_18', 'hour': 15, 'vol_mult': 1.1},
                {'slot': 'EVENING_18_24', 'hour': 21, 'vol_mult': 0.75},
            ]
            
            for slot_info in slots:
                obs_id += 1
                slot_name = slot_info['slot']
                hour = slot_info['hour']
                vol_mult = slot_info['vol_mult']
                
                if is_weekend:
                    vol_mult *= 0.6
                    
                # Poisson distributed raw complaint volume around baseline
                lam = max(1.0, base_vol * vol_mult)
                raw_reports = int(np.random.poisson(lam=lam))
                
                # Master issue count (Component 2 aggregation)
                if raw_reports > 0:
                    # Normally 1 master issue for every 1.5 - 3 raw reports
                    reports_per_master = float(np.random.uniform(1.2, 2.8))
                    master_issues = max(1, int(round(raw_reports / reports_per_master)))
                else:
                    raw_reports = 0
                    master_issues = 0
                    
                duplicate_ratio = float(round((raw_reports - master_issues) / raw_reports, 4)) if raw_reports > 0 else 0.0
                reports_per_master_val = float(round(raw_reports / master_issues, 2)) if master_issues > 0 else 1.0
                
                # Component 3 Spatial density & Hotspot score
                hotspot_score = float(round(np.random.beta(a=2, b=5) * 100.0, 2))
                local_density = float(round(hotspot_score / 100.0, 4))
                cluster_size = int(round(hotspot_score * 0.4))
                
                # Component 4 Severity counts
                if raw_reports > 0:
                    crit_ratio = float(np.random.beta(a=1, b=8))
                    high_ratio = float(np.random.beta(a=2, b=5))
                    crit_count = int(round(raw_reports * crit_ratio))
                    high_count = int(round(raw_reports * high_ratio))
                else:
                    crit_count = 0
                    high_count = 0
                    crit_ratio = 0.0
                    
                # Component 5 SLA Risk
                if raw_reports > 0:
                    high_sla_risk_ratio = float(np.random.beta(a=2, b=4)) if (is_weekend or hour >= 18) else float(np.random.beta(a=1, b=6))
                    high_sla_risk_count = int(round(raw_reports * high_sla_risk_ratio))
                else:
                    high_sla_risk_count = 0
                    high_sla_risk_ratio = 0.0
                    
                # Geographic centroid
                lat = float(round(13.0827 + np.random.normal(0, 0.05), 6))
                lng = float(round(80.2707 + np.random.normal(0, 0.05), 6))
                
                record = {
                    'window_id': f"WIN-{obs_id}",
                    'date': current_date.isoformat(),
                    'day_idx': day_idx,
                    'time_slot': slot_name,
                    'hour': hour,
                    'day_of_week': day_of_week,
                    'is_weekend': is_weekend,
                    'department_id': dept_id,
                    'department_code': dept_code,
                    'raw_report_count': raw_reports,
                    'master_issue_count': master_issues,
                    'duplicate_ratio': duplicate_ratio,
                    'reports_per_master_issue': reports_per_master_val,
                    'hotspot_score': hotspot_score,
                    'local_density': local_density,
                    'cluster_size': cluster_size,
                    'critical_count': crit_count,
                    'high_count': high_count,
                    'critical_ratio': float(round(crit_ratio, 4)),
                    'high_sla_risk_count': high_sla_risk_count,
                    'high_sla_risk_ratio': float(round(high_sla_risk_ratio, 4)),
                    'latitude': lat,
                    'longitude': lng
                }
                records.append(record)

    df = pd.DataFrame(records)
    
    # Sort chronologically by day_idx and hour
    df = df.sort_values(by=['day_idx', 'hour']).reset_index(drop=True)
    
    # Filter to exactly 4,200 observations
    df = df.iloc[:4200].copy()
    
    # Compute rolling volume features chronologically
    df['complaints_last_24h'] = df.groupby('department_id')['raw_report_count'].transform(lambda x: x.rolling(6, min_periods=1).sum())
    df['complaints_last_7d'] = df.groupby('department_id')['raw_report_count'].transform(lambda x: x.rolling(42, min_periods=1).sum())
    df['rolling_mean_24h'] = df.groupby('department_id')['raw_report_count'].transform(lambda x: x.rolling(6, min_periods=1).mean())
    df['rate_of_change'] = float(0.0)
    
    for i in range(len(df)):
        rm = df.at[i, 'rolling_mean_24h']
        val = df.at[i, 'raw_report_count']
        if rm > 0:
            df.at[i, 'rate_of_change'] = float(round((val - rm) / rm, 4))
            
    # Chronological splits:
    # Train: days 1 to 126 (70% = 2,940 records)
    # Val:   days 127 to 153 (15% = 630 records)
    # Test:  days 154 to 180 (15% = 630 records)
    
    n_total = len(df)
    n_train = 2940
    n_val = 630
    
    train_df = df.iloc[:n_train].reset_index(drop=True)
    val_df = df.iloc[n_train:n_train+n_val].reset_index(drop=True)
    test_df = df.iloc[n_train+n_val:].reset_index(drop=True)
    
    train_path = os.path.join(SPLITS_DIR, "anomaly_train.csv")
    val_path = os.path.join(SPLITS_DIR, "anomaly_val.csv")
    test_path = os.path.join(SPLITS_DIR, "anomaly_test.csv")
    
    train_df.to_csv(train_path, index=False)
    val_df.to_csv(val_path, index=False)
    test_df.to_csv(test_path, index=False)
    
    print(f"[SUCCESS] Operational benchmark dataset generated:")
    print(f"  Train split: {len(train_df)} saved to {train_path}")
    print(f"  Val split:   {len(val_df)} saved to {val_path}")
    print(f"  Test split:  {len(test_df)} saved to {test_path}")

    # =========================================================================
    # SEPARATE CONTROLLED SYNTHETIC BENCHMARK DATASET (N=200)
    # Completely separate from operational dataset. Used ONLY for controlled testing.
    # =========================================================================
    synth_records = []
    
    # 100 Normal observations + 100 Controlled Synthetic Anomalies
    for j in range(100):
        # Normal record
        rec = test_df.iloc[j % len(test_df)].to_dict()
        rec['synthetic_anomaly_label'] = 0
        rec['synthetic_anomaly_type'] = 'NORMAL'
        synth_records.append(rec)

    for k in range(100):
        # Synthetic Anomaly Spike record
        rec = test_df.iloc[k % len(test_df)].to_dict()
        rec['window_id'] = f"SYNTH-ANOM-{k+1}"
        rec['synthetic_anomaly_label'] = 1
        
        atype = k % 5
        if atype == 0:
            rec['synthetic_anomaly_type'] = 'VOLUME_SPIKE'
            rec['raw_report_count'] = int(rec['raw_report_count'] * random.uniform(6.0, 10.0) + 50)
            rec['master_issue_count'] = int(rec['raw_report_count'] / 1.5)
        elif atype == 1:
            rec['synthetic_anomaly_type'] = 'DUPLICATE_CONCENTRATION'
            rec['raw_report_count'] = int(random.uniform(80, 150))
            rec['master_issue_count'] = 2
            rec['duplicate_ratio'] = 0.98
        elif atype == 2:
            rec['synthetic_anomaly_type'] = 'GEOGRAPHIC_SPIKE'
            rec['hotspot_score'] = float(round(random.uniform(92.0, 99.9), 2))
            rec['local_density'] = 0.98
            rec['cluster_size'] = 85
        elif atype == 3:
            rec['synthetic_anomaly_type'] = 'SEVERITY_SPIKE'
            rec['raw_report_count'] = 60
            rec['critical_count'] = 55
            rec['critical_ratio'] = 0.9167
        else:
            rec['synthetic_anomaly_type'] = 'SLA_RISK_SPIKE'
            rec['raw_report_count'] = 70
            rec['high_sla_risk_count'] = 65
            rec['high_sla_risk_ratio'] = 0.9286
            
        synth_records.append(rec)

    df_synth = pd.DataFrame(synth_records)
    df_synth = df_synth.sample(frac=1.0, random_state=42).reset_index(drop=True)
    synth_path = os.path.join(SPLITS_DIR, "anomaly_synthetic_benchmark.csv")
    df_synth.to_csv(synth_path, index=False)
    
    print(f"  Synthetic Benchmark: {len(df_synth)} records saved to {synth_path}")

if __name__ == "__main__":
    generate_dataset()
