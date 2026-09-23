# CivicPulse AI/ML Architecture — Category Mapping Documentation

**Document Status:** Complete (Phase D Deliverable)  
**Target Department System:** CivicPulse 7 Core Departments (`src/models/schema.js`)  

---

## 1. Department Mapping Standard Table

| Original External Category / Descriptor | Target Department Key | CivicPulse Department Name | Mapping Rationale / Rule | Confidence Score |
|---|---|---|---|---|
| `Pothole`, `Street Condition`, `Highway Condition`, `Curb` | `roads` | Roads & Infrastructure | Direct match for road surface damage and pavement maintenance | 1.0 (Exact) |
| `Sewer`, `Catch Basin`, `Sewage Overflow`, `Drainage` | `drainage` | Drainage & Sewerage | Direct match for wastewater and underground drainage overflows | 1.0 (Exact) |
| `Dirty Conditions`, `Sanitation Condition`, `Missed Collection`, `Trash` | `garbage` | Sanitation & Solid Waste | Direct match for municipal solid waste, uncollected trash, and litter | 1.0 (Exact) |
| `Water System`, `Water Leak`, `Hydrant Leak`, `Water Quality` | `water` | Water Supply & Quality | Direct match for drinking water supply, pipeline bursts, and contamination | 1.0 (Exact) |
| `Street Light Condition`, `Traffic Signal`, `Electrical Wire` | `streetlights` | Electricity & Streetlights | Direct match for illumination hazards and electrical utility failures | 1.0 (Exact) |
| `Building/Use`, `Sidewalk Condition`, `Public Footbridge`, `Park Facility` | `infrastructure` | Public Infrastructure Damage | Direct match for public structures, footpaths, and municipal property | 0.95 (High) |
| `Noise`, `Rodent`, `Stray Animals`, `General Administrative` | `other` | General Municipal Operations | Reserved catch-all category for unclassified or multi-department requests | 0.90 (High) |

---

## 2. Unmapped / Unassigned Handling Protocol
* Any external record whose category cannot be mapped with confidence >= 0.85 is explicitly designated as `other` (`Other / General Municipal Operations`). No arbitrary category assignment is permitted.
