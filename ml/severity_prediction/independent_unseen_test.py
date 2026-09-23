"""
@file independent_unseen_test.py
@description Independent Unseen Test Suite for Retrained Leakage-Controlled Component 4.
Evaluates 25 newly authored, realistic Indian municipal complaints (with English & Tanglish phrasing)
spanning all categories and severity levels, testing true real-world generalization.
"""

import pandas as pd
import numpy as np
from severity_engine import SeverityPredictor

UNSEEN_COMPLAINTS_25 = [
    # --- ROADS ---
    {
        'id': 'UNSEEN-01',
        'category_id': 'roads',
        'department_code': 'DEPT_ROADS',
        'title': 'Faded white zebra crossing lines',
        'description': 'Zebra crossing paint near residential lane is faded, request repainting.',
        'true_severity': 'LOW'
    },
    {
        'id': 'UNSEEN-02',
        'category_id': 'roads',
        'department_code': 'DEPT_ROADS',
        'title': 'Medium pothole causing two-wheeler discomfort',
        'description': 'Pothole approximately 1 foot wide on neighborhood street causing difficulty for bikes.',
        'true_severity': 'MEDIUM'
    },
    {
        'id': 'UNSEEN-03',
        'category_id': 'roads',
        'department_code': 'DEPT_ROADS',
        'title': 'Deep crater on main avenue causing car tire burst and traffic blockage',
        'description': 'Dangerous deep crater on main avenue damaging car tires and causing traffic congestion.',
        'true_severity': 'HIGH',
        'support_count': 12, 'master_issue_count': 3, 'hotspot_priority': 65.0
    },
    {
        'id': 'UNSEEN-04',
        'category_id': 'roads',
        'department_code': 'DEPT_ROADS',
        'title': 'Catastrophic road cave-in and asphalt collapse on GST road',
        'description': 'Massive road crater opened up on main road causing vehicle overturn and live traffic hazard.',
        'true_severity': 'CRITICAL',
        'support_count': 35, 'master_issue_count': 8, 'hotspot_priority': 88.0
    },

    # --- WATER ---
    {
        'id': 'UNSEEN-05',
        'category_id': 'water',
        'department_code': 'DEPT_WATER',
        'title': 'Slight water pressure drop in morning tap',
        'description': 'Municipal tap water pressure is slightly lower than usual during morning supply hours.',
        'true_severity': 'LOW'
    },
    {
        'id': 'UNSEEN-06',
        'category_id': 'water',
        'department_code': 'DEPT_WATER',
        'title': 'Drinking water pipeline leaking on street',
        'description': 'Drinking water pipeline leaking small stream of clean water on roadside near residential building.',
        'true_severity': 'MEDIUM'
    },
    {
        'id': 'UNSEEN-07',
        'category_id': 'water',
        'department_code': 'DEPT_WATER',
        'title': 'Main municipal water supply pipeline burst leaving street without water',
        'description': 'Main feeder pipe burst flooding street and leaving 500 households without water for 24h.',
        'true_severity': 'HIGH',
        'support_count': 18, 'master_issue_count': 4, 'hotspot_priority': 72.0
    },
    {
        'id': 'UNSEEN-08',
        'category_id': 'water',
        'department_code': 'DEPT_WATER',
        'title': 'Toxic chemical effluent mixing into drinking water supply pipeline',
        'description': 'Industrial chemical sewage leaking directly into municipal drinking pipeline, causing severe illness.',
        'true_severity': 'CRITICAL',
        'support_count': 40, 'master_issue_count': 12, 'hotspot_priority': 94.0
    },

    # --- DRAINAGE ---
    {
        'id': 'UNSEEN-09',
        'category_id': 'drainage',
        'department_code': 'DEPT_DRAINAGE',
        'title': 'Dry leaves covering storm drain grate',
        'description': 'Accumulation of dry fallen leaves over storm drain inlet grate.',
        'true_severity': 'LOW'
    },
    {
        'id': 'UNSEEN-10',
        'category_id': 'drainage',
        'department_code': 'DEPT_DRAINAGE',
        'title': 'Street drain inlet clogged causing minor water puddle',
        'description': 'Street drain inlet blocked with debris causing minor water pooling after rain.',
        'true_severity': 'MEDIUM'
    },
    {
        'id': 'UNSEEN-11',
        'category_id': 'drainage',
        'department_code': 'DEPT_DRAINAGE',
        'title': 'Severe storm water logging blocking street access in Velachery',
        'description': 'Rainwater logging knee-deep across entire street blocking vehicles and shop entrances.',
        'true_severity': 'HIGH',
        'support_count': 22, 'master_issue_count': 5, 'hotspot_priority': 78.0
    },
    {
        'id': 'UNSEEN-12',
        'category_id': 'drainage',
        'department_code': 'DEPT_DRAINAGE',
        'title': 'Underground sewage main explosion flooding hospital basement',
        'description': 'Main sewage trunk line ruptured flooding city hospital basement with raw sewage creating immediate biohazard emergency.',
        'true_severity': 'CRITICAL',
        'support_count': 42, 'master_issue_count': 10, 'hotspot_priority': 96.0
    },

    # --- STREETLIGHTS ---
    {
        'id': 'UNSEEN-13',
        'category_id': 'streetlights',
        'department_code': 'DEPT_LIGHTING',
        'title': 'Single garden light shade dim in park',
        'description': 'Pedestrian walkway lamp shade slightly dusty and dim in public park.',
        'true_severity': 'LOW'
    },
    {
        'id': 'UNSEEN-14',
        'category_id': 'streetlights',
        'department_code': 'DEPT_LIGHTING',
        'title': 'Sodium streetlight bulb fused on residential road',
        'description': 'Sodium streetlight bulb fused outside house no 42 on quiet residential road.',
        'true_severity': 'MEDIUM'
    },
    {
        'id': 'UNSEEN-15',
        'category_id': 'streetlights',
        'department_code': 'DEPT_LIGHTING',
        'title': 'Entire street dark due to 15 streetlight failures on main road',
        'description': 'All 15 streetlights out on main connecting road creating dark zone and safety hazard for commuters.',
        'true_severity': 'HIGH',
        'support_count': 15, 'master_issue_count': 3, 'hotspot_priority': 68.0
    },
    {
        'id': 'UNSEEN-16',
        'category_id': 'streetlights',
        'department_code': 'DEPT_LIGHTING',
        'title': 'High-voltage 11kV live wire snapped hanging across school gate',
        'description': 'Sparking 11kV live cable hanging across primary school entrance gate, extreme electrocution danger.',
        'true_severity': 'CRITICAL',
        'support_count': 38, 'master_issue_count': 7, 'hotspot_priority': 91.0
    },

    # --- GARBAGE ---
    {
        'id': 'UNSEEN-17',
        'category_id': 'garbage',
        'department_code': 'DEPT_SANITATION',
        'title': 'Paper cup litter near park bench',
        'description': 'Few discarded paper tea cups scattered around park bench area.',
        'true_severity': 'LOW'
    },
    {
        'id': 'UNSEEN-18',
        'category_id': 'garbage',
        'department_code': 'DEPT_SANITATION',
        'title': 'Green waste bin overflowing uncleared for 3 days',
        'description': 'Municipal green bin overflowing with household waste uncleared for 72 hours.',
        'true_severity': 'MEDIUM'
    },
    {
        'id': 'UNSEEN-19',
        'category_id': 'garbage',
        'department_code': 'DEPT_SANITATION',
        'title': 'Multi-ton waste dump spilling onto main road lane causing stench',
        'description': 'Massive multi-ton waste pile spilling onto main road lane causing traffic blockage and stench.',
        'true_severity': 'HIGH',
        'support_count': 20, 'master_issue_count': 4, 'hotspot_priority': 70.0
    },
    {
        'id': 'UNSEEN-20',
        'category_id': 'garbage',
        'department_code': 'DEPT_SANITATION',
        'title': 'Toxic biohazardous hospital medical waste burning near residential apartments',
        'description': 'Illegal dump of hospital syringes and chemical waste set on fire emitting toxic fumes into homes.',
        'true_severity': 'CRITICAL',
        'support_count': 30, 'master_issue_count': 6, 'hotspot_priority': 89.0
    },

    # --- INFRASTRUCTURE & OTHER ---
    {
        'id': 'UNSEEN-21',
        'category_id': 'infrastructure',
        'department_code': 'DEPT_WORKS',
        'title': 'Municipal street sign board paint faded',
        'description': 'Municipal street sign board paint faded near junction.',
        'true_severity': 'LOW'
    },
    {
        'id': 'UNSEEN-22',
        'category_id': 'infrastructure',
        'department_code': 'DEPT_WORKS',
        'title': 'Traffic guard rail bent after vehicle impact',
        'description': 'Galvanized iron traffic barrier bent after minor vehicle impact near bus stand.',
        'true_severity': 'MEDIUM'
    },
    {
        'id': 'UNSEEN-23',
        'category_id': 'infrastructure',
        'department_code': 'DEPT_WORKS',
        'title': 'Imminent structural collapse of busy flyover bridge pillar',
        'description': 'Main load-bearing concrete pillar of busy flyover bridge cracked severely with chunks falling onto vehicles.',
        'true_severity': 'CRITICAL',
        'support_count': 45, 'master_issue_count': 11, 'hotspot_priority': 98.0
    },
    {
        'id': 'UNSEEN-24',
        'category_id': 'other',
        'department_code': 'DEPT_GENERAL',
        'title': 'Tree branch overhanging private wall',
        'description': 'Small tree branch extending over compound wall without immediate blockage.',
        'true_severity': 'LOW'
    },
    {
        'id': 'UNSEEN-25',
        'category_id': 'other',
        'department_code': 'DEPT_GENERAL',
        'title': 'Rabid stray dog pack biting children outside school gate',
        'description': 'Multiple children bitten and injured by aggressive rabid dog pack near school entrance.',
        'true_severity': 'CRITICAL',
        'support_count': 36, 'master_issue_count': 9, 'hotspot_priority': 93.0
    }
]

def run_independent_unseen_test():
    print("=== CIVICPULSE COMPONENT 4: INDEPENDENT UNSEEN TEST (25 COMPLAINTS) ===")

    predictor = SeverityPredictor()
    predictor.load_artifacts("ml/severity_prediction/artifacts")

    correct = 0
    total = len(UNSEEN_COMPLAINTS_25)

    print(f"\nEvaluating {total} newly authored unseen complaints across all categories...")
    print(f"{'ID':10s} | {'Category':12s} | {'True Severity':13s} | {'AI Predicted':13s} | {'Confidence':10s} | Match Status")
    print("-" * 78)

    for item in UNSEEN_COMPLAINTS_25:
        pred = predictor.predict(item)
        ai_sev = pred['predicted_severity']
        conf = pred['confidence']
        true_sev = item['true_severity']

        is_match = (ai_sev == true_sev)
        if is_match:
            correct += 1

        print(f"{item['id']:10s} | {item['category_id']:12s} | {true_sev:13s} | {ai_sev:13s} | {conf*100:8.1f}% | {'[MATCH]' if is_match else '[MISMATCH]'}")

    acc = (correct / total) * 100.0
    print("\n" + "=" * 78)
    print(f"INDEPENDENT UNSEEN TEST ACCURACY: {acc:.2f}% ({correct}/{total} correct)")
    print("=" * 78)

    return acc

if __name__ == "__main__":
    run_independent_unseen_test()
