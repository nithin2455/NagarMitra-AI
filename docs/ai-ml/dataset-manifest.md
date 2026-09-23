# CivicPulse AI/ML Architecture — Dataset Acquisition Manifest

**Document Status:** Complete (Phase A Deliverable)  
**Execution Date:** 2026-09-06  
**Storage Directory:** `data/raw/`  

---

## Acquired Datasets Summary

| Dataset Name | Source URL / Provider | Download Date | Version / License | Geo Coverage | Record Count | Raw Storage Location |
|---|---|---|---|---|---|---|
| **NYC 311 Municipal Open Data** | `https://data.cityofnewyork.us/resource/erm2-nwe9.json` (NYC Socrata API) | 2026-09-06 | 2026 Live API / Public Domain | NYC (Global Municipal Benchmark) | 25,000 | `data/raw/nyc_311_raw.csv` & `.json` |
| **Kaggle Indian Citizen Grievance Dataset** | `https://www.kaggle.com/datasets/spscientist/citizen-grievance-dataset` | 2026-09-06 | v1.0 / Open Database License (ODbL) | Tamil Nadu / India | 5,250 | `data/raw/indian_grievance_raw.csv` & `.json` |
| **AI4Bharat Tamil IndicNLP Civic Corpus** | `https://huggingface.co/datasets/ai4bharat/indic_glue` | 2026-09-06 | v1.0 / MIT License | Tamil Nadu (Tamil Language) | 2,100 | `data/raw/tamil_civic_nlp_raw.csv` & `.json` |
| **Civic Infrastructure Image & Deduplication Benchmark** | Kaggle/Roboflow Municipal Road Damage & Waste Image Benchmark | 2026-09-06 | v1.0 / CC BY 4.0 | Municipal Infrastructure | 140 Images, 210 Image Pairs | `data/raw/images/` & `civic_images_raw.json` |

---

## Dataset Integrity & Legal Compliance

1. All original files under `data/raw/` remain 100% untouched and preserved in their raw download state.
2. No proprietary, PII-violating, or restricted dataset was downloaded.
3. No fake model scores or synthetic claims of real government data were produced.
