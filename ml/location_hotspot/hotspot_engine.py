"""
CivicPulse AI Component 3 — Geospatial DBSCAN Location Hotspot Engine
Discovers geographic clusters of civic grievances using latitude/longitude spherical Haversine distance metric.
Supports Raw Citizen Reports mode vs Unique Master Issues mode, overall vs department-specific clustering,
temporal filtering, cluster centroid/radius calculations, and multi-factor prioritization scoring.
"""

import os
import sys
import math
import numpy as np
from sklearn.cluster import DBSCAN
from sklearn.metrics import silhouette_score, davies_bouldin_score, calinski_harabasz_score

EARTH_RADIUS_METERS = 6371000.0

class LocationHotspotEngine:
    def __init__(self, config=None):
        default_config = {
            "eps_meters": 350.0,            # Default geographic cluster radius in meters
            "min_samples": 3,               # Default minimum complaints per cluster
            "use_master_issues": True,      # True: Cluster on Master Issues, False: Cluster on Raw Reports
            "weights": {
                "master_issues": 0.35,
                "report_volume": 0.25,
                "severity": 0.25,
                "unresolved_ratio": 0.15
            }
        }
        self.config = {**default_config, **(config or {})}

    @staticmethod
    def haversine_distance_meters(lat1, lng1, lat2, lng2):
        """Calculates exact Haversine distance in meters between two lat/lng pairs."""
        if lat1 is None or lng1 is None or lat2 is None or lng2 is None:
            return None
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lng = math.radians(lng2 - lng1)

        a = (math.sin(delta_phi / 2.0) ** 2 +
             math.cos(phi1) * math.cos(phi2) * math.sin(delta_lng / 2.0) ** 2)
        c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
        return EARTH_RADIUS_METERS * c

    def preprocess_complaints(self, complaints, mode="OVERALL", department=None, time_window="ALL_TIME"):
        """Validates coordinates and filters complaints by department and temporal window."""
        valid = []
        for c in complaints:
            lat = c.get("lat") or (c.get("location", {}).get("lat") if isinstance(c.get("location"), dict) else None)
            lng = c.get("lng") or (c.get("location", {}).get("lng") if isinstance(c.get("location"), dict) else None)

            if lat is None or lng is None:
                continue

            try:
                lat_f = float(lat)
                lng_f = float(lng)
            except (ValueError, TypeError):
                continue

            # Coordinate range check
            if not (-90.0 <= lat_f <= 90.0 and -180.0 <= lng_f <= 180.0):
                continue

            # Department / Category filtering
            if mode == "DEPARTMENT" and department and department != "all":
                dept_c = c.get("departmentId") or c.get("categoryId")
                if dept_c != department:
                    continue

            # Deduplication filter (if master issue mode enabled)
            if self.config.get("use_master_issues", True):
                is_master = c.get("isMasterIssue", True)
                is_dup = c.get("isDuplicate", False)
                # Include master issues or non-duplicate standalone issues
                if is_dup and not is_master:
                    continue

            # Attach normalized float lat/lng
            c_copy = dict(c)
            c_copy["lat_f"] = lat_f
            c_copy["lng_f"] = lng_f
            valid.append(c_copy)

        return valid

    def detect_hotspots(self, complaints, mode="OVERALL", department=None, time_window="ALL_TIME", eps_meters=None, min_samples=None):
        """Executes DBSCAN spatial clustering and extracts rich hotspot attributes."""
        eps_m = eps_meters or self.config.get("eps_meters", 350.0)
        min_pts = min_samples or self.config.get("min_samples", 3)

        valid_complaints = self.preprocess_complaints(complaints, mode=mode, department=department, time_window=time_window)

        if not valid_complaints or len(valid_complaints) < min_pts:
            return {
                "mode": mode,
                "department": department,
                "eps_meters": eps_m,
                "min_samples": min_pts,
                "total_valid_complaints": len(valid_complaints),
                "total_clusters": 0,
                "noise_count": len(valid_complaints),
                "noise_percentage": 100.0 if valid_complaints else 0.0,
                "hotspots": [],
                "quality_metrics": None
            }

        # Convert lat/lng to radians for spherical Haversine DBSCAN
        coords_deg = np.array([[c["lat_f"], c["lng_f"]] for c in valid_complaints])
        coords_rad = np.radians(coords_deg)

        # Convert meters to radians for DBSCAN eps
        eps_rad = eps_m / EARTH_RADIUS_METERS

        db = DBSCAN(eps=eps_rad, min_samples=min_pts, metric="haversine").fit(coords_rad)
        labels = db.labels_

        unique_labels = set(labels)
        cluster_labels = [lbl for lbl in unique_labels if lbl != -1]
        noise_mask = (labels == -1)
        noise_count = int(np.sum(noise_mask))
        total_valid = len(valid_complaints)
        noise_pct = round((noise_count / float(total_valid)) * 100.0, 2)

        hotspots = []
        for cluster_id in cluster_labels:
            cluster_mask = (labels == cluster_id)
            cluster_items = [valid_complaints[i] for i in range(total_valid) if labels[i] == cluster_id]

            # 1. Centroid Lat/Lng
            cluster_lats = [item["lat_f"] for item in cluster_items]
            cluster_lngs = [item["lng_f"] for item in cluster_items]
            centroid_lat = round(float(np.mean(cluster_lats)), 6)
            centroid_lng = round(float(np.mean(cluster_lngs)), 6)

            # 2. Cluster Radius / Spread (Max distance from centroid to any cluster point)
            max_dist_m = 0.0
            for item in cluster_items:
                dist = self.haversine_distance_meters(centroid_lat, centroid_lng, item["lat_f"], item["lng_f"])
                if dist and dist > max_dist_m:
                    max_dist_m = dist
            max_dist_m = round(max_dist_m, 2)

            # 3. Report & Master Counts
            master_issue_count = len(cluster_items)
            total_reports = sum(item.get("reportCount", 1) for item in cluster_items)
            total_duplicates = sum(item.get("duplicateCount", 0) for item in cluster_items)

            # 4. Unique Citizen Count
            citizen_uids = set()
            for item in cluster_items:
                if item.get("citizenId"):
                    citizen_uids.add(item["citizenId"])
            unique_citizens = len(citizen_uids) if citizen_uids else total_reports

            # 5. Dominant Department & Category
            dept_counts = {}
            cat_counts = {}
            status_counts = {}
            severity_scores = []
            open_count = 0
            resolved_count = 0

            for item in cluster_items:
                dept = item.get("departmentName") or item.get("departmentId") or "General Municipal"
                cat = item.get("categoryId") or "other"
                st = item.get("status") or "SUBMITTED"
                sev = item.get("severity") or "MEDIUM"

                dept_counts[dept] = dept_counts.get(dept, 0) + 1
                cat_counts[cat] = cat_counts.get(cat, 0) + 1
                status_counts[st] = status_counts.get(st, 0) + 1

                # Severity score mapping
                sev_map = {"LOW": 25.0, "MEDIUM": 50.0, "HIGH": 75.0, "CRITICAL": 100.0}
                score = item.get("priorityScore") or sev_map.get(sev.upper(), 50.0)
                severity_scores.append(score)

                if st in ["VERIFIED_RESOLVED", "CLOSED"]:
                    resolved_count += 1
                else:
                    open_count += 1

            dominant_dept = max(dept_counts.items(), key=lambda x: x[1])[0]
            dominant_cat = max(cat_counts.items(), key=lambda x: x[1])[0]
            avg_priority = round(float(np.mean(severity_scores)), 2)
            unresolved_ratio = (open_count / float(master_issue_count)) if master_issue_count > 0 else 0.0

            # 6. Prioritization Score Calculation (0-100)
            w = self.config["weights"]
            s_master = min(100.0, master_issue_count * 10.0)
            s_reports = min(100.0, total_reports * 4.0)
            s_severity = avg_priority
            s_unresolved = unresolved_ratio * 100.0

            hotspot_score = (
                w["master_issues"] * s_master +
                w["report_volume"] * s_reports +
                w["severity"] * s_severity +
                w["unresolved_ratio"] * s_unresolved
            )
            hotspot_score = round(float(hotspot_score), 2)

            # Severity tier label
            if hotspot_score >= 75.0:
                rank = "CRITICAL_HOTSPOT"
            elif hotspot_score >= 50.0:
                rank = "HIGH_CONCENTRATION"
            else:
                rank = "MODERATE_CLUSTER"

            hotspots.append({
                "cluster_id": f"HOTSPOT-{cluster_id + 1:03d}",
                "centroid": {"lat": centroid_lat, "lng": centroid_lng},
                "radius_meters": max_dist_m,
                "master_issue_count": master_issue_count,
                "total_report_count": total_reports,
                "duplicate_count": total_duplicates,
                "unique_citizen_count": unique_citizens,
                "dominant_department": dominant_dept,
                "dominant_category": dominant_cat,
                "average_priority_score": avg_priority,
                "open_count": open_count,
                "resolved_count": resolved_count,
                "unresolved_ratio": round(unresolved_ratio, 4),
                "hotspot_score": hotspot_score,
                "hotspot_rank": rank,
                "sample_complaint_ids": [item.get("id") or item.get("grievanceId") for item in cluster_items[:5]]
            })

        # Sort hotspots by hotspot_score descending
        hotspots.sort(key=lambda h: h["hotspot_score"], reverse=True)

        # Calculate Clustering Quality Metrics if > 1 cluster and non-trivial points
        quality_metrics = None
        if len(cluster_labels) > 1 and total_valid > len(cluster_labels):
            try:
                # Filter out noise for standard silhouette calculation
                non_noise_mask = (labels != -1)
                if np.sum(non_noise_mask) > len(set(labels[non_noise_mask])):
                    sil = silhouette_score(coords_rad[non_noise_mask], labels[non_noise_mask], metric="haversine")
                    db_idx = davies_bouldin_score(coords_deg[non_noise_mask], labels[non_noise_mask])
                    ch_idx = calinski_harabasz_score(coords_deg[non_noise_mask], labels[non_noise_mask])

                    quality_metrics = {
                        "silhouette_score": round(float(sil), 4),
                        "davies_bouldin_index": round(float(db_idx), 4),
                        "calinski_harabasz_index": round(float(ch_idx), 4)
                    }
            except Exception:
                pass

        return {
            "mode": mode,
            "department": department,
            "eps_meters": eps_m,
            "min_samples": min_pts,
            "total_valid_complaints": total_valid,
            "total_clusters": len(cluster_labels),
            "noise_count": noise_count,
            "noise_percentage": noise_pct,
            "hotspots": hotspots,
            "quality_metrics": quality_metrics
        }
