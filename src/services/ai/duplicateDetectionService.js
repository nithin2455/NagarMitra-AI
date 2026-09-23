/**
 * @file duplicateDetectionService.js
 * @description Frontend client service for CivicPulse AI Component 2 (Multimodal Duplicate Detection & Consolidation).
 * Communicates with the Python AI API (http://127.0.0.1:8000/predict-duplicate).
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

/**
 * Fallback JS Text Similarity calculation (Jaccard + simple subword match)
 */
function fallbackTextSimilarity(t1, t2) {
  if (!t1 || !t2) return 0.0;
  const clean1 = String(t1).toLowerCase().replace(/[^\w\s]/g, ' ').trim();
  const clean2 = String(t2).toLowerCase().replace(/[^\w\s]/g, ' ').trim();
  if (!clean1 || !clean2) return 0.0;
  if (clean1 === clean2) return 1.0;

  const set1 = new Set(clean1.split(/\s+/).filter((w) => w.length >= 2));
  const set2 = new Set(clean2.split(/\s+/).filter((w) => w.length >= 2));

  let intersect = 0;
  set1.forEach((w) => {
    if (set2.has(w)) intersect++;
  });
  const union = new Set([...set1, ...set2]).size;
  return union > 0 ? intersect / union : 0.0;
}

export const duplicateDetectionService = {
  /**
   * Find candidate master match for a new complaint
   * @param {Object} params - { newComplaint, candidateMasters }
   * @returns {Promise<Object>} Match result or fallback evaluation
   */
  async findDuplicateMasterMatch({ newComplaint, candidateMasters = [] }) {
    if (!newComplaint || !candidateMasters || candidateMasters.length === 0) {
      return {
        isAvailable: true,
        hasMatch: false,
        match: null,
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const response = await fetch(`${ML_API_BASE_URL}/predict-duplicate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          newComplaint,
          candidateMasters,
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
        hasMatch: Boolean(data.hasMatch),
        match: data.match || null,
        isFallback: false,
      };
    } catch (err) {
      console.warn('AI Duplicate Detection API offline/timeout. Executing JS fallback engine.', err.message);

      // Client-side JS Fallback Engine
      let bestMatch = null;
      let maxScore = -1.0;

      for (const master of candidateMasters) {
        // Department safeguard
        const cat1 = newComplaint.categoryId || newComplaint.departmentId;
        const cat2 = master.categoryId || master.departmentId;
        if (cat1 && cat2 && cat1 !== cat2) continue;

        // Location distance
        const dist = calculateHaversineDistance(newComplaint.lat, newComplaint.lng, master.lat, master.lng);
        let locSim = 0.5;
        if (dist != null) {
          if (dist <= 100) locSim = 1.0;
          else if (dist >= 1000) locSim = 0.0;
          else locSim = Math.exp(-(dist - 100) / 300);
        }

        if (locSim === 0.0 && newComplaint.lat != null && master.lat != null) continue;

        const textSim = fallbackTextSimilarity(
          `${newComplaint.title || ''} ${newComplaint.description || ''}`,
          `${master.title || ''} ${master.description || ''}`
        );

        const fusedScore = 0.45 * textSim + 0.55 * locSim;
        if (fusedScore >= 0.75 && fusedScore > maxScore) {
          maxScore = fusedScore;
          const masterId = master.masterComplaintId || master.id;
          bestMatch = {
            matchedMasterId: masterId,
            duplicateGroupId: master.duplicateGroupId || `GRP-${masterId}`,
            confidence: Number(fusedScore.toFixed(4)),
            decision: 'HIGH_CONFIDENCE_DUPLICATE',
            signals: {
              fusedScore: Number(fusedScore.toFixed(4)),
              textSimilarity: Number(textSim.toFixed(4)),
              locationSimilarity: Number(locSim.toFixed(4)),
              imageSimilarity: 0.0,
            },
          };
        }
      }

      return {
        isAvailable: false,
        hasMatch: bestMatch !== null,
        match: bestMatch,
        isFallback: true,
        message: 'Executed offline JS fallback deduplication.',
      };
    }
  },
};
