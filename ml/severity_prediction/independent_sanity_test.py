"""
@file independent_sanity_test.py
@description Independent / Unseen Sanity Test for Component 4 Audit.
Evaluates the trained Random Forest model on 14 newly authored, realistic complaints
where severity varies WITHIN categories (e.g. minor road pothole vs major road collapse),
testing true real-world generalization.
"""

import pandas as pd
import numpy as np
from severity_engine import SeverityPredictor

def run_independent_sanity_test():
    print("=== CIVICPULSE COMPONENT 4 AUDIT: INDEPENDENT UNSEEN SANITY TEST ===")

    # 14 newly authored realistic municipal complaints with varying severity per category
    unseen_complaints = [
        # Roads category (Dataset maps roads -> HIGH)
        {
            'id': 'SANITY-01',
            'title': 'Minor cosmetic paint peeling on speed breaker',
            'description': 'Speed bump paint faded near quiet residential lane in Adyar.',
            'category_id': 'roads',
            'department_code': 'DEPT_ROADS',
            'true_human_severity': 'LOW'
        },
        {
            'id': 'SANITY-02',
            'title': 'Catastrophic road cave-in and main highway collapse',
            'description': 'Massive road crater opened up on Anna Salai main road causing vehicle overturns and traffic panic.',
            'category_id': 'roads',
            'department_code': 'DEPT_ROADS',
            'true_human_severity': 'CRITICAL'
        },

        # Water category (Dataset maps water -> CRITICAL)
        {
            'id': 'SANITY-03',
            'title': 'Slight water pressure decrease in morning tap',
            'description': 'Tap water pressure is slightly lower than usual between 6 AM and 7 AM in Apartment 3B.',
            'category_id': 'water',
            'department_code': 'DEPT_WATER',
            'true_human_severity': 'LOW'
        },
        {
            'id': 'SANITY-04',
            'title': 'Toxic chemical contamination in drinking water line',
            'description': 'Industrial effluent leaking into main municipal drinking water supply line, causing severe sickness and hospitalizations.',
            'category_id': 'water',
            'department_code': 'DEPT_WATER',
            'true_human_severity': 'CRITICAL'
        },

        # Drainage category (Dataset maps drainage -> CRITICAL)
        {
            'id': 'SANITY-05',
            'title': 'Minor leaf clog in roadside storm drain grate',
            'description': 'Few dry leaves accumulated on top of storm drain grate in quiet alley.',
            'category_id': 'drainage',
            'department_code': 'DEPT_DRAINAGE',
            'true_human_severity': 'LOW'
        },
        {
            'id': 'SANITY-06',
            'title': 'Major underground sewage main burst flooding hospital basement',
            'description': 'Main sewage trunk line ruptured flooding city hospital basement with raw sewage creating immediate biohazard emergency.',
            'category_id': 'drainage',
            'department_code': 'DEPT_DRAINAGE',
            'true_human_severity': 'CRITICAL'
        },

        # Streetlights category (Dataset maps streetlights -> HIGH)
        {
            'id': 'SANITY-07',
            'title': 'Single bulb flickering on park pedestrian path',
            'description': 'One decorative garden light flickering occasionally in public park.',
            'category_id': 'streetlights',
            'department_code': 'DEPT_ELECTRICITY',
            'true_human_severity': 'LOW'
        },
        {
            'id': 'SANITY-08',
            'title': 'High-voltage transformer explosion and live wire lying across school entrance',
            'description': 'Transformer exploded emitting fire sparks; live 11kV electrical wire snapped and hanging across school gate.',
            'category_id': 'streetlights',
            'department_code': 'DEPT_ELECTRICITY',
            'true_human_severity': 'CRITICAL'
        },

        # Garbage category (Dataset maps garbage -> MEDIUM)
        {
            'id': 'SANITY-09',
            'title': 'Small paper litter near bench',
            'description': 'Few discarded paper cups near park bench.',
            'category_id': 'garbage',
            'department_code': 'DEPT_SANITATION',
            'true_human_severity': 'LOW'
        },
        {
            'id': 'SANITY-10',
            'title': 'Massive toxic medical waste dump burning near residential apartments',
            'description': 'Illegal dumping of biohazardous medical waste set on fire, emitting toxic fumes and black smoke into homes.',
            'category_id': 'garbage',
            'department_code': 'DEPT_SANITATION',
            'true_human_severity': 'CRITICAL'
        },

        # Infrastructure category (Dataset maps infrastructure -> MEDIUM)
        {
            'id': 'SANITY-11',
            'title': 'Faded bus shelter poster',
            'description': 'Old advertisement poster peeling off bus stop shelter pillar.',
            'category_id': 'infrastructure',
            'department_code': 'DEPT_WORKS',
            'true_human_severity': 'LOW'
        },
        {
            'id': 'SANITY-12',
            'title': 'Imminent collapse of busy pedestrian flyover bridge pillar',
            'description': 'Main load-bearing concrete pillar of busy flyover bridge cracked severely with chunks falling onto traffic below.',
            'category_id': 'infrastructure',
            'department_code': 'DEPT_WORKS',
            'true_human_severity': 'CRITICAL'
        },

        # Other category (Dataset maps other -> LOW)
        {
            'id': 'SANITY-13',
            'title': 'Tree branch touching boundary wall',
            'description': 'Overhanging small branch touching private compound wall.',
            'category_id': 'other',
            'department_code': 'DEPT_GENERAL',
            'true_human_severity': 'LOW'
        },
        {
            'id': 'SANITY-14',
            'title': 'Rabid dog pack actively attacking citizens near primary school',
            'description': 'Pack of rabid aggressive stray dogs biting multiple children and pedestrians outside school gate.',
            'category_id': 'other',
            'department_code': 'DEPT_GENERAL',
            'true_human_severity': 'CRITICAL'
        }
    ]

    predictor = SeverityPredictor()
    predictor.load_artifacts("ml/severity_prediction/artifacts")

    correct_predictions = 0

    print("\n--- INDEPENDENT SANITY TEST PREDICTIONS ---")
    print(f"{'ID':10s} | {'Category':12s} | {'True Human':10s} | {'AI Predicted':12s} | {'Confidence':10s} | Match?")
    print("-" * 75)

    for item in unseen_complaints:
        pred = predictor.predict(item)
        ai_sev = pred['predicted_severity']
        conf = pred['confidence']
        true_sev = item['true_human_severity']

        is_match = (ai_sev == true_sev)
        if is_match:
            correct_predictions += 1

        print(f"{item['id']:10s} | {item['category_id']:12s} | {true_sev:10s} | {ai_sev:12s} | {conf*100:8.1f}% | {'[MATCH]' if is_match else '[MISMATCH]'}")

    sanity_acc = (correct_predictions / len(unseen_complaints)) * 100.0
    print("\n" + "=" * 75)
    print(f"INDEPENDENT SANITY TEST ACCURACY: {sanity_acc:.2f}% ({correct_predictions}/{len(unseen_complaints)} correct)")
    print("=" * 75)

    return sanity_acc

if __name__ == "__main__":
    run_independent_sanity_test()
