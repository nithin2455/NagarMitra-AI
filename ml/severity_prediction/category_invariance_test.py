"""
@file category_invariance_test.py
@description Category-Invariance Test for Component 4 Retraining.
Tests whether the Random Forest severity model correctly predicts DIFFERENT severity levels
for paired complaints sharing the EXACT same category/department.
"""

import pandas as pd
import numpy as np
from severity_engine import SeverityPredictor

CATEGORY_PAIRS = [
    {
        'category_id': 'roads',
        'department_code': 'DEPT_ROADS',
        'low_item': {
            'title': 'Faded paint on speed breaker',
            'description': 'Speed bump yellow paint slightly faded near residential lane in Adyar.',
            'expected_severity': 'LOW'
        },
        'critical_item': {
            'title': 'Catastrophic road cave-in and main highway collapse',
            'description': 'Massive 10-foot crater opened up on main arterial road causing vehicle overturn and live traffic hazard.',
            'expected_severity': 'CRITICAL',
            'support_count': 35, 'master_issue_count': 8, 'hotspot_priority': 88.0
        }
    },
    {
        'category_id': 'water',
        'department_code': 'DEPT_WATER',
        'low_item': {
            'title': 'Minor water pressure drop in morning tap',
            'description': 'Municipal tap water pressure is slightly lower than usual between 6 AM and 7 AM in Apartment 3B.',
            'expected_severity': 'LOW'
        },
        'critical_item': {
            'title': 'Toxic chemical effluent mixing into drinking water supply pipeline',
            'description': 'Industrial toxic sewage leaking directly into municipal drinking supply line, causing severe sickness.',
            'expected_severity': 'CRITICAL',
            'support_count': 35, 'master_issue_count': 8, 'hotspot_priority': 85.0
        }
    },
    {
        'category_id': 'drainage',
        'department_code': 'DEPT_DRAINAGE',
        'low_item': {
            'title': 'Dry leaves on roadside storm drain grate',
            'description': 'Few dry fallen leaves covering storm drain inlet grate near street corner.',
            'expected_severity': 'LOW'
        },
        'critical_item': {
            'title': 'Main underground sewage trunk line explosion flooding hospital',
            'description': 'Main sewage pipeline burst flooding hospital basement and ICU ground floor with raw black sewage.',
            'expected_severity': 'CRITICAL',
            'support_count': 40, 'master_issue_count': 9, 'hotspot_priority': 90.0
        }
    },
    {
        'category_id': 'streetlights',
        'department_code': 'DEPT_LIGHTING',
        'low_item': {
            'title': 'Single garden light shade dim in park',
            'description': 'Pedestrian walkway lamp shade slightly dusty and dim in public park.',
            'expected_severity': 'LOW'
        },
        'critical_item': {
            'title': 'High-voltage 11kV live electrical cable snapped hanging at school entrance',
            'description': 'Sparking 11kV live cable hanging across primary school entrance gate, extreme electrocution danger.',
            'expected_severity': 'CRITICAL',
            'support_count': 30, 'master_issue_count': 6, 'hotspot_priority': 88.0
        }
    },
    {
        'category_id': 'garbage',
        'department_code': 'DEPT_SANITATION',
        'low_item': {
            'title': 'Paper cup litter near park bench',
            'description': 'Few discarded paper tea cups scattered around park bench area.',
            'expected_severity': 'LOW'
        },
        'critical_item': {
            'title': 'Toxic biohazardous hospital medical waste burning near residential apartments',
            'description': 'Illegal dump of hospital syringes and chemical waste set on fire emitting toxic fumes into homes.',
            'expected_severity': 'CRITICAL',
            'support_count': 25, 'master_issue_count': 5, 'hotspot_priority': 82.0
        }
    },
    {
        'category_id': 'infrastructure',
        'department_code': 'DEPT_WORKS',
        'low_item': {
            'title': 'Faded street name sign board',
            'description': 'Municipal street sign board paint faded near junction.',
            'expected_severity': 'LOW'
        },
        'critical_item': {
            'title': 'Imminent concrete collapse of traffic flyover bridge pillar',
            'description': 'Main load-bearing concrete pillar of busy flyover bridge cracked severely with chunks falling onto vehicles.',
            'expected_severity': 'CRITICAL',
            'support_count': 45, 'master_issue_count': 10, 'hotspot_priority': 95.0
        }
    },
    {
        'category_id': 'other',
        'department_code': 'DEPT_GENERAL',
        'low_item': {
            'title': 'Small tree branch touching compound wall',
            'description': 'Overhanging small branch touching private compound wall.',
            'expected_severity': 'LOW'
        },
        'critical_item': {
            'title': 'Rabid stray dog pack biting children outside school gate',
            'description': 'Multiple children bitten and injured by aggressive rabid dog pack near school entrance.',
            'expected_severity': 'CRITICAL',
            'support_count': 32, 'master_issue_count': 7, 'hotspot_priority': 87.0
        }
    }
]

def run_category_invariance_test():
    print("=== CIVICPULSE COMPONENT 4: CATEGORY-INVARIANCE TEST ===")

    predictor = SeverityPredictor()
    predictor.load_artifacts("ml/severity_prediction/artifacts")

    total_pairs = len(CATEGORY_PAIRS)
    correct_invariance_pairs = 0

    print(f"\nTesting {total_pairs} paired complaints (Category Identical, Severity Varied)...")
    print(f"{'Category':14s} | {'Low Item Predicted':18s} | {'Critical Item Predicted':22s} | Invariance Passed?")
    print("-" * 75)

    results_details = []

    for pair in CATEGORY_PAIRS:
        cat_id = pair['category_id']
        dept = pair['department_code']

        # Predict Low Item
        low_input = {**pair['low_item'], 'category_id': cat_id, 'department_code': dept}
        pred_low = predictor.predict(low_input)
        low_sev = pred_low['predicted_severity']

        # Predict Critical Item
        crit_input = {**pair['critical_item'], 'category_id': cat_id, 'department_code': dept}
        pred_crit = predictor.predict(crit_input)
        crit_sev = pred_crit['predicted_severity']

        # Category Invariance passes if LOW item receives lower severity than CRITICAL item
        sev_rank = {'LOW': 1, 'MEDIUM': 2, 'HIGH': 3, 'CRITICAL': 4}
        is_invariant = (sev_rank[low_sev] < sev_rank[crit_sev]) and (low_sev in ['LOW', 'MEDIUM']) and (crit_sev in ['HIGH', 'CRITICAL'])

        if is_invariant:
            correct_invariance_pairs += 1

        results_details.append({
            'category': cat_id,
            'low_predicted': low_sev,
            'critical_predicted': crit_sev,
            'passed': is_invariant
        })

        print(f"{cat_id:14s} | {low_sev:18s} | {crit_sev:22s} | {'[PASSED]' if is_invariant else '[FAILED]'}")

    pass_rate = (correct_invariance_pairs / total_pairs) * 100.0
    print("\n" + "=" * 75)
    print(f"CATEGORY-INVARIANCE PASS RATE: {pass_rate:.2f}% ({correct_invariance_pairs}/{total_pairs} pairs)")
    print("=" * 75)

    return pass_rate, results_details

if __name__ == "__main__":
    run_category_invariance_test()
