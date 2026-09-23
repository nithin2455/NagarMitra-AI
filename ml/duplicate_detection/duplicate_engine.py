"""
CivicPulse AI Component 2 — Multimodal AI Duplicate Detection & Issue Consolidation Engine
Combines Text Similarity (TF-IDF/N-Gram Cosine), Location Similarity (Haversine Distance), and Image Similarity (Perceptual Hash/Visual Features).
Designed to scale to 10,000+ complaints by evaluating candidate Master Issues.
"""

import os
import sys
import json
import math
import re
import numpy as np
from PIL import Image

class MultimodalDuplicateEngine:
    def __init__(self, config=None):
        self.config = config or {
            "location_radius_meters": 100.0,
            "max_location_distance_meters": 1000.0,
            "weights": {
                "text": 0.30,
                "location": 0.45,
                "image": 0.25
            },
            "weights_no_image": {
                "text": 0.45,
                "location": 0.55,
                "image": 0.0
            },
            "high_confidence_threshold": 0.75,
            "medium_confidence_threshold": 0.50
        }

    # 1. Haversine Geographic Distance (Meters)
    def calculate_haversine_distance(self, lat1, lng1, lat2, lng2):
        if lat1 is None or lng1 is None or lat2 is None or lng2 is None:
            return None
        
        R = 6371000.0 # Earth radius in meters
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lng2 - lng1)

        a = (math.sin(delta_phi / 2.0) ** 2 +
             math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2)
        c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
        return R * c

    def calculate_location_similarity(self, lat1, lng1, lat2, lng2):
        dist_m = self.calculate_haversine_distance(lat1, lng1, lat2, lng2)
        if dist_m is None:
            return 0.5 # Neutral fallback if coordinates missing
        
        radius_m = self.config["location_radius_meters"]
        max_m = self.config["max_location_distance_meters"]

        if dist_m <= radius_m:
            return 1.0
        elif dist_m >= max_m:
            return 0.0
        else:
            # Exponential decay between 100m and 1000m
            decay = math.exp(-(dist_m - radius_m) / 300.0)
            return max(0.0, round(decay, 4))

    # 2. Text Semantic Similarity (Token Overlap + Char N-Gram Cosine)
    def tokenize(self, text):
        if not text:
            return []
        text_clean = re.sub(r'[^\w\s]', ' ', str(text).lower())
        return [w for w in text_clean.split() if len(w) >= 2]

    def calculate_text_similarity(self, text1, text2):
        import difflib

        if not text1 or not text2:
            return 0.0

        t1_clean = re.sub(r'[^\w\s]', ' ', str(text1).lower()).strip()
        t2_clean = re.sub(r'[^\w\s]', ' ', str(text2).lower()).strip()

        if not t1_clean or not t2_clean:
            return 0.0

        if t1_clean == t2_clean:
            return 1.0

        tokens1 = set([w for w in t1_clean.split() if len(w) >= 2])
        tokens2 = set([w for w in t2_clean.split() if len(w) >= 2])

        if not tokens1 or not tokens2:
            return 0.0

        intersection = len(tokens1.intersection(tokens2))
        union = len(tokens1.union(tokens2))
        jaccard = intersection / float(union) if union > 0 else 0.0

        # Character sequence ratio using difflib (great for typos & phrasing)
        seq_ratio = difflib.SequenceMatcher(None, t1_clean, t2_clean).ratio()

        # Character 3-gram similarity across full string
        def char_ngrams(s, n=3):
            if len(s) < n:
                return set([s])
            return set([s[i:i+n] for i in range(len(s)-n+1)])

        ng1 = char_ngrams(t1_clean)
        ng2 = char_ngrams(t2_clean)
        ng_intersect = len(ng1.intersection(ng2))
        ng_union = len(ng1.union(ng2))
        char_sim = ng_intersect / float(ng_union) if ng_union > 0 else 0.0

        # Fused text score: Sequence ratio (50%) + Char 3-grams (30%) + Token Jaccard (20%)
        fused_text = 0.50 * seq_ratio + 0.30 * char_sim + 0.20 * jaccard
        return round(float(fused_text), 4)

    # 3. Image Perceptual Hash Similarity
    def calculate_image_similarity(self, img_path_or_url1, img_path_or_url2):
        if not img_path_or_url1 or not img_path_or_url2:
            return None
        
        # If identical image URL/path, exact match
        if img_path_or_url1 == img_path_or_url2:
            return 1.0

        try:
            if os.path.exists(img_path_or_url1) and os.path.exists(img_path_or_url2):
                img1 = Image.open(img_path_or_url1).convert('L').resize((8, 8), Image.Resampling.LANCZOS)
                img2 = Image.open(img_path_or_url2).convert('L').resize((8, 8), Image.Resampling.LANCZOS)
                arr1 = np.array(img1.getdata())
                arr2 = np.array(img2.getdata())
                hash1 = arr1 > arr1.mean()
                hash2 = arr2 > arr2.mean()
                diff = np.sum(hash1 != hash2)
                sim = 1.0 - (diff / 64.0)
                return round(float(sim), 4)
        except Exception:
            pass

        return 0.5 # Neutral fallback

    # 4. Multimodal Fusion Score Computation
    def evaluate_pair(self, comp1, comp2):
        # 1. Category / Department Safeguard
        # Different departments MUST NOT merge automatically
        cat1 = comp1.get("categoryId") or comp1.get("departmentId")
        cat2 = comp2.get("categoryId") or comp2.get("departmentId")
        if cat1 and cat2 and cat1 != cat2:
            return {
                "fusedScore": 0.0,
                "textSimilarity": 0.0,
                "locationSimilarity": 0.0,
                "imageSimilarity": 0.0,
                "decision": "DIFFERENT_DEPARTMENT",
                "isDuplicate": False
            }

        # 2. Location Similarity
        lat1, lng1 = comp1.get("lat"), comp1.get("lng")
        lat2, lng2 = comp2.get("lat"), comp2.get("lng")
        loc_sim = self.calculate_location_similarity(lat1, lng1, lat2, lng2)

        # 3. Text Similarity
        txt1 = f"{comp1.get('title', '')} {comp1.get('description', '')}"
        txt2 = f"{comp2.get('title', '')} {comp2.get('description', '')}"
        text_sim = self.calculate_text_similarity(txt1, txt2)

        # 4. Image Similarity
        img1 = comp1.get("mediaUrls", [None])[0] if comp1.get("mediaUrls") else None
        img2 = comp2.get("mediaUrls", [None])[0] if comp2.get("mediaUrls") else None
        img_sim = self.calculate_image_similarity(img1, img2)

        # 5. Multimodal Fusion Weighting
        if img_sim is not None:
            w = self.config["weights"]
            fused = w["text"] * text_sim + w["location"] * loc_sim + w["image"] * img_sim
        else:
            w = self.config["weights_no_image"]
            fused = w["text"] * text_sim + w["location"] * loc_sim
            img_sim = 0.0

        # SAFEGUARD: If location distance is > 1km (loc_sim == 0), force duplicate to False regardless of text!
        if loc_sim == 0.0 and lat1 is not None and lat2 is not None:
            fused = min(fused, 0.35)

        fused = round(float(fused), 4)

        decision = "LOW_CONFIDENCE"
        is_dup = False
        if fused >= self.config["high_confidence_threshold"]:
            decision = "HIGH_CONFIDENCE_DUPLICATE"
            is_dup = True
        elif fused >= self.config["medium_confidence_threshold"]:
            decision = "MEDIUM_CONFIDENCE_REVIEW"
            is_dup = False

        return {
            "fusedScore": fused,
            "textSimilarity": text_sim,
            "locationSimilarity": loc_sim,
            "imageSimilarity": img_sim,
            "decision": decision,
            "isDuplicate": is_dup
        }

    # 5. Candidate Match Finder (Canonical Master Resolution)
    def find_best_master_match(self, new_complaint, candidate_masters):
        if not candidate_masters:
            return None

        best_match = None
        best_eval = None
        max_score = -1.0

        for master in candidate_masters:
            eval_res = self.evaluate_pair(new_complaint, master)
            score = eval_res["fusedScore"]
            if eval_res["isDuplicate"] and score > max_score:
                max_score = score
                best_match = master
                best_eval = eval_res

        if not best_match:
            return None

        # Canonical Master ID Resolution
        canonical_master_id = best_match.get("masterComplaintId") or best_match.get("id")
        duplicate_group_id = best_match.get("duplicateGroupId") or f"GRP-{canonical_master_id}"

        return {
            "matchedMasterId": canonical_master_id,
            "duplicateGroupId": duplicate_group_id,
            "confidence": best_eval["fusedScore"],
            "signals": best_eval,
            "decision": best_eval["decision"]
        }
