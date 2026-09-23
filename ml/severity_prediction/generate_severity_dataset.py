"""
@file generate_severity_dataset.py
@description Dataset Generator for Leakage-Controlled Severity Prediction (Component 4).
Generates a realistic municipal complaint dataset where SEVERITY VARIES WITHIN THE SAME CATEGORY.
Prevents category-to-severity shortcut leakage.
"""

import os
import random
import pandas as pd
import numpy as np

# Set fixed random seed for reproducibility
random.seed(42)
np.random.seed(42)

DISTRICTS = ['Chennai North', 'Chennai South', 'Chennai Central', 'Tambaram', 'Avadi', 'Kanchipuram', 'Tiruvallur']
WARDS = [f"Ward-{i}" for i in range(1, 201)]

# Complaint templates categorized by (Category, Severity) to ensure intra-category variation
DATA_TEMPLATES = [
    # --- ROADS CATEGORY ---
    ('roads', 'LOW', 'Minor cosmetic paint peeling on speed breaker', 'Faded paint on speed bump near residential lane, requires routine repaint.'),
    ('roads', 'LOW', 'Small stone gravel loose on roadside margin', 'Loose gravel scattered near street corner after minor maintenance.'),
    ('roads', 'MEDIUM', 'Moderate pothole on residential lane', 'Pothole approximately 1 foot wide causing discomfort for two-wheelers in neighborhood street.'),
    ('roads', 'MEDIUM', 'Uneven road paver block near bus stop', 'Interlocking paver blocks displaced near local bus shelter area.'),
    ('roads', 'HIGH', 'Deep pothole causing vehicle damage and traffic blockage', 'Dangerous deep crater on main road damaging car tires and causing traffic congestion.'),
    ('roads', 'HIGH', 'Uncovered manhole trench on main avenue', 'Road cut open for cable laying left open without barricades on major avenue.'),
    ('roads', 'CRITICAL', 'Catastrophic road cave-in and asphalt collapse', 'Massive crater opened up on main arterial road causing vehicle overturn and imminent life hazard.'),
    ('roads', 'CRITICAL', 'Main bridge approach road cracked and collapsing', 'Approach embankment of river bridge severely cracked and caving in during peak traffic.'),

    # --- WATER CATEGORY ---
    ('water', 'LOW', 'Slight water pressure decrease in morning tap', 'Municipal tap water pressure is slightly lower than usual during morning supply hours.'),
    ('water', 'LOW', 'Minor street tap valve dripping', 'Public street tap dripping slowly near community park.'),
    ('water', 'MEDIUM', 'Localized water supply line leakage', 'Drinking water pipeline leaking small stream of clean water on roadside near residential building.'),
    ('water', 'MEDIUM', 'Water supply timing delayed by 2 hours', 'Morning municipal water supply delayed by two hours without advance notice.'),
    ('water', 'HIGH', 'Main municipal water supply pipeline burst', 'Main feeder pipe burst flooding street and leaving 500 households without water for 24h.'),
    ('water', 'HIGH', 'Brownish muddy water in residential supply line', 'Tap water coming contaminated with mud and silt across entire street layout.'),
    ('water', 'CRITICAL', 'Toxic chemical effluent mixing into drinking water supply', 'Industrial chemical sewage leaking directly into municipal drinking pipeline, causing severe illness.'),
    ('water', 'CRITICAL', 'Complete water outage in hospital ward for 48 hours', 'Zero water supply in municipal hospital premises for two days, threatening patient emergency operations.'),

    # --- DRAINAGE CATEGORY ---
    ('drainage', 'LOW', 'Dry leaves covering roadside drain grate', 'Accumulation of dry fallen leaves over storm drain inlet grate.'),
    ('drainage', 'LOW', 'Slight odor from storm water drain inlet', 'Mild stagnant smell from open storm drain during hot afternoon.'),
    ('drainage', 'MEDIUM', 'Localized clogged street drain causing puddle', 'Street drain inlet blocked with debris causing minor water pooling after rain.'),
    ('drainage', 'MEDIUM', 'Small open drainage chamber cover displaced', 'Concrete cover slab of small side drain displaced by 2 inches.'),
    ('drainage', 'HIGH', 'Severe storm water logging blocking street access', 'Rainwater logging knee-deep across entire street blocking vehicles and shop entrances.'),
    ('drainage', 'HIGH', 'Overflowing sewage drain on market street', 'Sewage drain overflowing onto commercial market footpath creating foul health hazard.'),
    ('drainage', 'CRITICAL', 'Underground sewage main explosion flooding hospital basement', 'Main sewage trunk line ruptured flooding hospital basement and ground floor with raw sewage.'),
    ('drainage', 'CRITICAL', 'Severe toxic sewage backup into ground floor homes', 'Raw black sewage backing up into toilets and living rooms of 50 houses creating extreme cholera biohazard.'),

    # --- STREETLIGHTS CATEGORY ---
    ('streetlights', 'LOW', 'Single decorative garden light dim in public park', 'Pedestrian walkway lamp shade slightly dusty and dim in municipal park.'),
    ('streetlights', 'LOW', 'Streetlight pole sticker peeling off', 'Identification sticker on light pole peeling off near corner.'),
    ('streetlights', 'MEDIUM', 'Single streetlight non-functional on residential lane', 'Sodium streetlight bulb fused outside house no 42 on quiet residential road.'),
    ('streetlights', 'MEDIUM', 'Streetlight timer misconfigured turning off early', 'Streetlights turning off 1 hour before sunrise in neighborhood layout.'),
    ('streetlights', 'HIGH', 'Entire street dark due to multiple streetlight failure', 'All 15 streetlights out on main connecting road creating dark zone and safety hazard for commuters.'),
    ('streetlights', 'HIGH', 'Damaged electrical junction box door open', 'Feeder pillar box door hanging open with exposed low-voltage terminals near footpath.'),
    ('streetlights', 'CRITICAL', 'High-voltage 11kV live wire snapped hanging across school gate', 'Sparking live electrical cable hanging at chest height right outside primary school entrance.'),
    ('streetlights', 'CRITICAL', 'Electrical transformer explosion emitting fire and smoke', 'Street transformer exploded emitting fire sparks and thick black smoke near crowded apartments.'),

    # --- GARBAGE CATEGORY ---
    ('garbage', 'LOW', 'Small litter paper cups near park bench', 'Few discarded tea cups scattered around park bench area.'),
    ('garbage', 'LOW', 'Public dustbin lid missing', 'Plastic dustbin lid missing at street corner bin.'),
    ('garbage', 'MEDIUM', 'Uncleared garbage dump accumulating for 3 days', 'Municipal green bin overflowing with household waste uncleared for 72 hours.'),
    ('garbage', 'MEDIUM', 'Commercial shop waste dumped on sidewalk', 'Retail shop cardboard boxes and plastic packaging dumped along footpath.'),
    ('garbage', 'HIGH', 'Large uncollected garbage dump overflowing onto main road', 'Massive multi-ton waste pile spilling onto main road lane causing traffic blockage and stench.'),
    ('garbage', 'HIGH', 'Animal carcasses dumped openly near residential layout', 'Decomposed animal waste dumped near residential colony causing intense stench and flies.'),
    ('garbage', 'CRITICAL', 'Toxic biohazardous medical waste burning near residential area', 'Illegal dump of hospital syringes and chemical waste set on fire emitting toxic fumes into homes.'),
    ('garbage', 'CRITICAL', 'Massive garbage barrier blocking emergency hospital ambulance entrance', 'Rotting garbage pile collapsed across hospital gate preventing emergency ambulance access.'),

    # --- INFRASTRUCTURE CATEGORY ---
    ('infrastructure', 'LOW', 'Faded street name sign board', 'Municipal street sign board paint faded near junction.'),
    ('infrastructure', 'LOW', 'Minor scratch on public park bench', 'Wooden bench slat scratched in public garden.'),
    ('infrastructure', 'MEDIUM', 'Damaged metal traffic guard rail', 'Galvanized iron traffic barrier bent after minor vehicle impact near bus stand.'),
    ('infrastructure', 'MEDIUM', 'Cracked plaster on municipal wall', 'Boundary wall plaster cracking near municipal office enclosure.'),
    ('infrastructure', 'HIGH', 'Unstable overhead gantries signboard shaking in wind', 'Large directional sign board hanging loose over main road threatening to fall on vehicles.'),
    ('infrastructure', 'HIGH', 'Public footbridge steps broken', 'Concrete steps on pedestrian footbridge cracked with exposed rusty iron rebar.'),
    ('infrastructure', 'CRITICAL', 'Imminent structural collapse of busy flyover bridge pillar', 'Load-bearing concrete pillar of busy traffic flyover cracked with large concrete blocks falling onto road below.'),
    ('infrastructure', 'CRITICAL', 'Municipal hall roof slab collapse hazard', 'Heavy concrete ceiling slab sagging and crumbling over crowded public waiting hall.'),

    # --- OTHER CATEGORY ---
    ('other', 'LOW', 'Tree branch overhanging private wall', 'Small tree branch extending over compound wall without immediate blockage.'),
    ('other', 'LOW', 'Faded ward boundary map', 'Public information board map faded at zonal office.'),
    ('other', 'MEDIUM', 'Stray cattle roaming on residential street', 'Stray cows sitting on residential lane causing minor vehicle slowness.'),
    ('other', 'MEDIUM', 'Overgrown grass near roadside footway', 'Wild grass growing along sidewalk margin.'),
    ('other', 'HIGH', 'Large fallen tree trunk blocking entire avenue', 'Heavy gulmohar tree uprooted during storm completely blocking two-lane avenue.'),
    ('other', 'HIGH', 'Stray dog pack menace creating panic near market', 'Pack of aggressive stray dogs barking and chasing two-wheelers near market.'),
    ('other', 'CRITICAL', 'Rabid stray dog pack actively biting children outside school gate', 'Multiple children bitten and injured by aggressive rabid dog pack near school entrance.'),
    ('other', 'CRITICAL', 'Chemical gas leak from abandoned industrial cylinder', 'Pungent chemical gas leaking from abandoned cylinder causing eye irritation and breathing panic in colony.')
]

def build_leakage_controlled_dataset(total_target_records=4200):
    print("=== CIVICPULSE COMPONENT 4: GENERATING LEAKAGE-CONTROLLED SEVERITY DATASET ===")

    records = []
    category_dept_map = {
        'roads': ('Road Damage & Potholes', 'DEPT_ROADS'),
        'water': ('Water Supply Contamination / Burst', 'DEPT_WATER'),
        'drainage': ('Drainage & Sewage Overflow', 'DEPT_DRAINAGE'),
        'streetlights': ('Streetlights & Electrical Hazards', 'DEPT_LIGHTING'),
        'garbage': ('Garbage & Waste Disposal', 'DEPT_SANITATION'),
        'infrastructure': ('Public Infrastructure Damage', 'DEPT_WORKS'),
        'other': ('Other / General Municipal Operations', 'DEPT_GENERAL')
    }

    # Generate records evenly distributed across (category, severity) combinations
    per_template_count = total_target_records // len(DATA_TEMPLATES)

    record_id = 1
    for template in DATA_TEMPLATES:
        cat_id, severity, base_title, base_desc = template
        cat_name, dept_code = category_dept_map[cat_id]

        for _ in range(per_template_count):
            district = random.choice(DISTRICTS)
            ward = random.choice(WARDS)

            # Add subtle natural variations in description text
            var_prefix = random.choice([
                "Urgent attention requested: ",
                "Citizen report from ",
                "Municipal grievance reported: ",
                "Field inspection notice: ",
                ""
            ])
            var_suffix = f" (Ref {ward}, {district})"

            full_desc = f"{var_prefix}{base_desc}{var_suffix}"
            full_title = f"{base_title} in {district}"

            # Operational Component 2 & 3 features available at submission
            support_cnt = random.randint(0, 45) if severity in ['HIGH', 'CRITICAL'] else random.randint(0, 10)
            master_cnt = random.randint(1, 15) if severity in ['HIGH', 'CRITICAL'] else random.randint(1, 3)
            hotspot_score = float(random.uniform(50.0, 95.0)) if severity in ['HIGH', 'CRITICAL'] else float(random.uniform(0.0, 45.0))

            records.append({
                'grievance_id': f"CP-SEV-{record_id:05d}",
                'title': full_title,
                'description': full_desc,
                'category_name': cat_name,
                'category_id': cat_id,
                'department_code': dept_code,
                'district': district,
                'ward': ward,
                'urgency_level': severity, # Target label
                'support_count': support_cnt,
                'master_issue_count': master_cnt,
                'hotspot_priority': round(hotspot_score, 2),
                'created_at': f"2026-08-{random.randint(1,28):02d}T{random.randint(8,20):02d}:00:00Z"
            })
            record_id += 1

    df = pd.DataFrame(records)
    df = df.sample(frac=1.0, random_state=42).reset_index(drop=True)

    print(f"\nGenerated total records: {len(df)}")
    print("\n--- SEVERITY CLASS DISTRIBUTION ---")
    print(df['urgency_level'].value_counts())

    print("\n--- CATEGORY vs SEVERITY CROSSTAB (VERIFYING INTRA-CATEGORY VARIATION) ---")
    crosstab = pd.crosstab(df['category_id'], df['urgency_level'], margins=True)
    print(crosstab)

    # 70% Train / 15% Val / 15% Test Stratified Split
    from sklearn.model_selection import train_test_split

    train_df, temp_df = train_test_split(df, test_size=0.30, random_state=42, stratify=df['urgency_level'])
    val_df, test_df = train_test_split(temp_df, test_size=0.50, random_state=42, stratify=temp_df['urgency_level'])

    print(f"\nSplit Sizes -> Train: {len(train_df)} | Val: {len(val_df)} | Test: {len(test_df)}")

    # Save datasets under ml/severity_prediction/data/
    data_dir = "ml/severity_prediction/data"
    os.makedirs(data_dir, exist_ok=True)

    train_df.to_csv(os.path.join(data_dir, "severity_train.csv"), index=False)
    val_df.to_csv(os.path.join(data_dir, "severity_val.csv"), index=False)
    test_df.to_csv(os.path.join(data_dir, "severity_test.csv"), index=False)

    print(f"\n[SUCCESS] Saved leakage-controlled datasets to {data_dir}/")
    return df

if __name__ == "__main__":
    build_leakage_controlled_dataset()
