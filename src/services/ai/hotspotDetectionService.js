/**
 * @file hotspotDetectionService.js
 * @description Frontend client service for CivicPulse AI Component 3 (Geospatial DBSCAN Location Hotspot Detection).
 * Communicates with the Python AI API (http://127.0.0.1:8000/predict-hotspots).
 * Includes graceful client-side fallback if the Python ML server is unreachable.
 */

const ML_API_BASE_URL = 'http://127.0.0.1:8000';

/**
 * Calculates Haversine distance in meters between two lat/lng pairs
 */
function calculateHaversineDistance(lat1, lng1, lat2, lng2) {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return null;
  const R = 6371000.0;
  const rad = Math.PI / 180.0;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export const hotspotDetectionService = {
  /**
   * Fetch geographic hotspots for complaints
   * @param {Object} params - { complaints, mode, department, timeWindow, epsMeters, minSamples }
   * @returns {Promise<Object>} Hotspot detection result or fallback
   */
  async detectHotspots({
    complaints = [],
    mode = 'OVERALL',
    department = null,
    timeWindow = 'ALL_TIME',
    epsMeters = 350.0,
    minSamples = 3,
  }) {
    if (!complaints || complaints.length === 0) {
      return {
        isAvailable: true,
        total_clusters: 0,
        hotspots: [],
        noise_count: 0,
        noise_percentage: 0.0,
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500);

      const response = await fetch(`${ML_API_BASE_URL}/predict-hotspots`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          complaints,
          mode,
          department,
          timeWindow,
          epsMeters,
          minSamples,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`ML API returned status ${response.status}`);
      }

      const data = await response.json();
      return {
        isAvailable: true,
        isFallback: false,
        ...data,
      };
    } catch (err) {
      console.warn('AI Hotspot API offline/timeout. Executing JS client fallback engine.', err.message);

      // Client-side JS Fallback Clustering Engine
      const valid = complaints.filter((c) => {
        const lat = c.lat || (c.location && c.location.lat);
        const lng = c.lng || (c.location && c.location.lng);
        if (lat == null || lng == null) return false;
        if (mode === 'DEPARTMENT' && department && department !== 'all') {
          const dept = c.departmentId || c.categoryId;
          if (dept !== department) return false;
        }
        return true;
      });

      // Simple radius grouping fallback
      const visited = new Set();
      const hotspots = [];
      let clusterId = 1;

      for (let i = 0; i < valid.length; i++) {
        if (visited.has(i)) continue;
        const itemA = valid[i];
        const latA = Number(itemA.lat || itemA.location?.lat);
        const lngA = Number(itemA.lng || itemA.location?.lng);

        const group = [itemA];
        visited.add(i);

        for (let j = i + 1; j < valid.length; j++) {
          if (visited.has(j)) continue;
          const itemB = valid[j];
          const latB = Number(itemB.lat || itemB.location?.lat);
          const lngB = Number(itemB.lng || itemB.location?.lng);

          const dist = calculateHaversineDistance(latA, lngA, latB, lngB);
          if (dist != null && dist <= epsMeters) {
            group.push(itemB);
            visited.add(j);
          }
        }

        if (group.length >= minSamples) {
          const meanLat = group.reduce((sum, g) => sum + Number(g.lat || g.location?.lat), 0) / group.length;
          const meanLng = group.reduce((sum, g) => sum + Number(g.lng || g.location?.lng), 0) / group.length;

          let maxDist = 0;
          group.forEach((g) => {
            const d = calculateHaversineDistance(meanLat, meanLng, Number(g.lat || g.location?.lat), Number(g.lng || g.location?.lng));
            if (d && d > maxDist) maxDist = d;
          });

          const totalReports = group.reduce((acc, g) => acc + (g.reportCount || 1), 0);
          const masterCount = group.filter((g) => g.isMasterIssue || !g.isDuplicate).length || group.length;
          const openCount = group.filter((g) => !['VERIFIED_RESOLVED', 'CLOSED'].includes(g.status)).length;
          const score = Math.min(100, Math.round(masterCount * 12 + totalReports * 4 + openCount * 5));

          hotspots.push({
            cluster_id: `HOTSPOT-${String(clusterId++).padStart(3, '0')}`,
            centroid: { lat: Number(meanLat.toFixed(6)), lng: Number(meanLng.toFixed(6)) },
            radius_meters: Number(maxDist.toFixed(1)),
            master_issue_count: masterCount,
            total_report_count: totalReports,
            duplicate_count: totalReports - masterCount,
            unique_citizen_count: totalReports,
            dominant_department: group[0].departmentName || group[0].departmentId || 'General',
            dominant_category: group[0].categoryId || 'other',
            average_priority_score: group[0].priorityScore || 65,
            open_count: openCount,
            resolved_count: group.length - openCount,
            unresolved_ratio: group.length > 0 ? openCount / group.length : 0,
            hotspot_score: score,
            hotspot_rank: score >= 75 ? 'CRITICAL_HOTSPOT' : score >= 50 ? 'HIGH_CONCENTRATION' : 'MODERATE_CLUSTER',
            sample_complaint_ids: group.slice(0, 5).map((g) => g.id || g.grievanceId),
          });
        }
      }

      return {
        isAvailable: false,
        isFallback: true,
        mode,
        department,
        eps_meters: epsMeters,
        min_samples: minSamples,
        total_valid_complaints: valid.length,
        total_clusters: hotspots.length,
        noise_count: valid.length - hotspots.reduce((acc, h) => acc + h.master_issue_count, 0),
        noise_percentage: 0.0,
        hotspots,
        message: 'Executed JS client fallback hotspot clustering.',
      };
    }
  },
};
